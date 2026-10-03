import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import IMG from '../data/img.json';
import { S, update } from '../lib/store';
import { L, fmtDate, dowName, fmtShort } from '../lib/i18n';
import { STATUS, stLabel, iconFor, categories, ORD } from '../lib/engine';
import { nf, clamp, isoDow } from '../lib/util';

/* ---------- mascot + avatar ---------- */
const ALT = {
  welcome: ['น้องพอดีโบกมือทักทาย', 'Nong PorDee waving hello'], calc: ['น้องพอดีกำลังวิเคราะห์ข้อมูล', 'Nong PorDee analysing data'], advice: ['น้องพอดีชี้นิ้วแนะนำ', 'Nong PorDee giving advice'],
  alert: ['น้องพอดีแจ้งเตือนฉุกเฉิน', 'Nong PorDee raising an urgent alert'], success: ['น้องพอดีดีใจ สำเร็จแล้ว', 'Nong PorDee celebrating'], report: ['น้องพอดีถือรายงานสรุป', 'Nong PorDee holding the report'],
  notfound: ['น้องพอดีงง หาไม่เจอ', 'Nong PorDee puzzled'], logo: ['โลโก้น้องพอดี AI', 'Nong PorDee AI logo'],
};
export const Mimg = ({ k, w, free }) => <img className={'mimg' + (free ? ' free' : '')} src={IMG[k]} width={w} decoding="async" alt={L(...ALT[k])} />;
export const Avatar = () => <img className="avatar" src={IMG.face} width="40" height="40" alt="" />;

