// Forecasting + inventory rules. The statistical model is fitted offline in Python (forecast_model.py)
// and embedded as py.json, so the browser only looks results up and applies what-if windows.
import RAW from '../data/raw.json';
import PY from '../data/py.json';
import { S, memo, ASOF, LAST_HIST, HIST_START, FC_START } from './store';
import { L, fmtShort } from './i18n';
import { addDays, daysBetween, sum, mean, pct, nf, nf1 } from './util';

export const supplier = id => S.suppliers.find(s => s.id === id) || { id, company: id, contact: '', phone: '', email: '', address: '' };
export const hasSales = sku => !!RAW.sales[sku];

/* ---------- display helpers ---------- */
const ICONS = [['น้ำดื่ม', '💧'], ['ชา', '🍵'], ['ขนมปัง', '🍞'], ['บะหมี่', '🍜'], ['สบู่', '🧼'], ['แชมพู', '🧴'], ['ยาสีฟัน', '🪥'], ['ผงซักฟอก', '🧺'], ['นม', '🥛'], ['กาแฟ', '☕']];
export const CAT_ICON = { 'เครื่องดื่ม': '🥤', 'อาหาร': '🍱', 'ของใช้': '🛍️' };
export const iconFor = p => p.icon || (ICONS.find(x => p.name.includes(x[0])) || [0, CAT_ICON[p.cat] || '📦'])[1];
export const STATUS = {
  risk: { en: 'Stockout risk', th: 'เสี่ยงของขาด', cls: 'risk' }, watch: { en: 'Watch', th: 'เฝ้าระวัง', cls: 'watch' },
  ok: { en: 'Normal', th: 'ปกติ', cls: 'ok' }, over: { en: 'Overstock risk', th: 'เสี่ยงของล้น', cls: 'over' },
};
export const ORD = ['risk', 'watch', 'over', 'ok'];
export const stLabel = st => L(STATUS[st].th, STATUS[st].en);

/* ---------- categories / scope ---------- */
export const categories = () => Array.from(new Set(S.products.map(p => p.cat)));
export const scoped = () => S.products.filter(p => S.cat === 'all' || p.cat === S.cat);

/* ---------- forecast ---------- */
export const vkey = () => (S.fx.season ? '1' : '0') + (S.fx.promo ? '1' : '0');
const FLAT7 = [1, 1, 1, 1, 1, 1, 1];
export function ensureModel(sku) {
  const n = PY[sku]; if (!n) return null;
  return memo('m' + sku, () => { const v = n.v[vkey()]; return { accuracy: v.acc, accWeekly: v.accW, naive: v.naive, hw: v.hw, fit: v.fit, fitStart: addDays(HIST_START, 76), lift: n.lift, dowF: S.fx.season ? n.dowF : FLAT7, trend: n.trend30, stats: n.stats, lo: v.lo, hi: v.hi }; });
}
export const liftOf = sku => (PY[sku] ? PY[sku].lift : 1.3);
export const pyRows = () => S.products.filter(p => PY[p.sku]).map(p => ({ p, n: PY[p.sku], v: PY[p.sku].v[vkey()] }));
export const pyFirst30 = p => (PY[p.sku] ? sum(PY[p.sku].v[vkey()].fc.slice(0, 30)) : 0);
export const wbFirst30 = p => (RAW.forecast[p.sku] ? sum(RAW.forecast[p.sku].slice(0, 30)) : 0);
/** the forecast files start at FC_START; skip the days already past and, if needed, extend by repeating the last week */
const OFFSET = Math.max(0, daysBetween(FC_START, ASOF));
const fromToday = a => { const out = a.slice(); for (let j = out.length; j < OFFSET + 90; j++) out.push(out[j - 7]); return out.slice(OFFSET, OFFSET + 90); };
function baseSeries(p) {
  return memo('b' + p.sku + (p.est || 0), () => {
    const wb = RAW.forecast[p.sku], py = PY[p.sku] && PY[p.sku].v[vkey()].fc;
    if (!py) return Array.from({ length: 90 }, () => p.est || 0);
    if (S.src === 'wb' && wb) { const scale = sum(wb.slice(0, 30)) / (sum(py.slice(0, 30)) || 1); return fromToday(py.map((v, i) => (i < wb.length ? wb[i] : v * scale))); }
    return fromToday(py);
  });
}
/** daily forecast with what-if windows applied; cached for 90 days then sliced */
export function forecast(p, days) {
  const all = memo('f' + p.sku, () => {
    const base = baseSeries(p), sc = S.scenario, lift = liftOf(p.sku);
    return base.map((b, i) => {
      const date = addDays(ASOF, i); let v = b;
      if (S.fx.promo && sc.promo && date >= sc.promoStart && date <= sc.promoEnd) v *= lift;
      if (S.fx.fest && sc.fest && date >= sc.festStart && date <= sc.festEnd) v *= 1 + sc.festUp / 100;
      return { date, v: Math.round(v) };
    });
  });
  return days >= 90 ? all : all.slice(0, days);
}
export const fcTotal = (p, days) => sum(forecast(p, days).map(x => x.v));
export function fcRange(p, N) {
  const m = ensureModel(p.sku); if (!m || S.src !== 'py' || !m.lo[N]) return null;
  const base = sum(baseSeries(p).slice(0, N)), r = base ? fcTotal(p, N) / base : 1;
  return { lo: Math.round(m.lo[N] * r), hi: Math.round(m.hi[N] * r) };
}
export const activeScenario = () => (S.scenario.fest && S.fx.fest) || (S.scenario.promo && S.fx.promo);
export const modelAltered = () => !S.fx.season || !S.fx.promo || !S.fx.fest;

