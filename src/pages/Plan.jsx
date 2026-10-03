import { useState } from 'react';
import { L, fmtDate } from '../lib/i18n';
import { activeScenario, scoped, statusOf, planFor, ORD, reasonFor } from '../lib/engine';
import { baht, baht2, nf, sum } from '../lib/util';
import { Panel, Tile, Mimg, Th, useSort, StatusChip, Empty, OrderBy } from '../components/ui';
import { ProductCell } from './Products';
import { useOrderNow } from '../components/useOrderNow';
import { useRoute } from '../router';

export default function Plan({ initial }) {
  const { q, go } = useRoute(), orderNow = useOrderNow(), sort = useSort();
  const prods = scoped(), rows = prods.map(p => ({ p, st: statusOf(p), pl: planFor(p) })).sort((a, b) => (b.pl.rec > 0) - (a.pl.rec > 0) || a.pl.orderBy.localeCompare(b.pl.orderBy) || ORD.indexOf(a.st) - ORD.indexOf(b.st));
  const need = rows.filter(r => r.pl.rec > 0), late = rows.filter(r => r.pl.late);
  const [sel, setSel] = useState(() => new Set(initial ? [initial] : need.map(r => r.p.sku)));
  const toggle = sku => setSel(s => { const n = new Set(s); n.has(sku) ? n.delete(sku) : n.add(sku); return n; });
  const picked = need.filter(r => sel.has(r.p.sku)), budget = sum(need.map(r => r.pl.cost)), pickedCost = sum(picked.map(r => r.pl.cost)), sups = new Set(picked.map(r => r.p.sup)).size;
  const ql = q.trim().toLowerCase();
  const shown = sort.apply(rows.filter(r => !ql || (r.p.name + r.p.sku + r.p.cat + r.p.sup).toLowerCase().includes(ql)), { name: r => r.p.name, qty: r => r.pl.rec, cost: r => r.pl.cost, by: r => (r.pl.rec ? r.pl.orderBy : '9') });
  return (
    <div className="stack">
      <section className="tiles t3">
        <Tile cls="blue" k={L('รายการที่ต้องสั่ง', 'Items to order')} v={need.length} unit={L('รายการ', 'items')} d={`${L('จากสินค้าทั้งหมด', 'of')} ${rows.length}`} />
        <Tile k={L('ต้นทุนประเมิน', 'Estimated cost')} v={baht(budget)} d={`${L('เลือกแล้ว', 'Selected')} ${baht(pickedCost)} (${picked.length} ${L('รายการ', 'items')}, ${sups} supplier)`} />
        {need.length ? <div className="tile ok go"><Mimg k="success" w={84} /><div><div className="v" style={{ fontSize: 19 }}>{L('น้องพอดีพร้อมออก PO ค่ะ', 'PorDee is ready to raise your PO')}</div></div></div>
          : late.length ? <div className="tile risk go"><Mimg k="alert" w={84} /><div><div className="v" style={{ fontSize: 17 }}>{L(`ยังไม่ต้องสั่งเพิ่ม แต่ ${late.length} รายการของเข้าไม่ทัน`, `Nothing to order, but ${late.length} deliveries arrive too late`)}</div><button className="btn sm" style={{ marginTop: 6 }} onClick={() => go('alerts')}>{L('ดู Stock Alert', 'See stock alerts')}</button></div></div>
          : <div className="tile ok go"><Mimg k="success" w={84} /><div><div className="v" style={{ fontSize: 19 }}>{L('ยังไม่มีรายการที่ต้องสั่งค่ะ', 'Nothing to order right now')}</div></div></div>}
      </section>
      {activeScenario() && <p className="note">{L('ตัวเลขนี้รวมช่วงเทศกาล/โปรโมชั่นที่คุณตั้งไว้ในหน้า Demand Forecast', 'These quantities include your festival/promotion what-if from Demand Forecast.')}</p>}
      <Panel title={L('รายการสินค้าที่ AI แนะนำให้สั่ง (Recommended Orders)', 'Recommended orders')} actions={<><button className="btn sm" onClick={() => setSel(new Set(need.map(r => r.p.sku)))}>{L('เลือกทั้งหมด', 'Select all')}</button><button className="btn sm" onClick={() => setSel(new Set())}>{L('ล้างที่เลือก', 'Clear')}</button></>}>
        <div className="tbl-wrap"><table>
          <thead><tr><th style={{ width: 36 }}><span className="sr">{L('เลือก', 'Select')}</span></th><Th label={L('สินค้า', 'Product')} k="name" sort={sort} /><th>Supplier</th><th className="r">{L('สต๊อก + กำลังมา', 'Stock + incoming')}</th><Th label={L('คาดการณ์ 30 วัน', 'Forecast 30d')} cls="r" help={L('ยอดขายที่ AI คาดว่าจะขายได้ใน 30 วันข้างหน้า', 'Units the AI expects to sell in 30 days')} /><th className="r">Safety</th><Th label={L('แนะนำสั่ง', 'Order qty')} k="qty" sort={sort} cls="r" help={L('แนะนำเมื่อถึงเวลาสั่ง (ภายใน 7 วัน): พยากรณ์ช่วงรอของ + 30 วันหลังของเข้า + Safety Stock − สต๊อก − ของที่กำลังมา', 'Suggested once the order is due within 7 days: forecast for the delivery wait + 30 days after + safety stock − stock − incoming')} /><th className="r">{L('ต้นทุน/ชิ้น', 'Unit cost')}</th><Th label={L('ต้นทุนรวม', 'Est. cost')} k="cost" sort={sort} cls="r" /><Th label={L('สั่งภายใน', 'Order by')} k="by" sort={sort} help={L('วันที่สต๊อกหมด − Lead Time', 'The day stock runs out − lead time')} /></tr></thead>
          <tbody>{shown.length ? shown.map(r => { const n = r.pl.rec > 0; return (
            <tr key={r.p.sku} style={n || r.pl.late ? undefined : { opacity: .6 }}>
              <td><input type="checkbox" style={{ width: 18, height: 18, accentColor: 'var(--blue)' }} checked={n && sel.has(r.p.sku)} disabled={!n} onChange={() => toggle(r.p.sku)} aria-label={`${L('เลือก', 'Select')} ${r.p.name}`} /></td>
              <td><ProductCell p={r.p} /><div style={{ margin: '4px 0 0 48px' }}><StatusChip st={r.st} /></div><details className="why" style={{ margin: '4px 0 0 48px' }}><summary>{L('ทำไมแนะนำจำนวนนี้', 'Why this quantity')}</summary><div className="reason" style={{ marginTop: 6 }}>{reasonFor(r.p, r.pl)}</div></details></td>
              <td>{r.p.sup}</td><td className="r">{nf(r.p.stock)}{r.p.inc > 0 && ` + ${nf(r.p.inc)}`}</td><td className="r">{nf(r.pl.f30)}</td><td className="r">{nf(r.p.safety)}</td>
              <td className="r"><b>{nf(r.pl.rec)}</b> {L('ชิ้น', 'u')}</td><td className="r">{baht2(r.p.cost)}</td><td className="r"><b>{baht(r.pl.cost)}</b></td>
              <td><OrderBy pl={r.pl} />{r.pl.late && r.pl.late.po && <div><button className="linkbtn" onClick={() => go('po', r.pl.late.po)}>{L('เร่ง ', 'Chase ')}{r.pl.late.po}</button></div>}</td></tr>); })
            : <tr><td colSpan="10"><Empty title={L('ไม่พบสินค้าที่ค้นหา', 'No products found')} /></td></tr>}</tbody>
          <tfoot><tr><td /><td colSpan="5">{L('รวมที่เลือก', 'Selected total')}</td><td className="r">{nf(sum(picked.map(r => r.pl.rec)))}</td><td /><td className="r">{baht(pickedCost)}</td><td /></tr></tfoot>
        </table></div>
        <div className="stickybar"><span className="muted">{picked.length ? L(`เลือก ${picked.length} รายการ · ${baht(pickedCost)}`, `${picked.length} selected · ${baht(pickedCost)}`) : L('ยังไม่ได้เลือกสินค้า', 'Nothing selected')}</span>
          <button className="btn primary" style={{ padding: '12px 28px' }} disabled={!picked.length} onClick={() => orderNow(picked.map(r => r.p.sku))}>📝 {L('สร้างใบสั่งซื้อ (Purchase Order)', 'Create purchase orders')}</button></div>
      </Panel>
    </div>
  );
}
