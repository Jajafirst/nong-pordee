import { useState } from 'react';
import { S } from '../lib/store';
import { L, fmtDate, fmtShort } from '../lib/i18n';
import { scoped, salesSummary, dailyTotals, fcTotal, ensureModel, weightedAccuracy, hasSales, salesOf, statusOf, planFor, dailyAvg, ORD, stLabel, iconFor, supplier } from '../lib/engine';
import { saveCsv, canDownload } from '../lib/actions';
import { baht, nf, nf1, pct, sum, csvEsc } from '../lib/util';
import { Banner, Panel, Seg, StatusChip, Say, Empty, useOverlay } from '../components/ui';
import { PoChip, poLabel } from './Orders';
import { can } from '../lib/perm';

function build(tab, days, prods) {
  const all = prods.map(p => ({ p, st: statusOf(p), pl: planFor(p) }));
  const nameCol = { h: L('สินค้า', 'Product'), v: r => r.p.name, node: r => <span className="pname">{iconFor(r.p)} {r.p.name}<small>{r.p.sku}</small></span> };
  const stCol = { h: L('สถานะ', 'Status'), v: r => stLabel(r.st), node: r => <StatusChip st={r.st} /> };
  const covCol = { h: L('สต๊อกบนชั้นอยู่ได้ (วัน)', 'Shelf stock lasts (days)'), v: r => +Math.min(90, r.pl.shelf).toFixed(1), f: v => (v >= 90 ? '90+' : nf1(v)), r: 1 };
  if (tab === 'sales') {
    const rows = salesSummary(prods, days), rev = sum(rows.map(r => r.rev)), units = sum(rows.map(r => r.units)), gp = sum(rows.map(r => r.gp));
    const daily = dailyTotals(prods, days), ds = Object.keys(daily).sort(), weeks = [];
    for (let i = ds.length; i > 0; i -= 7) weeks.unshift({ from: ds[Math.max(0, i - 7)], v: sum(ds.slice(Math.max(0, i - 7), i).map(d => daily[d])) });
    const mx = Math.max(...weeks.map(w => w.v), 1);
    return { file: `sales-report-${days}d`, title: L(`รายงานยอดขาย ${days} วันล่าสุด`, `Sales report, last ${days} days`), rows,
      sum: [[L('ยอดขาย', 'Revenue'), baht(rev)], [L('จำนวนที่ขาย', 'Units sold'), nf(units)], [L('กำไรขั้นต้น', 'Gross profit'), baht(gp)], [L('อัตรากำไรขั้นต้น', 'Gross margin'), rev ? (gp / rev * 100).toFixed(1) + '%' : '–']],
      cols: [nameCol, { h: L('หมวดหมู่', 'Category'), v: r => r.p.cat }, { h: L('จำนวน', 'Units'), v: r => r.units, f: nf, r: 1 }, { h: L('ยอดขาย (฿)', 'Revenue (฿)'), v: r => r.rev, f: nf, r: 1 }, { h: L('กำไรขั้นต้น (฿)', 'Gross profit (฿)'), v: r => r.gp, f: nf, r: 1 }, { h: L('ชิ้นต่อวัน', 'Units per day'), v: r => +r.avg.toFixed(1), f: nf1, r: 1 }, { h: L('วันโปรโมชั่น', 'Promo days'), v: r => r.promoDays, r: 1 },
        { h: L('สัดส่วนยอดขาย', 'Share'), v: r => (rev ? +(r.rev / rev * 100).toFixed(1) : 0), node: r => <div className="hbar" style={{ gridTemplateColumns: '1fr 46px', minWidth: 120 }}><div className="bar"><i style={{ width: (rev ? r.rev / rev * 100 : 0).toFixed(0) + '%' }} /></div><span className="num">{(rev ? r.rev / rev * 100 : 0).toFixed(0)}%</span></div> }],
      extra: <><h3 style={{ margin: '22px 0 8px' }}>{L('ยอดขายรายสัปดาห์', 'Revenue by week')}</h3>{weeks.map(w => <div key={w.from} className="hbar" style={{ gridTemplateColumns: '70px 1fr 90px' }}><span>{fmtShort(w.from)}</span><div className="bar"><i style={{ width: (w.v / mx * 100).toFixed(0) + '%' }} /></div><span className="num">{baht(w.v)}</span></div>)}</> };
  }
  if (tab === 'forecast') {
    const rows = prods.map(p => { const f = fcTotal(p, 30), prev = hasSales(p.sku) ? sum(salesOf(p.sku, 30).q) : 0, m = ensureModel(p.sku); return { p, f, prev, rev: f * p.price, acc: m ? m.accuracy : null, trend: m ? m.trend : null }; });
    const f = sum(rows.map(r => r.f)), pv = sum(rows.map(r => r.prev)), acc = weightedAccuracy(prods);
    return { file: 'forecast-report-30d', title: L('รายงานพยากรณ์ 30 วันข้างหน้า', 'Forecast report, next 30 days'), rows,
      sum: [[L('พยากรณ์ (ชิ้น)', 'Forecast units'), nf(f)], [L('30 วันที่ผ่านมา', 'Last 30 days'), nf(pv)], [L('เปลี่ยนแปลง', 'Change'), pv ? pct((f / pv - 1) * 100) : '–'], [L('ยอดขายที่คาดไว้', 'Expected sales'), baht(sum(rows.map(r => r.rev)))], [L('ความแม่นยำโมเดล', 'Model accuracy'), acc == null ? '–' : acc.toFixed(1) + '%']],
      cols: [nameCol, { h: L('30 วันที่ผ่านมา', 'Last 30 days'), v: r => r.prev, f: nf, r: 1 }, { h: L('พยากรณ์ 30 วัน', 'Forecast 30 days'), v: r => r.f, f: nf, r: 1 }, { h: L('เปลี่ยนแปลง %', 'Change %'), v: r => (r.prev ? +((r.f / r.prev - 1) * 100).toFixed(1) : ''), f: v => (v === '' ? '–' : pct(v)), r: 1 }, { h: L('ยอดขายที่คาดไว้ (฿)', 'Expected sales (฿)'), v: r => r.rev, f: nf, r: 1 }, { h: L('แนวโน้ม 30 วัน %', '30-day trend %'), v: r => (r.trend == null ? '' : +r.trend.toFixed(1)), f: v => (v === '' ? '–' : pct(v)), r: 1 }, { h: L('ความแม่นยำ %', 'Accuracy %'), v: r => (r.acc == null ? '' : +r.acc.toFixed(1)), f: v => (v === '' ? L('ไม่มีประวัติ', 'No history') : v + '%'), r: 1 }] };
  }
  if (tab === 'inventory') {
    const rows = all.map(x => ({ ...x, val: x.p.stock * x.p.cost, retail: x.p.stock * x.p.price }));
    return { file: 'inventory-report', title: L('รายงานสต๊อก', 'Inventory report'), rows,
      sum: [[L('สต๊อกคงเหลือ (ชิ้น)', 'Units on hand'), nf(sum(rows.map(r => r.p.stock)))], [L('กำลังมา (ชิ้น)', 'Units incoming'), nf(sum(rows.map(r => r.p.inc)))], [L('มูลค่าตามต้นทุน', 'Value at cost'), baht(sum(rows.map(r => r.val)))], [L('มูลค่าตามราคาขาย', 'Value at retail'), baht(sum(rows.map(r => r.retail)))]],
      cols: [nameCol, { h: L('หมวดหมู่', 'Category'), v: r => r.p.cat }, { h: L('สต๊อก', 'On hand'), v: r => r.p.stock, f: nf, r: 1 }, { h: L('กำลังมา', 'Incoming'), v: r => r.p.inc, f: nf, r: 1 }, { h: 'Min', v: r => r.p.min, f: nf, r: 1 }, { h: 'Safety', v: r => r.p.safety, f: nf, r: 1 }, { h: L('มูลค่าตามต้นทุน (฿)', 'Value at cost (฿)'), v: r => r.val, f: nf, r: 1 }, covCol, stCol] };
  }
  if (tab === 'overstock') {
    const rows = all.map(x => ({ ...x, excess: Math.max(0, x.p.stock + x.p.inc - x.pl.f30 - x.p.safety) })).sort((a, b) => b.pl.cover - a.pl.cover), over = rows.filter(r => r.st === 'over');
    return { file: 'overstock-report', title: L('รายงานสินค้าล้นสต๊อก', 'Overstock report'), rows, mood: 'success',
      sum: [[L(`สินค้าเกิน ${S.overDays} วัน`, `Products over ${S.overDays} days`), String(over.length)], [L('จำนวนส่วนเกิน', 'Excess units'), nf(sum(over.map(r => r.excess)))], [L('เงินจมในสต๊อกส่วนเกิน', 'Cash tied up'), baht(sum(over.map(r => r.excess * r.p.cost)))]],
      msg: over.length ? '' : L(`ไม่มีสินค้าที่สต๊อกเกิน ${S.overDays} วัน ตารางด้านล่างเรียงจากสินค้าที่ใกล้ที่สุด`, `No product is above ${S.overDays} days of cover. The closest ones are listed below.`),
      cols: [nameCol, { h: L('สต๊อก + กำลังมา', 'On hand + incoming'), v: r => r.p.stock + r.p.inc, f: nf, r: 1 }, { h: L('พยากรณ์ 30 วัน', '30-day forecast'), v: r => r.pl.f30, f: nf, r: 1 }, covCol, { h: L('ส่วนเกิน (ชิ้น)', 'Excess units'), v: r => r.excess, f: nf, r: 1 }, { h: L('มูลค่าส่วนเกิน (฿)', 'Excess value (฿)'), v: r => r.excess * r.p.cost, f: nf, r: 1 }, stCol] };
  }
  if (tab === 'stockout') {
    const rows = all.filter(x => x.st === 'risk' || x.st === 'watch' || x.pl.gap > 0 || x.pl.late).sort((a, b) => ORD.indexOf(a.st) - ORD.indexOf(b.st) || a.pl.shelf - b.pl.shelf).map(x => ({ ...x, daily: dailyAvg(x.p), empty: x.pl.late ? x.pl.late.days : x.pl.gap }));
    return { file: 'stockout-report', title: L('รายงานสินค้าเสี่ยงของขาด', 'Stockout report'), rows, mood: 'success',
      sum: [[L('เสี่ยงของขาด', 'Stockout risk'), String(rows.filter(r => r.st === 'risk').length)], [L('เฝ้าระวัง', 'Watch'), String(rows.filter(r => r.st === 'watch').length)], [L('ยอดขายที่อาจเสียไป', 'Sales likely lost'), baht(sum(rows.map(r => r.daily * r.p.price * r.empty)))]],
      msg: rows.length ? '' : L('ไม่มีสินค้าเสี่ยงของขาดค่ะ', 'No product is at risk of running out.'),
      cols: [nameCol, stCol, { h: L('สต๊อก', 'On hand'), v: r => r.p.stock, f: nf, r: 1 }, { h: 'Min', v: r => r.p.min, f: nf, r: 1 }, { h: L('ขาดจาก Min', 'Short of min'), v: r => Math.max(0, r.p.min - r.p.stock), f: nf, r: 1 }, covCol, { h: 'Lead (' + L('วัน', 'd') + ')', v: r => r.p.lead, r: 1 }, { h: L('ของเข้ารอบถัดไป', 'Next delivery'), v: r => (r.pl.next ? fmtShort(r.pl.next.date) + (r.pl.next.po ? ' · ' + r.pl.next.po : '') : '–') }, { h: L('วันที่อาจขาดของ', 'Likely empty days'), v: r => r.empty, r: 1 }, { h: L('ยอดขายที่เสี่ยงต่อวัน (฿)', 'Sales at stake/day (฿)'), v: r => Math.round(r.daily * r.p.price), f: nf, r: 1 }, { h: L('ต้องทำ', 'Action'), v: r => (r.pl.late ? L(`เร่ง ${r.pl.late.po || 'Supplier'}`, `Chase ${r.pl.late.po || 'supplier'}`) : r.pl.rec ? (r.pl.now ? L('สั่งวันนี้', 'Order today') : L('สั่งภายใน ', 'Order by ') + fmtDate(r.pl.orderBy)) : L(`สั่งรอบถัดไปภายใน ${fmtShort(r.pl.orderBy)}`, `Next order by ${fmtShort(r.pl.orderBy)}`)) }] };
  }
  const open = S.pos.filter(p => p.status !== 'Received'), plan = all.filter(x => x.pl.rec > 0), bySup = {};
  plan.forEach(x => { const s = (bySup[x.p.sup] = bySup[x.p.sup] || { items: 0, qty: 0, cost: 0 }); s.items++; s.qty += x.pl.rec; s.cost += x.pl.cost; });
  return { file: 'purchase-report', title: L('รายงานการจัดซื้อ', 'Purchase report'), rows: S.pos,
    sum: [[L('ต้นทุนที่แนะนำให้สั่ง', 'Recommended spend'), baht(sum(plan.map(x => x.pl.cost)))], [L('ใบสั่งซื้อที่ยังไม่ปิด', 'Open orders'), baht(sum(open.map(p => p.total)))], [L('รับของแล้ว', 'Received'), baht(sum(S.pos.filter(p => p.status === 'Received').map(p => p.total)))], [L('จำนวนใบสั่งซื้อ', 'Orders on file'), String(S.pos.length)]],
    cols: [{ h: 'PO', v: r => r.no, node: r => <b>{r.no}</b> }, { h: L('วันที่สั่ง', 'Order date'), v: r => r.date, f: fmtDate }, { h: 'Supplier', v: r => r.supplier }, { h: L('ยอดรวม (฿)', 'Total (฿)'), v: r => r.total, f: nf, r: 1 }, { h: L('คาดว่าจะได้รับ', 'Expected delivery'), v: r => r.eta, f: fmtDate }, { h: L('สถานะ', 'Status'), v: r => poLabel(r.status), node: r => <PoChip s={r.status} /> }],
    extra: <><h3 style={{ margin: '22px 0 8px' }}>{L('ต้นทุนที่แนะนำให้สั่ง แยกตาม Supplier', 'Recommended purchases by supplier')}</h3><div className="tbl-wrap"><table><thead><tr><th>Supplier</th><th className="r">{L('สินค้า', 'Products')}</th><th className="r">{L('จำนวน', 'Units')}</th><th className="r">{L('ต้นทุนประเมิน', 'Estimated cost')}</th></tr></thead><tbody>{Object.keys(bySup).length ? Object.keys(bySup).map(k => <tr key={k}><td>{supplier(k).company} <span className="th">{k}</span></td><td className="r">{bySup[k].items}</td><td className="r">{nf(bySup[k].qty)}</td><td className="r">{baht(bySup[k].cost)}</td></tr>) : <tr><td colSpan="4" className="dim">{L('ตอนนี้ไม่มีรายการที่ต้องสั่ง', 'Nothing to buy right now.')}</td></tr>}</tbody></table></div></> };
}