/* ---------- inventory rules ---------- */
/** deliveries still to come: open PO lines land on their expected date (overdue ones count as today);
 *  incoming stock that is not on any PO line is assumed to land after the lead time */
export function arrivals(p) {
  return memo('a' + p.sku, () => {
    const list = []; let onPo = 0;
    S.pos.filter(o => o.status === 'Sent' || o.status === 'In transit').forEach(o => (o.lines || []).forEach(l => {
      if (l.sku !== p.sku || !(l.qty > 0)) return;
      const late = o.eta < ASOF; list.push({ day: late ? 0 : daysBetween(ASOF, o.eta), date: late ? ASOF : o.eta, qty: l.qty, po: o.no, late }); onPo += l.qty;
    }));
    if (p.inc - onPo > 0) list.push({ day: p.lead, date: addDays(ASOF, p.lead), qty: p.inc - onPo, po: null });
    return list.sort((a, b) => a.day - b.day);
  });
}
/** day-by-day stock: shelf stock minus forecast demand, plus each delivery on its day.
 *  firstOut: days until the shelf is first empty (null if it never is within 90 days)
 *  gap: the first stretch with an empty shelf while a delivery is still on the way
 *  cover: days until stock runs out for good, after every scheduled delivery */
export function projection(p) {
  return memo('j' + p.sku, () => {
    const f = forecast(p, 90), arr = arrivals(p); let on = p.stock, k = 0, i = 0, firstOut = null, gap = null;
    while (i < f.length) {
      while (k < arr.length && arr[k].day <= i) on += arr[k++].qty;
      const d = f[i].v;
      if (on >= d) { on -= d; i++; continue; }
      const t = i + (d > 0 ? on / d : 0);
      if (firstOut == null) firstOut = t;
      if (k >= arr.length) return { firstOut, gap, cover: t };
      if (!gap) gap = { out: addDays(ASOF, Math.floor(t)), until: arr[k].date, days: Math.max(1, Math.ceil(arr[k].day - t)), po: arr[k].po };
      on = 0; i = arr[k].day;
    }
    return { firstOut, gap, cover: 90 };
  });
}
export const coverDays = p => projection(p).cover;
/** risk: the shelf empties before a new order could arrive, or stock is under min with no delivery on the way
 *  watch: under safety stock (or min, with a delivery arriving in time), or the shelf empties within 30 days */
