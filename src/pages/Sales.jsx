import { useMemo, useState, useEffect } from 'react';
import { L, fmtDate, fmtShort } from '../lib/i18n';
import { scoped, salesOf, hasSales } from '../lib/engine';
import { saveCsv, canDownload } from '../lib/actions';
import { baht, nf, sum, csvEsc } from '../lib/util';
import { Mimg, Panel, Tile, Seg, Chip, Th, useSort, Empty, ProductIcon, Pager, useOverlay } from '../components/ui';
import { useRoute } from '../router';

export default function Sales() {
  const { q } = useRoute(), { toast } = useOverlay(), sort = useSort();
  const [days, setDays] = useState(30), [sku, setSku] = useState('ALL'), [page, setPage] = useState(0);
  useEffect(() => setPage(0), [q, days, sku]);
  const prods = scoped().filter(p => hasSales(p.sku));
  const rows = useMemo(() => {
    const out = []; const ql = q.trim().toLowerCase();
    prods.filter(p => (sku === 'ALL' || p.sku === sku) && (!ql || (p.name + p.sku + p.cat).toLowerCase().includes(ql))).forEach(p => { const s = salesOf(p.sku, days); s.dates.forEach((d, i) => out.push({ date: d, p, qty: s.q[i], rev: s.q[i] * s.price, promo: s.p[i], fest: s.f[i] })); });
    return out;
  }, [prods.map(p => p.sku).join(), days, sku, q]);
  const shown = sort.apply(rows.slice().sort((a, b) => b.date.localeCompare(a.date) || a.p.sku.localeCompare(b.p.sku)), { date: r => r.date, name: r => r.p.name, qty: r => r.qty, rev: r => r.rev });
  const rev = sum(rows.map(r => r.rev)), units = sum(rows.map(r => r.qty)), dayN = new Set(rows.map(r => r.date)).size || 1;
  const daily = {}; rows.forEach(r => { daily[r.date] = (daily[r.date] || 0) + r.rev; });
  const ds = Object.keys(daily).sort(), weeks = [];
  for (let i = ds.length; i > 0; i -= 7) weeks.unshift({ from: ds[Math.max(0, i - 7)], v: sum(ds.slice(Math.max(0, i - 7), i).map(d => daily[d])) });
  const mx = Math.max(...weeks.map(w => w.v), 1), PS = 15, pages = Math.max(1, Math.ceil(shown.length / PS)), pg = Math.min(page, pages - 1);
  const csv = () => ['Date,SKU,Product,Quantity,Revenue,Promotion,Festival'].concat(shown.map(r => [r.date, r.p.sku, r.p.name, r.qty, r.rev, r.promo ? 'Yes' : 'No', r.fest ? 'Yes' : 'No'].map(csvEsc).join(','))).join('\n');
  return (
    <div className="stack">
      <div className="banner info"><Mimg k="calc" w={148} /><div><h2>{L('น้องพอดีกำลังวิเคราะห์ยอดขายของคุณ', 'Nong PorDee is studying your sales')}</h2><p>{L('ข้อมูลนี้คือสิ่งที่ AI ใช้เรียนรู้แนวโน้ม วันในสัปดาห์ และผลของโปรโมชั่น', 'This is the data the AI learns from: trend, weekday pattern and promotion effect.')}</p></div></div>
      <div className="toolbar" style={{ margin: 0 }}>
        <Seg value={days} onChange={setDays} label={L('ช่วงเวลา', 'Period')} options={[7, 30, 90].map(n => [n, `${n} ${L('วัน', 'days')}`])} />
        <select className="inp" value={sku} onChange={e => setSku(e.target.value)} aria-label={L('สินค้า', 'Product')}><option value="ALL">{L('สินค้าทั้งหมด', 'All products')}</option>{prods.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}</select>
      </div>
      <section className="tiles t3">
        <Tile cls="blue" k="Total Sales" v={baht(rev)} d={`${L('ยอดขายรวม', 'Total sales')} ${days} ${L('วัน', 'days')}`} />
        <Tile k="Avg Daily Sales" v={baht(rev / dayN)} d={L('ยอดขายเฉลี่ยต่อวัน', 'Average per day')} />
        <Tile cls="ok" k="Total Units Sold" v={nf(units)} unit={L('ชิ้น', 'units')} d={L('จำนวนที่ขายได้ทั้งหมด', 'Items sold')} />
      </section>
      <div className="grid2">
        <Panel title={L('สรุปยอดขายรายสัปดาห์', 'Weekly sales summary')}>{weeks.map(w => <div key={w.from} className="hbar" style={{ gridTemplateColumns: '64px 1fr 96px' }}><span>{fmtShort(w.from)}</span><div className="bar"><i style={{ width: (w.v / mx * 100).toFixed(0) + '%' }} /></div><span className="num">{baht(w.v)}</span></div>)}</Panel>
        <Panel title={L('ส่งออกข้อมูล', 'Export')}><p className="muted" style={{ marginBottom: 12 }}>{L('ดาวน์โหลดประวัติการขายตามตัวกรองที่เลือก', 'Download the sales history for the current filters.')}</p>{canDownload() ? <button className="btn" onClick={() => saveCsv('sales-history.csv', csv(), toast)}>⬇ {L('ดาวน์โหลด CSV', 'Download CSV')}</button> : <p className="hint">{L('มุมมองนี้ยังดาวน์โหลดไฟล์ไม่ได้', 'File download is not available in this view.')}</p>}</Panel>
      </div>
      <Panel title={L('ประวัติการขาย (Sales History)', 'Sales history')} actions={<span className="hint">{nf(shown.length)} {L('รายการ', 'rows')}</span>}>
        <div className="tbl-wrap"><table>
          <thead><tr><Th label={L('วันที่', 'Date')} k="date" sort={sort} /><Th label={L('สินค้า', 'Product')} k="name" sort={sort} /><Th label={L('จำนวน', 'Quantity')} k="qty" sort={sort} cls="r" /><Th label={L('ยอดขาย (฿)', 'Revenue (฿)')} k="rev" sort={sort} cls="r" /><Th label={L('โปรโมชั่น', 'Promotion')} /><Th label={L('เทศกาล', 'Festival')} /></tr></thead>
          <tbody>{shown.length ? shown.slice(pg * PS, pg * PS + PS).map(r => <tr key={r.date + r.p.sku}><td>{fmtDate(r.date)}</td><td><div className="pcell"><ProductIcon p={r.p} /><span className="pname">{r.p.name}</span></div></td><td className="r">{nf(r.qty)}</td><td className="r">{nf(r.rev)}</td><td>{r.promo ? <Chip cls="sent">{L('มี', 'Yes')}</Chip> : <span className="dim">–</span>}</td><td>{r.fest ? <Chip cls="sent">{L('มี', 'Yes')}</Chip> : <span className="dim">–</span>}</td></tr>)
            : <tr><td colSpan="6"><Empty title={L('ไม่พบข้อมูลการขาย', 'No sales found')} sub={L('ลองเปลี่ยนคำค้นหาหรือช่วงเวลาดูนะคะ', 'Try a different search or period.')} /></td></tr>}</tbody>
        </table></div>
        <Pager page={pg} pages={pages} onPage={setPage} />
      </Panel>
    </div>
  );
}