/* ---------- small display parts ---------- */
const GLYPH = {
  risk: <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1l5.5 10h-11z" fill="currentColor" /></svg>,
  watch: <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 .8L11.2 6 6 11.2.8 6z" fill="currentColor" /></svg>,
  ok: <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor" /></svg>,
  over: <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor" /></svg>,
};
export const StatusGlyph = ({ st }) => GLYPH[st];
/** one wording for "when to order" on every page: late delivery, order now, order by a date, or next order date */
export function OrderBy({ pl }) {
  if (pl.late) return <><Chip cls="risk">{L('ของเข้าไม่ทัน', 'Arrives too late')}</Chip><div className="th">{L(`ขาดของ ~${pl.late.days} วัน (${fmtShort(pl.late.out)}–${fmtShort(pl.late.until)})`, `~${pl.late.days} days out of stock (${fmtShort(pl.late.out)}–${fmtShort(pl.late.until)})`)}</div>{pl.rec > 0 && <div className="th">{L(`และควรสั่งเพิ่มภายใน ${fmtShort(pl.orderBy)}`, `and reorder by ${fmtShort(pl.orderBy)}`)}</div>}</>;
  if (pl.rec === 0) return <><span className="dim">{L('ยังไม่ต้องสั่ง', 'Not needed yet')}</span>{pl.cover < 90 && <div className="th">{L(`สั่งรอบถัดไปภายใน ${fmtShort(pl.orderBy)}`, `next order by ${fmtShort(pl.orderBy)}`)}</div>}</>;
  if (pl.now) return <><Chip cls="risk">{L('สั่งวันนี้', 'Order today')}</Chip>{pl.gap > 0 && <div className="th">{L(`อาจขาดของ ~${pl.gap} วัน`, `${pl.gap}-day gap likely`)}</div>}</>;
  return fmtDate(pl.orderBy);
}
export const Chip = ({ cls = 'neutral', children, title }) => <span className={'chip ' + cls} title={title}>{children}</span>;
export const StatusChip = ({ st }) => <Chip cls={STATUS[st].cls}>{GLYPH[st]}{stLabel(st)}</Chip>;
export const ProductIcon = ({ p, big }) => <span className="pico" aria-hidden="true" style={big ? { width: 84, height: 84, fontSize: 46, borderRadius: 24 } : undefined}>{iconFor(p)}</span>;
export const Panel = ({ title, actions, children, pad = true, style }) => (
  <section className="panel" style={style}>
    {(title || actions) && <div className="panel-h">{title && <h2>{title}</h2>}{actions}</div>}
    <div className={pad ? 'panel-b' : ''}>{children}</div>
  </section>
);
export const Tile = ({ k, v, unit, d, cls = '', spark }) => (
  <div className={'tile ' + cls}><div className="k">{k}</div><div className="v">{v}{unit && <small>{unit}</small>}</div><div className="d">{d}</div>{spark}</div>
);
export const Seg = ({ value, options, onChange, label }) => (
  <div className="seg" role="group" aria-label={label}>{options.map(([v, t]) => <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{t}</button>)}</div>
);
export const Empty = ({ title, sub, img = 'notfound', children }) => <div className="empty"><Mimg k={img} w={150} /><b>{title}</b>{sub && <span>{sub}</span>}{children}</div>;
export const Banner = ({ cls, img, title, children, actions }) => (
  <div className={'banner ' + cls} role={cls === 'risk' ? 'alert' : undefined}><Mimg k={img} w={148} /><div><h2>{title}</h2><p>{children}</p>{actions && <p style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</p>}</div></div>
);
export const Say = ({ img = 'success', children }) => <div className="say"><Mimg k={img} w={84} /><div>{children}</div></div>;
/** ⓘ glossary popover for inventory jargon */
export function Help({ text }) {
  const [open, setOpen] = useState(false);
  return <span className="help"><button type="button" className="helpbtn" aria-label={L('คำอธิบาย', 'Explain')} aria-expanded={open} onClick={() => setOpen(o => !o)} onBlur={() => setOpen(false)}>ⓘ</button>{open && <span className="helptip" role="tooltip">{text}</span>}</span>;
}
export function Th({ label, k, sort, cls, help }) {
  const on = sort && sort.k === k;
  if (!sort || !k) return <th className={cls}>{label}{help && <Help text={help} />}</th>;
  return <th className={cls} aria-sort={on ? (sort.d > 0 ? 'ascending' : 'descending') : 'none'}><button type="button" className="thbtn" onClick={() => sort.toggle(k)} title={L('เรียงลำดับ', 'Sort')}>{label}<span aria-hidden="true">{on ? (sort.d > 0 ? ' ▲' : ' ▼') : ' ↕'}</span></button>{help && <Help text={help} />}</th>;
}
/** sorting hook: const s = useSort(); s.apply(rows, {key: fn}) */
export function useSort(initial = null) {
  const [st, setSt] = useState(initial);
  const toggle = useCallback(k => setSt(s => (s && s.k === k ? { k, d: -s.d } : { k, d: 1 })), []);
  const apply = (rows, getters) => { const g = st && getters[st.k]; return g ? rows.slice().sort((a, b) => { const x = g(a), y = g(b); return (typeof x === 'string' ? x.localeCompare(y, 'th') : x - y) * st.d; }) : rows; };
  return { k: st && st.k, d: st && st.d, toggle, apply };
}
/** category chips: filters Products, Alerts, Plan, Sales, Forecast and Reports together */
export function CategoryBar({ counts }) {
  const cats = categories();
  return (
    <div className="cats" role="group" aria-label={L('หมวดหมู่สินค้า', 'Product category')}>
      <button type="button" aria-pressed={S.cat === 'all'} onClick={() => update(s => { s.cat = 'all'; })}>{L('ทั้งหมด', 'All')}<span>{counts.all}</span></button>
      {cats.map(c => <button key={c} type="button" aria-pressed={S.cat === c} onClick={() => update(s => { s.cat = c; })}><span aria-hidden="true">{({ 'เครื่องดื่ม': '🥤', 'อาหาร': '🍱', 'ของใช้': '🛍️' })[c] || '📦'}</span>{c}<span>{counts[c] || 0}</span></button>)}
    </div>
  );
}
export const Pager = ({ page, pages, onPage }) => <div className="pager"><button className="btn sm" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label={L('หน้าก่อนหน้า', 'Previous page')}>←</button><span>{L('หน้า', 'Page')} {page + 1} / {pages}</span><button className="btn sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} aria-label={L('หน้าถัดไป', 'Next page')}>→</button></div>;
export const Field = ({ id, label, error, hint, children, full }) => <div className={'field' + (full ? ' full' : '')}><label htmlFor={id}>{label}</label>{children}{error ? <span className="err" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}</div>;