export const statusOf = p => memo('s' + p.sku, () => {
  const out = projection(p).firstOut;
  return (p.stock < p.min && !arrivals(p).length) || (out != null && out < p.lead) ? 'risk' : p.stock < p.safety || (out != null && out < 30) ? 'watch' : coverDays(p) > S.overDays ? 'over' : 'ok';
});
export const dailyAvg = p => fcTotal(p, 30) / 30;
/** an order is recommended once its order-by date falls inside this many days; until then it shows as the next order */
export const ORDER_WINDOW = 7;
export function planFor(p) {
  return memo('p' + p.sku, () => {
    const f30 = fcTotal(p, 30), j = projection(p), cover = j.cover;
    const stockoutDate = addDays(ASOF, Math.floor(cover)); let orderBy = addDays(stockoutDate, -p.lead), gap = 0;
    if (orderBy <= ASOF) { gap = Math.max(0, p.lead - Math.floor(cover)); orderBy = ASOF; }
    // enough for the wait until a new order lands (lead time) plus 30 days after it lands, plus safety stock
    const need = fcTotal(p, Math.min(90, p.lead + 30)), qty = Math.max(0, Math.round(need + p.safety - p.stock - p.inc));
    const rec = cover < 90 && orderBy <= addDays(ASOF, ORDER_WINDOW) ? qty : 0;
    // shelf: days the stock on hand lasts; late: stockout while waiting for a PO that is already on its way
    return { f30, need, qty, rec, cost: rec * p.cost, cover, shelf: j.firstOut == null ? cover : j.firstOut, late: j.gap, next: arrivals(p)[0] || null, orderBy, gap, now: orderBy <= ASOF, stockoutDate };
  });
}
export const adviceList = prods => prods.map(p => ({ p, st: statusOf(p), pl: planFor(p) })).filter(x => x.pl.rec > 0).sort((a, b) => ORD.indexOf(a.st) - ORD.indexOf(b.st) || a.pl.cover - b.pl.cover);
/** must be ordered today: the order-by date has come, or a new order can not arrive before the shelf is empty */
export const urgentList = prods => adviceList(prods).filter(x => x.pl.now || x.pl.gap > 0);
export const counts = prods => { const c = { risk: 0, watch: 0, ok: 0, over: 0 }; prods.forEach(p => c[statusOf(p)]++); return c; };
export function reasonFor(p, plan) {
  const m = ensureModel(p.sku), sc = S.scenario, en = [], th = [], cd = Math.floor(plan.cover), lift = pct((liftOf(p.sku) - 1) * 100, 0);
  if (m) {
    const t = m.trend;
    if (t > 3) { en.push(`Sales are trending up (${pct(t, 0)} over the last 30 days).`); th.push(`ยอดขายมีแนวโน้มเพิ่มขึ้น (${pct(t, 0)} ใน 30 วันล่าสุด)`); }
    else if (t < -3) { en.push(`Sales are slowing (${pct(t, 0)} over the last 30 days).`); th.push(`ยอดขายมีแนวโน้มลดลง (${pct(t, 0)} ใน 30 วันล่าสุด)`); }
    else { en.push('Sales are steady compared with the previous 30 days.'); th.push('ยอดขายค่อนข้างคงที่เมื่อเทียบกับ 30 วันก่อนหน้า'); }
  } else { en.push('Not enough sales history yet, so the forecast uses your daily estimate.'); th.push('ยังมีประวัติการขายไม่พอ จึงใช้ยอดขายต่อวันที่ประมาณการไว้'); }
  if (plan.late) { const sd = Math.floor(plan.shelf), g = plan.late, po = g.po || L('ของที่กำลังมา', 'incoming stock');
    en.push(`Stock on the shelf lasts ${sd < 1 ? 'less than a day' : `about ${sd} day${sd === 1 ? '' : 's'}`}, but ${po} only arrives ${fmtShort(g.until)}, so expect about ${g.days} day${g.days === 1 ? '' : 's'} without stock. Ask the supplier to deliver sooner.`);
    th.push(`สต๊อกบนชั้นพอขาย${sd < 1 ? 'ไม่ถึง 1 วัน' : `อีกประมาณ ${sd} วัน`} แต่ ${po} จะมาถึง ${fmtShort(g.until)} อาจขาดของประมาณ ${g.days} วัน ควรติดต่อ Supplier ให้เร่งส่ง`); }
  else if (plan.cover < p.lead) { en.push(`Stock lasts about ${cd} day${cd === 1 ? '' : 's'} but the supplier needs ${p.lead}, so the shelf would be empty before a delivery lands.`); th.push(`สต๊อกอยู่ได้ประมาณ ${cd} วัน แต่ซัพพลายเออร์ต้องใช้ ${p.lead} วัน ของอาจหมดก่อนของใหม่มาถึง`); }
  else { en.push(`Stock lasts about ${cd >= 90 ? '90+' : cd} days against a ${p.lead}-day lead time.`); th.push(`สต๊อกอยู่ได้ประมาณ ${cd >= 90 ? '90+' : cd} วัน เทียบกับ lead time ${p.lead} วัน`); }
  if (p.inc > 0 && plan.rec > 0) { en.push(`Even with ${nf(p.inc)} units already on the way, it is not enough.`); th.push(`แม้มีของกำลังมา ${nf(p.inc)} ชิ้น ก็ยังไม่พอ`); }
  if (S.fx.promo && sc.promo) { en.push(`Promotion planned ${fmtShort(sc.promoStart)}–${fmtShort(sc.promoEnd)} lifts demand about ${lift} on those days.`); th.push(`โปรโมชันช่วง ${fmtShort(sc.promoStart)}–${fmtShort(sc.promoEnd)} เพิ่มยอดขายประมาณ ${lift} ในวันดังกล่าว`); }
  if (S.fx.fest && sc.fest) { en.push(`Festival window ${fmtShort(sc.festStart)}–${fmtShort(sc.festEnd)} adds ${sc.festUp}% demand.`); th.push(`ช่วงเทศกาล ${fmtShort(sc.festStart)}–${fmtShort(sc.festEnd)} เพิ่มความต้องการ ${sc.festUp}%`); }
  if (plan.rec > 0) { en.push(`Order ${nf(plan.rec)} units by ${fmtShort(plan.orderBy)}: forecast for the ${p.lead}-day wait plus 30 days after delivery (${nf(plan.need)}) + safety stock (${nf(p.safety)}) − stock on hand and on the way (${nf(p.stock + p.inc)}).`); th.push(`สั่งซื้อ ${nf(plan.rec)} ชิ้น ภายใน ${fmtShort(plan.orderBy)} = ยอดพยากรณ์ช่วงรอของ ${p.lead} วัน + 30 วันหลังของเข้า (${nf(plan.need)}) + Safety Stock (${nf(p.safety)}) − สต๊อกและของที่กำลังมา (${nf(p.stock + p.inc)})`); }
  else if (plan.cover < 90) { en.push(`No order needed yet. Stock and incoming last until about ${fmtShort(plan.stockoutDate)}, so place the next order by ${fmtShort(plan.orderBy)}.`); th.push(`ยังไม่ต้องสั่ง สต๊อกและของที่กำลังมาพอถึงประมาณ ${fmtShort(plan.stockoutDate)} ควรสั่งรอบถัดไปภายใน ${fmtShort(plan.orderBy)}`); }
  else { en.push('Stock and incoming cover more than 90 days. No order needed.'); th.push('สต๊อกและของที่กำลังมาพอขายเกิน 90 วัน ไม่ต้องสั่งเพิ่ม'); }
  return L(th.join(' '), en.join(' '));
}

