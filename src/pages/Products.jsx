import { useState } from 'react';
import { S, ASOF } from '../lib/store';
import { L } from '../lib/i18n';
import { scoped, categories, statusOf, planFor, ensureModel, avgSold, hasSales, iconFor, supplier, stLabel, STATUS, ORD, reasonFor, chartSeries, salesOf } from '../lib/engine';
import { saveProduct, deleteProduct, restoreProduct } from '../lib/actions';
import { can } from '../lib/perm';
import { baht2, nf, nf1 } from '../lib/util';
import { Panel, Th, useSort, StatusChip, ProductIcon, Empty, Gauge, GaugeLegend, Chart, Modal, useOverlay, Field } from '../components/ui';
import AdviceCard from '../components/AdviceCard';
import { useRoute } from '../router';

const matchQ = (p, q) => { q = q.trim().toLowerCase(); return !q || (p.name + ' ' + p.sku + ' ' + p.cat + ' ' + p.sup).toLowerCase().includes(q); };
export const ProductCell = ({ p }) => { const { go } = useRoute(); return <div className="pcell"><ProductIcon p={p} /><div className="pname"><button className="linkbtn" onClick={() => go('detail', p.sku)}>{p.name}</button><small>{p.sku}</small></div></div>; };

export function Products() {
  const { q } = useRoute(), { open, close, toast } = useOverlay(), sort = useSort(), [status, setStatus] = useState('all');
  const rows = sort.apply(scoped().filter(p => (status === 'all' || statusOf(p) === status) && matchQ(p, q)), { name: p => p.name, cat: p => p.cat, cost: p => p.cost, price: p => p.price, stock: p => p.stock, status: p => ORD.indexOf(statusOf(p)) });
  const edit = p => open(<ProductForm p={p} onClose={close} toast={toast} />);
  return (
    <Panel>
      <div className="toolbar">
        <select className="inp" value={status} onChange={e => setStatus(e.target.value)} aria-label={L('สถานะ', 'Status')}><option value="all">{L('ทุกสถานะ', 'All statuses')}</option>{Object.keys(STATUS).map(k => <option key={k} value={k}>{stLabel(k)}</option>)}</select>
        <span className="grow" />{can('productEdit') && <button className="btn primary" onClick={() => edit(null)}>＋ {L('เพิ่มสินค้า', 'Add product')}</button>}
      </div>
      <div className="tbl-wrap"><table>
        <thead><tr><Th label={L('สินค้า', 'Product')} k="name" sort={sort} /><Th label={L('หมวดหมู่', 'Category')} k="cat" sort={sort} /><Th label="Supplier" /><Th label={L('ต้นทุน', 'Cost')} k="cost" sort={sort} cls="r" /><Th label={L('ราคาขาย', 'Price')} k="price" sort={sort} cls="r" /><Th label={L('สต๊อก', 'Stock')} k="stock" sort={sort} cls="r" /><Th label={L('กำลังมา', 'Incoming')} cls="r" help={L('จำนวนที่สั่งไปแล้วและกำลังจะมาถึง', 'Units already ordered and on the way')} /><Th label="Min" cls="r" help={L('Min Stock: ต่ำกว่านี้ถือว่าเสี่ยงของขาด', 'Minimum stock: below this is a stockout risk')} /><Th label="Safety" cls="r" help={L('Safety Stock: สต๊อกกันเหนียวเผื่อยอดขายผันผวน', 'Safety stock: buffer for demand swings')} /><Th label="Lead" cls="r" help={L('Lead Time: จำนวนวันที่ซัพพลายเออร์ใช้ส่งของ', 'Lead time: days the supplier needs to deliver')} /><Th label={L('สถานะ', 'Status')} k="status" sort={sort} /><th /></tr></thead>
        <tbody>{rows.length ? rows.map(p => <tr key={p.sku}><td><ProductCell p={p} /></td><td>{p.cat}</td><td>{p.sup}</td><td className="r">{baht2(p.cost)}</td><td className="r">{baht2(p.price)}</td><td className="r"><b>{nf(p.stock)}</b></td><td className="r">{nf(p.inc)}</td><td className="r">{nf(p.min)}</td><td className="r">{nf(p.safety)}</td><td className="r">{p.lead}{L(' วัน', 'd')}</td><td><StatusChip st={statusOf(p)} /></td><td className="r">{can('productEdit') && <button className="btn sm" onClick={() => edit(p)}>{L('แก้ไข', 'Edit')}</button>}</td></tr>)
          : <tr><td colSpan="12"><Empty title={L('ไม่พบสินค้าที่ค้นหา', 'No products found')} sub={L('ลองเปลี่ยนคำค้นหาหรือตัวกรองดูนะคะ', 'Try a different search or filter.')} /></td></tr>}</tbody>
      </table></div>
    </Panel>
  );
}