/* ---------- sparkline ---------- */
export function Spark({ vals, color, w = 90, h = 30 }) {
  if (vals.length < 2) return null;
  const mx = Math.max(...vals), mn = Math.min(...vals), r = mx - mn || 1;
  const d = vals.map((v, i) => (i ? 'L' : 'M') + (i / (vals.length - 1) * w).toFixed(1) + ' ' + (h - 3 - (v - mn) / r * (h - 6)).toFixed(1)).join('');
  return <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true"><path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* ---------- stock gauge ---------- */
export function Gauge({ p, st }) {
  const max = Math.max(p.stock + p.inc, p.safety * 1.5, p.min * 2, 1), w = v => (clamp(v / max, 0, 1) * 100).toFixed(2) + '%';
  const txt = `${L('สต๊อก', 'Stock')} ${nf(p.stock)} · ${L('กำลังมา', 'incoming')} ${nf(p.inc)} · Min ${nf(p.min)} · Safety ${nf(p.safety)}`;
  return (
    <div className={'gauge ' + STATUS[st].cls} role="img" aria-label={txt} title={txt}>
      <div className={'g-stock ' + STATUS[st].cls} style={{ width: w(p.stock) }} />
      {p.inc > 0 && <div className="g-inc" style={{ left: w(p.stock), width: (clamp(p.inc / max, 0, 1) * 100).toFixed(2) + '%' }} />}
      <div className="tick min" style={{ left: w(p.min) }} /><div className="tick" style={{ left: w(p.safety) }} />
    </div>
  );
}
export const GaugeLegend = () => <div className="gauge-legend"><span><i style={{ background: 'var(--mint)' }} />{L('สต๊อกคงเหลือ', 'Stock on hand')}</span><span><i style={{ background: 'repeating-linear-gradient(90deg,var(--ink3) 0 3px,transparent 3px 6px)' }} />{L('กำลังมา', 'Incoming')}</span><span><i style={{ background: 'var(--risk)', height: 10, width: 2 }} />Min Stock</span><span><i style={{ background: 'var(--ink)', height: 10, width: 2 }} />Safety Stock</span></div>;

/* ---------- chart: one data set, five views (line, area, bar, histogram, table); SVG, responsive, hover tooltips ---------- */
const VIEWS = [['line', 'เส้น', 'Line'], ['area', 'พื้นที่', 'Area'], ['bar', 'แท่ง', 'Bars'], ['hist', 'ฮิสโตแกรม', 'Histogram'], ['table', 'ตาราง', 'Table']];
const niceMax = v => { const pw = Math.pow(10, Math.floor(Math.log10(v || 1))), f = v / pw; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * pw; };
const stats = a => { const s = a.slice().sort((x, y) => x - y), n = s.length, mean = s.reduce((x, y) => x + y, 0) / (n || 1); return { n, mean, median: n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0, min: s[0] || 0, max: s[n - 1] || 0, sd: Math.sqrt(s.reduce((x, y) => x + (y - mean) ** 2, 0) / (n || 1)) }; };
/** rounded top, square base: data ends are rounded, the baseline stays flat */
const barPath = (x, y, w, h) => { const r = Math.min(4, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };

export function Chart({ id, series, fmt = nf, axis, divider, label }) {
  const box = useRef(null), [W, setW] = useState(700), [hover, setHover] = useState(null);
  const view = (S.chartView || {})[id] || 'line', setView = v => update(s => { s.chartView = { ...s.chartView, [id]: v }; });
  useLayoutEffect(() => {
    const el = box.current; if (!el) return;
    const measure = () => setW(Math.max(280, el.clientWidth || 700)); measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  const g = useMemo(() => {
    const all = series.flatMap(s => s.pts); if (!all.length) return null;
    const xs = Array.from(new Set(all.map(p => p.x))).sort(), xi = Object.fromEntries(xs.map((x, i) => [x, i]));
    return { xs, xi, nice: niceMax(Math.max(...all.map(p => p.y)) * 1.1), lookup: series.map(s => Object.fromEntries(s.pts.map(p => [p.x, p.y]))) };
  }, [series]);
  const small = W < 520, H = small ? 230 : 290, m = { l: small ? 40 : 48, r: 14, t: 14, b: 28 };
  const solid = series.map((s, k) => ({ s, k })).filter(x => !x.s.dash);   // bars and histogram use the solid series; dashed ones stay lines
  const switcher = <div className="chart-views" role="group" aria-label={L('รูปแบบกราฟ', 'Chart type')}>{VIEWS.map(([k, th, en]) => <button key={k} type="button" aria-pressed={view === k} onClick={() => { setView(k); setHover(null); }}>{L(th, en)}</button>)}</div>;
  if (!g) return <div className="chart" ref={box}>{switcher}<div className="empty">{L('ยังไม่มีข้อมูลสำหรับกราฟ', 'No data to chart yet.')}</div></div>;
  const { xs, xi, nice, lookup } = g, PW = W - m.l - m.r, PH = H - m.t - m.b, Y = v => H - m.b - (v / nice) * PH;
  const legend = <div className="legend">{(view === 'hist' ? solid.map(x => x.s) : series).map(s => <span key={s.name}><i className={s.dash && view !== 'hist' ? 'dash' : view === 'bar' || view === 'hist' ? 'box' : ''} style={{ borderColor: s.color, background: (view === 'bar' || view === 'hist') && !s.dash ? s.color : undefined }} />{s.name}</span>)}</div>;
  const grid = (max, tick) => [0, 1, 2, 3, 4].map(k => { const v = max * k / 4, y = H - m.b - (k / 4) * PH; return <g key={k}><line x1={m.l} x2={W - m.r} y1={y} y2={y} stroke="var(--line2)" /><text x={m.l - 8} y={y + 4} textAnchor="end">{tick(v)}</text></g>; });
  const tipBox = (px, body) => <div className="tip" style={{ left: clamp(px / W * 100, 0, 100) + '%', transform: px > W * .6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)', top: 40 }}>{body}</div>;

  if (view === 'table') return (
    <div className="chart" ref={box}>{switcher}
      <div className="tbl-wrap chart-table"><table><caption className="sr-only">{label}</caption><thead><tr><th>{L('วันที่', 'Date')}</th>{series.map(s => <th key={s.name} className="r">{s.name}</th>)}</tr></thead>
        <tbody>{xs.slice().reverse().map(x => <tr key={x}><td style={{ whiteSpace: 'nowrap' }}>{dowName(isoDow(x))} {fmtDate(x)}</td>{series.map((s, k) => <td key={s.name} className="r">{lookup[k][x] != null ? fmt(lookup[k][x]) : '–'}</td>)}</tr>)}</tbody></table></div>
    </div>);

  if (view === 'hist') {
    const vals = solid.map(({ s }) => s.pts.map(p => p.y)), flat = vals.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
    const bins = small ? 8 : 12, width = (hi - lo) / bins || 1, counts = vals.map(v => { const c = new Array(bins).fill(0); v.forEach(y => c[Math.min(bins - 1, Math.floor((y - lo) / width))]++); return c; });
    const cmax = Math.ceil(Math.max(1, ...counts.flat()) / 4) * 4,   /* whole-day ticks */ bw = PW / bins, gw = Math.max(2, (bw - 2) / solid.length);
    const YC = c => H - m.b - (c / cmax) * PH, range = i => `${fmt(lo + i * width)}–${fmt(lo + (i + 1) * width)}`;
    return (
      <div className="chart" ref={box}>{switcher}{legend}
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={(label || '') + ' · ' + L('การกระจายรายวัน', 'daily distribution')}>
          {grid(cmax, v => nf(v))}
          {Array.from({ length: bins + 1 }, (_, i) => (i % (small ? 2 : 3) === 0 || i === bins) && <text key={i} x={m.l + i * bw} y={H - 8} textAnchor="middle">{(axis || fmt)(lo + i * width)}</text>)}
          {counts.map((c, k) => c.map((n, i) => n > 0 && <path key={k + '-' + i} d={barPath(m.l + i * bw + 1 + k * gw, YC(n), gw - (solid.length > 1 ? 2 : 0), H - m.b - YC(n))} fill={solid[k].s.color} />))}
          {Array.from({ length: bins }, (_, i) => <rect key={i} x={m.l + i * bw} y={m.t} width={bw} height={PH} fill="transparent" onPointerEnter={() => setHover({ i })} onPointerLeave={() => setHover(null)} />)}
        </svg>
        <p className="hint" style={{ marginTop: 2 }}>{L('แกนนอน = ยอดต่อวัน · แกนตั้ง = จำนวนวัน', 'Across = value per day · up = number of days')}</p>
        {hover && tipBox(m.l + (hover.i + .5) * bw, <><div style={{ opacity: .75, marginBottom: 2 }}>{range(hover.i)}</div>{solid.map(({ s }, k) => <div key={s.name}><span style={{ color: s.color, fontWeight: 600 }}>●</span> {s.name}: <b>{counts[k][hover.i]} {L('วัน', 'days')}</b></div>)}</>)}
        <div className="tbl-wrap"><table className="chart-stats"><thead><tr><th /><th className="r">{L('จำนวนวัน', 'Days')}</th><th className="r">{L('เฉลี่ย', 'Mean')}</th><th className="r">{L('มัธยฐาน', 'Median')}</th><th className="r">{L('ต่ำสุด', 'Min')}</th><th className="r">{L('สูงสุด', 'Max')}</th><th className="r">SD</th></tr></thead>
          <tbody>{solid.map(({ s }, k) => { const t = stats(vals[k]); return <tr key={s.name}><td><span style={{ color: s.color }}>●</span> {s.name}</td><td className="r">{t.n}</td><td className="r">{fmt(t.mean)}</td><td className="r">{fmt(t.median)}</td><td className="r">{fmt(t.min)}</td><td className="r">{fmt(t.max)}</td><td className="r">{fmt(t.sd)}</td></tr>; })}</tbody></table></div>
      </div>);
  }

  // time views: line, area, bar
  const n = xs.length, slot = PW / Math.max(1, n), X = i => (view === 'bar' ? m.l + (i + .5) * slot : m.l + (n > 1 ? i / (n - 1) : .5) * PW);
  const step = Math.ceil(n / (small ? 4 : 8)), bars = view === 'bar' ? solid : [];
  const onMove = ev => { const r = ev.currentTarget.ownerSVGElement.getBoundingClientRect(), px = (ev.clientX - r.left) * (W / r.width); setHover({ i: clamp(view === 'bar' ? Math.floor((px - m.l) / slot) : Math.round((px - m.l) / PW * (n - 1)), 0, n - 1) }); };
  const line = s => s.pts.map((p, i) => (i ? 'L' : 'M') + X(xi[p.x]).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
  return (
    <div className="chart" ref={box}>{switcher}{legend}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label || 'Chart'}>
        {grid(nice, v => (axis ? axis(v) : nf(v)))}
        {xs.map((x, i) => i % step === 0 && <text key={x} x={X(i)} y={H - 8} textAnchor="middle">{fmtShort(x)}</text>)}
        {divider && xi[divider] != null && <g><line x1={X(xi[divider])} x2={X(xi[divider])} y1={m.t} y2={H - m.b} stroke="var(--ink3)" strokeDasharray="2 4" /><text x={X(xi[divider]) + 6} y={m.t + 10}>{L('เริ่มพยากรณ์', 'Forecast starts')}</text></g>}
        {view === 'area' && series.filter(s => !s.dash && s.pts.length > 1).map(s => <path key={'a' + s.name} d={line(s) + `L${X(xi[s.pts[s.pts.length - 1].x]).toFixed(1)} ${H - m.b}L${X(xi[s.pts[0].x]).toFixed(1)} ${H - m.b}Z`} fill={s.color} fillOpacity=".16" />)}
        {bars.map(({ s }, k) => { const per = bars.filter(b => b.s.pts.length).length, bw = Math.max(1, (slot - (slot > 6 ? 2 : 0)) / Math.max(1, per)); return s.pts.map(p => { const i = xi[p.x], x0 = m.l + i * slot + (slot > 6 ? 1 : 0) + k * bw; return p.y > 0 && <path key={s.name + p.x} d={barPath(x0, Y(p.y), Math.max(1, bw - (per > 1 && bw > 4 ? 1 : 0)), H - m.b - Y(p.y))} fill={s.color} />; }); })}
        {series.filter(s => view !== 'bar' || s.dash).map(s => <path key={s.name} d={line(s)} fill="none" stroke={s.color} strokeWidth={s.w ? Math.min(2.5, s.w) : 2} strokeDasharray={s.dash ? '6 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />)}
        {hover && view !== 'bar' && <line x1={X(hover.i)} x2={X(hover.i)} y1={m.t} y2={H - m.b} stroke="var(--ink3)" />}
        {hover && view !== 'bar' && series.map((s, k) => lookup[k][xs[hover.i]] != null && <circle key={s.name} cx={X(hover.i)} cy={Y(lookup[k][xs[hover.i]])} r="4" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
        {hover && view === 'bar' && <rect x={m.l + hover.i * slot} y={m.t} width={slot} height={PH} fill="var(--ink3)" opacity=".08" />}
        <rect x={m.l} y={m.t} width={PW} height={PH} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
      </svg>
      {hover && (() => { const x = xs[hover.i]; return tipBox(X(hover.i), <><div style={{ opacity: .75, marginBottom: 2 }}>{dowName(isoDow(x))} {fmtDate(x)}</div>{series.map((s, k) => lookup[k][x] != null && <div key={s.name}><span style={{ color: s.color, fontWeight: 600 }}>●</span> {s.name}: <b>{fmt(lookup[k][x])}</b></div>)}</>); })()}
    </div>);
}

/* ---------- modal + toasts ---------- */
const OverlayCtx = createContext(null);
export const useOverlay = () => useContext(OverlayCtx);
export function OverlayProvider({ children }) {
  const [modal, setModal] = useState(null), [toasts, setToasts] = useState([]);
  const close = useCallback(() => setModal(null), []);
  const toast = useCallback((msg, act) => { const id = Math.random().toString(36).slice(2); setToasts(t => [...t, { id, msg, act }]); setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), act ? 7000 : 3800); }, []);
  const open = useCallback(node => setModal(node), []);
  return (
    <OverlayCtx.Provider value={{ open, close, toast }}>
      {children}
      {modal && <ModalShell onClose={close}>{modal}</ModalShell>}
      <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className="toast" role="status"><Avatar /><span style={{ flex: 1 }}>{t.msg}</span>{t.act && <button className="btn sm" onClick={() => { t.act.fn(); setToasts(x => x.filter(y => y.id !== t.id)); }}>{t.act.label}</button>}</div>)}</div>
    </OverlayCtx.Provider>
  );
}
function ModalShell({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement, el = ref.current;
    const f = el && (el.querySelector('[autofocus],input:not([readonly]),select,button')); if (f) f.focus();
    const key = e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && el) { const n = el.querySelectorAll('button,input,select,textarea,[href]'), a = Array.from(n).filter(x => !x.disabled); if (!a.length) return; const first = a[0], last = a[a.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); if (prev && prev.focus) try { prev.focus(); } catch (e) {} };
  }, [onClose]);
  return <div className="modal-back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" ref={ref}>{children}</div></div>;
}
export const Modal = ({ title, children, footer, narrow, onClose }) => (
  <div className={narrow ? 'narrow-wrap' : ''}>
    {title && <div className="modal-h"><h2>{title}</h2><button className="btn sm ghost" onClick={onClose} aria-label={L('ปิด', 'Close')}>✕</button></div>}
    <div className="modal-b">{children}</div>
    {footer && <div className="modal-f">{footer}</div>}
  </div>
);