export default function Reports() {
  const [tab, setTab] = useState(can('viewSales') ? 'sales' : 'inventory'), [days, setDays] = useState(30), { toast } = useOverlay();
  const r = build(tab, days, scoped());
  const tabs = [['sales', L('ยอดขาย', 'Sales')], ['forecast', L('พยากรณ์', 'Forecast')], ['inventory', L('สต๊อก', 'Inventory')], ['overstock', L('ล้นสต๊อก', 'Overstock')], ['stockout', L('เสี่ยงของขาด', 'Stockout')], ['purchase', L('จัดซื้อ', 'Purchases')]].filter(([k]) => k !== 'sales' || can('viewSales'));
  const csv = () => r.cols.map(c => csvEsc(c.h)).join(',') + '\n' + r.rows.map(row => r.cols.map(c => csvEsc(c.v(row))).join(',')).join('\n');
  return (
    <div className="stack">
      <Banner cls="info" img="report" title={L('สรุปรายงานจากน้องพอดี AI', 'Summary reports from PorDee AI')}>{L('เลือกรายงานที่ต้องการ แล้วดาวน์โหลดเป็นไฟล์ CSV เพื่อนำไปใช้ต่อได้', 'Pick a report, then download it as CSV.')}</Banner>
      <Panel>
        <div className="tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
        <div className="toolbar"><h2>{r.title}</h2><span className="grow" />
          {tab === 'sales' && <Seg value={days} onChange={setDays} label={L('ช่วงเวลา', 'Period')} options={[7, 30, 90].map(n => [n, `${n} ${L('วัน', 'days')}`])} />}
          {canDownload() && <button className="btn" onClick={() => saveCsv(r.file + '.csv', csv(), toast)}>⬇ {L('ดาวน์โหลด CSV', 'Download CSV')}</button>}</div>
        <div className="sums" style={{ marginBottom: 18 }}>{r.sum.map(([k, v]) => <div key={k} className="s"><b>{v}</b><span>{k}</span></div>)}</div>
        {r.msg && <Say img={tab === 'stockout' ? 'success' : 'advice'}>{r.msg}</Say>}
        <div className="tbl-wrap"><table><thead><tr>{r.cols.map(c => <th key={c.h} className={c.r ? 'r' : ''}>{c.h}</th>)}</tr></thead>
          <tbody>{r.rows.length ? r.rows.map((row, i) => <tr key={i}>{r.cols.map(c => <td key={c.h} className={c.r ? 'r' : ''}>{c.node ? c.node(row) : c.f ? c.f(c.v(row)) : c.v(row)}</td>)}</tr>) : <tr><td colSpan={r.cols.length}><Empty title={L('ไม่มีข้อมูล', 'No rows')} /></td></tr>}</tbody></table></div>
        {r.extra}
      </Panel>
    </div>
  );
}