/* ---------- add / edit form with per-field errors ---------- */
function ProductForm({ p, onClose, toast }) {
  const { go } = useRoute(), isNew = !p, lockPrice = !isNew && !can('productPrice'), hist = p && hasSales(p.sku);
  const nextSku = () => { let n = S.products.length + 1; while (S.products.some(x => x.sku === 'SKU-' + String(n).padStart(3, '0'))) n++; return 'SKU-' + String(n).padStart(3, '0'); };
  const [f, setF] = useState(() => p ? { ...p, icon: p.icon || '', est: p.est || '' } : { sku: nextSku(), name: '', cat: '', sup: (S.suppliers[0] || {}).id || "", cost: '', price: '', stock: 0, inc: 0, min: '', safety: '', lead: 7, est: '', icon: '' });
  const [errs, setErrs] = useState({});
  const set = k => e => { const v = e.target.value; setF(o => ({ ...o, [k]: v })); setErrs(er => (er[k] ? { ...er, [k]: undefined } : er)); };
  const num = k => (f[k] === '' ? NaN : Number(f[k]));
  const margin = num('price') > 0 && !isNaN(num('cost')) ? ((num('price') - num('cost')) / num('price') * 100) : null;
  const submit = e => {
    e.preventDefault();
    const er = {}, sku = String(f.sku).trim().toUpperCase();
    if (!sku) er.sku = L('กรอก SKU', 'Enter a SKU.'); else if (isNew && S.products.some(x => x.sku === sku)) er.sku = L(`${sku} มีอยู่แล้ว`, `${sku} already exists.`);
    if (!String(f.name).trim()) er.name = L('กรอกชื่อสินค้า', 'Enter a product name.');
    if (!String(f.cat).trim()) er.cat = L('กรอกหมวดหมู่', 'Enter a category.');
    ['cost', 'stock', 'inc', 'min', 'safety'].forEach(k => { if (isNaN(num(k)) || num(k) < 0) er[k] = L('กรอกตัวเลข 0 ขึ้นไป', 'Enter a number, 0 or more.'); });
    if (isNaN(num('price')) || num('price') <= 0) er.price = L('กรอกราคาขายมากกว่า 0', 'Enter a price above 0.');
    if (isNaN(num('lead')) || num('lead') < 1) er.lead = L('อย่างน้อย 1 วัน', 'At least 1 day.');
    setErrs(er); if (Object.keys(er).length) { const k = Object.keys(er)[0]; setTimeout(() => { const el = document.getElementById('pf_' + k); if (el) el.focus(); }, 0); return; }
    const d = { sku, name: String(f.name).trim(), cat: String(f.cat).trim(), sup: f.sup, cost: num('cost'), price: num('price'), stock: num('stock'), inc: num('inc'), min: num('min'), safety: num('safety'), lead: num('lead'), icon: String(f.icon).trim() };
    if (!hist) d.est = f.est === '' ? 0 : Number(f.est);
    saveProduct(d, p && p.sku); onClose();
    const warn = d.price < d.cost ? L(' (หมายเหตุ: ราคาขายต่ำกว่าต้นทุน)', ' Note: price is below cost.') : d.safety < d.min ? L(' (หมายเหตุ: Safety Stock ต่ำกว่า Min Stock)', ' Note: safety stock is below minimum.') : '';
    toast((p ? L('บันทึกข้อมูลสินค้าสำเร็จ: ', 'Product saved: ') : L('เพิ่มสินค้าสำเร็จ: ', 'Product added: ')) + d.name + warn);
  };
  const del = () => { const gone = deleteProduct(p.sku); onClose(); go('products'); toast(L('ลบสินค้าแล้ว: ', 'Product deleted: ') + p.name, { label: L('เลิกลบ', 'Undo'), fn: () => restoreProduct(gone) }); };
  const I = (k, label, extra = {}, hint) => <Field id={'pf_' + k} label={label} error={errs[k]} hint={hint} full={extra.full}><input className="inp" id={'pf_' + k} value={f[k]} onChange={set(k)} aria-invalid={!!errs[k]} {...extra.attrs} /></Field>;
  return (
    <form onSubmit={submit} noValidate>
      <div className="modal-h"><h2>{isNew ? L('เพิ่มสินค้า', 'Add product') : L('แก้ไข ', 'Edit ') + p.name}</h2><button type="button" className="btn sm ghost" onClick={onClose} aria-label={L('ปิด', 'Close')}>✕</button></div>
      <div className="modal-b"><div className="formgrid">
        {I('sku', 'SKU', { attrs: { readOnly: !isNew } })}{I('name', L('ชื่อสินค้า', 'Product name'), { attrs: { autoFocus: true } })}
        <Field id="pf_cat" label={L('หมวดหมู่', 'Category')} error={errs.cat}><input className="inp" id="pf_cat" list="cats" value={f.cat} onChange={set('cat')} aria-invalid={!!errs.cat} /><datalist id="cats">{categories().map(c => <option key={c} value={c} />)}</datalist></Field>
        <Field id="pf_sup" label="Supplier"><select className="inp" id="pf_sup" value={f.sup} onChange={set('sup')}>{S.suppliers.map(s => <option key={s.id} value={s.id}>{s.id} · {s.company}</option>)}</select></Field>
        {I('cost', L('ต้นทุน (฿)', 'Cost (฿)'), { attrs: { type: 'number', min: 0, step: '0.01', readOnly: lockPrice } }, lockPrice ? L('เปลี่ยนได้เฉพาะเจ้าของร้าน', 'Only the owner can change this') : '')}
        {I('price', L('ราคาขาย (฿)', 'Selling price (฿)'), { attrs: { type: 'number', min: 0, step: '0.01', readOnly: lockPrice } }, lockPrice ? L('เปลี่ยนได้เฉพาะเจ้าของร้าน', 'Only the owner can change this') : margin != null ? L(`กำไรขั้นต้น ${margin.toFixed(0)}%`, `Gross margin ${margin.toFixed(0)}%`) : '')}
        {I('stock', L('สต๊อกปัจจุบัน', 'Current stock'), { attrs: { type: 'number', min: 0 } })}{I('inc', L('สต๊อกที่กำลังมา', 'Incoming stock'), { attrs: { type: 'number', min: 0, readOnly: !isNew } }, !isNew ? L('อัปเดตอัตโนมัติจากใบสั่งซื้อ', 'Updated by purchase orders') : '')}
        {I('min', 'Minimum Stock', { attrs: { type: 'number', min: 0 } }, L('ต่ำกว่านี้ = เสี่ยงของขาด', 'Below this = stockout risk'))}{I('safety', 'Safety Stock', { attrs: { type: 'number', min: 0 } }, L('สต๊อกกันเหนียว', 'Buffer stock'))}
        {I('lead', 'Lead Time (' + L('วัน', 'days') + ')', { attrs: { type: 'number', min: 1 } })}{I('icon', L('ไอคอน (อีโมจิ ไม่บังคับ)', 'Icon (emoji, optional)'), { attrs: { maxLength: 4 } })}
        {!hist && I('est', L('ยอดขายต่อวันที่คาดไว้ (ชิ้น)', 'Expected daily sales (units)'), { attrs: { type: 'number', min: 0 } }, L('สินค้าใหม่ยังไม่มีประวัติการขาย ใช้ตัวเลขนี้พยากรณ์ไปก่อน', 'New products have no history, so the forecast uses this for now.'))}
      </div></div>
      <div className="modal-f">{!isNew && can('productDelete') && <button type="button" className="btn danger" onClick={del} style={{ marginRight: 'auto' }}>{L('ลบสินค้า', 'Delete product')}</button>}<button type="button" className="btn" onClick={onClose}>{L('ยกเลิก', 'Cancel')}</button><button type="submit" className="btn primary">{L('บันทึก', 'Save')}</button></div>
    </form>
  );
}