/* ---------- sales history ---------- */
export function salesOf(sku, days) {
  const h = RAW.sales[sku]; if (!h) return { q: [], p: [], f: [], dates: [], price: 0 };
  const n = h.q.length, from = Math.max(0, n - days);
  return { q: h.q.slice(from), p: h.p.slice(from), f: h.f.slice(from), dates: h.q.slice(from).map((_, i) => addDays(HIST_START, from + i)), price: h.price };
}
export const salesSummary = (prods, days) => prods.filter(p => hasSales(p.sku)).map(p => {
  const s = salesOf(p.sku, days), units = sum(s.q);
  return { p, units, rev: units * s.price, gp: units * (s.price - p.cost), avg: units / (s.q.length || 1), promoDays: s.p.filter(Boolean).length };
});
export function dailyTotals(prods, days) {
  const out = {};
  prods.forEach(p => { const s = salesOf(p.sku, days); s.dates.forEach((d, i) => { out[d] = (out[d] || 0) + s.q[i] * s.price; }); });
  return out;
}
export function chartSeries(prods, metric, histDays, fcDays) {
  const val = (q, price) => (metric === 'rev' ? q * price : q), actual = {}, fit = {}, fc = {};
  prods.forEach(p => {
    if (!hasSales(p.sku)) return;
    const s = salesOf(p.sku, histDays), m = ensureModel(p.sku);
    s.dates.forEach((d, i) => { actual[d] = (actual[d] || 0) + val(s.q[i], s.price); });
    if (m) m.fit.forEach((v, i) => { const d = addDays(m.fitStart, i); if (d >= addDays(LAST_HIST, -histDays + 1)) fit[d] = (fit[d] || 0) + val(v, s.price); });
  });
  prods.forEach(p => forecast(p, fcDays).forEach(f => { fc[f.date] = (fc[f.date] || 0) + val(f.v, p.price); }));
  const pts = o => Object.keys(o).sort().map(x => ({ x, y: Math.round(o[x]) }));
  const a = pts(actual), r = pts(fc); if (a.length && r.length) r.unshift(a[a.length - 1]);
  return { actual: a, fit: pts(fit), fc: r };
}
export function weightedAccuracy(prods) {
  let w = 0, t = 0;
  prods.forEach(p => { const m = ensureModel(p.sku); if (!m) return; const u = sum(RAW.sales[p.sku].q.slice(-14)); w += m.accuracy * u; t += u; });
  return t ? w / t : null;
}
export const avgSold = (p, days = 30) => (hasSales(p.sku) ? mean(salesOf(p.sku, days).q) : p.est);