/* ---------- product detail ---------- */
export function ProductDetail({ sku }) {
  const { go } = useRoute(), { open, close, toast } = useOverlay(), p = S.products.find(x => x.sku === sku);
  if (!p) return <Panel><Empty title={L('ไม่พบสินค้านี้', 'Product not found')}><button className="btn" onClick={() => go('products')}>{L('กลับไปหน้าสินค้า', 'Back to products')}</button></Empty></Panel>;
  const st = statusOf(p), pl = planFor(p), m = ensureModel(p.sku), h = salesOf(p.sku, 60), cs = chartSeries([p], 'units', 14, 30);
  const nm = { a: L('ยอดขายจริง', 'Actual'), f: L('โมเดลทดสอบย้อนหลัง 14 วัน', 'Model check'), c: 'AI forecast' };
  const fact = (k, v) => <div key={k}><span>{k}</span><b>{v}</b></div>;
  return (
    <div className="stack">
      <div><button className="btn sm" onClick={() => go('products')}>← {L('กลับไปหน้าสินค้า', 'Back to products')}</button></div>
      <Panel>
        <div className="pd-head">
          <ProductIcon p={p} big /><div><h2 style={{ fontSize: 22 }}>{p.name}</h2><p className="muted">{p.sku} · {p.cat} · {supplier(p.sup).company}</p><p style={{ marginTop: 6 }}><StatusChip st={st} /></p></div>
          {can('productEdit') ? <button className="btn" onClick={() => open(<ProductForm p={p} onClose={close} toast={toast} />)}>{L('แก้ไขสินค้า', 'Edit product')}</button> : <span />}
        </div>
        <div className="facts" style={{ marginTop: 16 }}>
          {fact(L('ต้นทุน', 'Cost'), baht2(p.cost))}{fact(L('ราคาขาย', 'Price'), baht2(p.price))}{fact(L('สต๊อกปัจจุบัน', 'Stock'), nf(p.stock))}{fact(L('กำลังมา', 'Incoming'), nf(p.inc))}
          {fact(L('ยอดขายเฉลี่ย/วัน', 'Avg daily sales'), nf1(avgSold(p)))}{fact('Min Stock', nf(p.min))}{fact('Safety Stock', nf(p.safety))}{fact('Lead Time', p.lead + ' ' + L('วัน', 'd'))}
          {fact(L('สต๊อกอยู่ได้', 'Stock lasts'), (pl.shelf >= 90 ? '90+' : nf1(pl.shelf)) + ' ' + L('วัน', 'd'))}{fact(L('ความแม่นยำโมเดล', 'Model accuracy'), m ? m.accuracy.toFixed(1) + '%' : '–')}
        </div>
        <div style={{ marginTop: 14, maxWidth: 420 }}><Gauge p={p} st={st} /><GaugeLegend /></div>
      </Panel>
      <div className="grid2e">
        <Panel title={L('ยอดขายย้อนหลัง (60 วัน)', 'Sales history (60 days)')}><Chart id="history" label={L('ยอดขายย้อนหลัง', 'Sales history')} series={[{ name: nm.a, color: 'var(--c-actual)', pts: h.dates.map((x, i) => ({ x, y: h.q[i] })) }]} /></Panel>
        <Panel title={L('พยากรณ์ 30 วัน', 'Forecast, 30 days')}><Chart id="pfc" label={L('พยากรณ์ 30 วัน', '30-day forecast')} divider={ASOF} series={[{ name: nm.a, color: 'var(--c-actual)', pts: cs.actual }, { name: nm.f, color: 'var(--c-fit)', dash: true, pts: cs.fit }, { name: nm.c, color: 'var(--c-fc)', pts: cs.fc, w: 2.8 }]} /></Panel>
      </div>
      <section><h2 style={{ marginBottom: 10 }}>{L('น้องพอดีสรุปว่าสินค้านี้ควรจัดการอย่างไร', 'What PorDee suggests for this product')}</h2>
        <AdviceCard x={{ p, st, pl }} full onPlan={sk => go('plan', sk)} onPo={no => go('po', no)} /></section>
    </div>
  );
}