/* ---------- purchase orders ---------- */
export function nextPoNo() {
  const pre = 'PO-' + ASOF.slice(2, 4) + ASOF.slice(5, 7);
  const n = S.pos.filter(p => p.no.startsWith(pre)).map(p => parseInt(p.no.slice(pre.length), 10) || 0);
  return pre + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
}
/** one draft PO per supplier from the chosen SKUs; returns the new PO numbers */
export function buildDrafts(skus) {
  const rows = S.products.filter(p => skus.includes(p.sku)).map(p => ({ p, pl: planFor(p) })).filter(r => r.pl.rec > 0), by = {}, made = [];
  rows.forEach(r => (by[r.p.sup] = by[r.p.sup] || []).push(r));
  const drafts = Object.keys(by).map(sid => {
    const list = by[sid], s = supplier(sid), lines = list.map(r => ({ sku: r.p.sku, name: r.p.name, qty: r.pl.rec, ai: r.pl.rec, price: r.p.cost }));
    return { supplierId: sid, supplier: s.company, status: 'Draft', date: ASOF, eta: addDays(ASOF, Math.max(...list.map(r => r.p.lead))), note: '', lines, total: sum(lines.map(l => l.qty * l.price)) };
  });
  return drafts;
}
export const poLineTotal = po => sum(po.lines.map(l => (+l.qty || 0) * (+l.price || 0)));
