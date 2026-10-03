import { useState } from 'react';
import { S } from '../lib/store';
import { L, fmtDate } from '../lib/i18n';
import { supplier, poLineTotal, hasSales } from '../lib/engine';
import { commitPo, deletePo, restorePo } from '../lib/actions';
import { can, canSend, BUYER_PO_LIMIT } from '../lib/perm';
import { baht, baht2, nf, sum } from '../lib/util';
import { Panel, Chip, Seg, Empty, Mimg, Say, ProductIcon, useOverlay, Modal, Field } from '../components/ui';
import { useRoute } from '../router';

const PO_TH = { Draft: ['ร่าง (Draft)', 'Draft'], Sent: ['ส่งแล้ว', 'Sent'], 'In transit': ['กำลังจัดส่ง', 'In transit'], Received: ['รับของแล้ว', 'Received'] };
const PO_CLS = { Draft: 'neutral', Sent: 'sent', 'In transit': 'sent', Received: 'ok' };
export const poLabel = s => L(...PO_TH[s]);
export const PoChip = ({ s }) => <Chip cls={PO_CLS[s]}>{poLabel(s)}</Chip>;

export function Orders() {
  const { go, q } = useRoute(), [f, setF] = useState('all'), ql = q.trim().toLowerCase();
  const list = S.pos.filter(p => (f === 'all' || p.status === f) && (!ql || (p.no + p.supplier).toLowerCase().includes(ql))), open = S.pos.filter(p => p.status !== 'Received');
  const tabs = ['all', 'Draft', 'Sent', 'In transit', 'Received'];
  return (
    <div className="stack">
      <Panel><div className="sums"><div className="s"><b>{open.length}</b><span>{L('ใบสั่งซื้อที่ยังไม่ปิด', 'open orders')}</span></div><div className="s"><b>{baht(sum(open.map(p => p.total)))}</b><span>{L('มูลค่าที่ยังไม่ปิด', 'open order value')}</span></div><div className="s"><b>{S.pos.filter(p => p.status === 'Draft').length}</b><span>{L('ร่างที่รอยืนยัน', 'drafts waiting for you')}</span></div></div></Panel>
      <Panel>
        <div className="toolbar"><Seg value={f} onChange={setF} label={L('กรองใบสั่งซื้อ', 'Filter orders')} options={tabs.map(t => [t, `${t === 'all' ? L('ทั้งหมด', 'All') : poLabel(t)} (${t === 'all' ? S.pos.length : S.pos.filter(p => p.status === t).length})`])} /><span className="grow" /><button className="btn" onClick={() => go('plan')}>🛒 {L('ไปที่ Purchase Planning', 'Go to purchase planning')}</button></div>
        <div className="tbl-wrap"><table><thead><tr><th>PO</th><th>{L('วันที่สั่ง', 'Order date')}</th><th>Supplier</th><th className="r">{L('รายการ', 'Items')}</th><th className="r">{L('ยอดรวม', 'Total')}</th><th>{L('คาดว่าจะได้รับ', 'Expected delivery')}</th><th>{L('สถานะ', 'Status')}</th><th /></tr></thead>
          <tbody>{list.length ? list.map(p => <tr key={p.no}><td><button className="linkbtn" onClick={() => go('po', p.no)}>{p.no}</button></td><td>{fmtDate(p.date)}</td><td>{p.supplier}</td><td className="r">{p.lines ? p.lines.length : '–'}</td><td className="r"><b>{baht(p.total)}</b></td><td>{fmtDate(p.eta)}</td><td><PoChip s={p.status} /></td><td className="r"><button className="btn sm" onClick={() => go('po', p.no)}>{p.status === 'Draft' ? L('แก้ไข', 'Edit') : L('ดู', 'View')}</button></td></tr>)
            : <tr><td colSpan="8"><Empty title={L('ยังไม่มีใบสั่งซื้อ', 'No orders here yet')} sub={L('สร้างร่างใบสั่งซื้อจากหน้า Purchase Planning ได้เลยค่ะ', 'Create drafts from the purchase plan.')} /></td></tr>}</tbody></table></div>
      </Panel>
    </div>
  );
}

function SentModal({ po, onClose }) {
  return <Modal onClose={onClose} footer={<button className="btn primary" autoFocus onClick={onClose}>{L('เสร็จสิ้น', 'Done')}</button>}>
    <div className="confirm"><Mimg k="success" w={210} /><h2>{L('ส่งใบสั่งซื้อสำเร็จ!', 'Order sent!')}</h2><p className="muted">{po.no} {L('ส่งถึง', 'went to')} <b>{po.supplier}</b></p>
      <dl className="kv"><dt>{L('ยอดรวม', 'Total')}</dt><dd>{baht(po.total)}</dd><dt>{L('คาดว่าจะได้รับ', 'Expected delivery')}</dt><dd>{fmtDate(po.eta)}</dd>{po.lines && <><dt>{L('จำนวน', 'Items')}</dt><dd>{po.lines.length} {L('รายการ', 'products')} · {nf(sum(po.lines.map(l => l.qty)))} {L('ชิ้น', 'units')}</dd></>}</dl></div></Modal>;
}

/** the draft is edited locally and only written to the store on Save / Send */
export function PoEditor({ no }) {
  const { go } = useRoute(), { open, close, toast } = useOverlay(), src = S.pos.find(p => p.no === no);
  const [po, setPo] = useState(() => (src ? JSON.parse(JSON.stringify(src)) : null)), [err, setErr] = useState('');
  if (!src || !po) return <Panel><Empty title={L('ไม่พบใบสั่งซื้อนี้', 'Order not found')}><button className="btn" onClick={() => go('orders')}>{L('กลับไปรายการใบสั่งซื้อ', 'Back to orders')}</button></Empty></Panel>;
  const edit = po.status === 'Draft' && !!po.lines, s = supplier(po.supplierId || (S.suppliers.find(x => x.company === po.supplier) || {}).id);
  const steps = ['Draft', 'Sent', 'In transit', 'Received'], si = steps.indexOf(po.status);
  const setLine = (i, k, v) => setPo(o => ({ ...o, lines: o.lines.map((l, j) => (j === i ? { ...l, [k]: v === '' ? '' : +v } : l)) }));
  const validate = () => {
    if (!po.lines) return '';
    if (!po.lines.length) return L('เพิ่มสินค้าอย่างน้อย 1 รายการ หรือลบร่างนี้', 'Add at least one item, or delete this draft.');
    for (const l of po.lines) { if (!(+l.qty > 0) || !Number.isInteger(+l.qty)) return L(`กรอกจำนวนเป็นจำนวนเต็มมากกว่า 0 สำหรับ ${l.name}`, `Enter a whole-number quantity above 0 for ${l.name}.`); if (l.price === '' || !(+l.price >= 0)) return L(`กรอกราคาต่อหน่วยของ ${l.name}`, `Enter a unit price for ${l.name}.`); }
    if (po.eta < po.date) return L('วันที่คาดว่าจะได้รับของต้องไม่ก่อนวันที่สั่งซื้อ', 'Expected delivery can not be before the order date.');
    return '';
  };
  const guard = fn => () => { const e = validate(); if (e) { setErr(e); return; } fn(); };
  const save = guard(() => { commitPo(po); go('orders'); toast(L('บันทึก Draft แล้ว', 'Draft saved.')); });
  const send = guard(() => { commitPo(po, 'Sent'); const done = { ...po, total: poLineTotal(po) }; go('orders'); open(<SentModal po={done} onClose={close} />); });
  const del = () => { const gone = deletePo(po.no); go('orders'); toast(L('ลบร่าง ' + po.no + ' แล้ว', po.no + ' deleted.'), { label: L('เลิกลบ', 'Undo'), fn: () => restorePo(gone) }); };
  const move = st => () => { commitPo(po, st); go('orders'); toast(st === 'Received' ? (po.lines ? L(`รับของตามใบ ${po.no} แล้ว อัปเดตสต๊อกเรียบร้อย`, `${po.no} received. Stock updated.`) : L(`ปิดใบ ${po.no} แล้ว ใบนี้ไม่มีรายการสินค้า จึงไม่ได้เปลี่ยนสต๊อก ปรับสต๊อกเองที่หน้าสินค้าได้`, `${po.no} closed. It has no item lines, so stock did not change. Adjust stock on the product page.`)) : L('เปลี่ยนสถานะเป็นกำลังจัดส่งแล้ว', 'Marked in transit.')); };
  const total = po.lines ? poLineTotal(po) : po.total, sendOk = canSend(total), who = [[po.by, L('สร้างโดย', 'Created by')], [po.approvedBy, L('ส่งโดย', 'Sent by')], [po.receivedBy, L('รับของโดย', 'Received by')]].filter(x => x[0]);
  return (
    <div className="stack">
      <div><button className="btn sm" onClick={() => go('orders')}>← {L('กลับไปรายการใบสั่งซื้อ', 'Back to orders')}</button></div>
      <Panel title={`${L('ใบสั่งซื้อ (Purchase Order) – เลขที่', 'Purchase order –')} ${po.no}`} actions={<PoChip s={po.status} />}>
        {who.length > 0 && <p className="hint" style={{ marginBottom: 10 }}>{who.map(([u, t]) => `${t} ${u}`).join(' · ')}</p>}
        <ol className="steps" aria-label={L('ขั้นตอนใบสั่งซื้อ', 'Order progress')}>{steps.map((t, i) => <li key={t} className={i < si ? 'done' : i === si ? 'cur' : ''} aria-current={i === si ? 'step' : undefined}><span>{i < si ? '✓' : i + 1}</span>{poLabel(t)}</li>)}</ol>
        <div className="formgrid" style={{ marginBottom: 18 }}>
          <div><div className="lbl">{L('ส่งถึง Supplier', 'Send to supplier')}</div><div>🏢 <b>{po.supplier}</b></div><div className="th">{s.contact} · {s.phone} · {s.email}<br />{s.address}</div></div>
          <div className="formgrid"><div><div className="lbl">{L('วันที่สั่งซื้อ', 'Order date')}</div><div>{fmtDate(po.date)}</div></div>
            <Field id="poEta" label={L('วันที่คาดว่าจะได้รับของ', 'Expected delivery')}>{edit ? <input className="inp" id="poEta" type="date" value={po.eta} onChange={e => setPo({ ...po, eta: e.target.value })} /> : <div>{fmtDate(po.eta)}</div>}</Field></div>
        </div>
        <h3 style={{ marginBottom: 8 }}>{L('รายการสินค้าที่ AI แนะนำ', 'Items recommended by AI')}</h3>
        {po.lines ? <div className="tbl-wrap po-lines"><table>
          <thead><tr><th>#</th><th>{L('สินค้า', 'Product')}</th><th className="r">{L('จำนวน (แก้ได้)', 'Qty (editable)')}</th><th className="r">{L('ราคา/หน่วย (฿)', 'Unit price (฿)')}</th><th className="r">{L('รวมเงิน', 'Line total')}</th>{edit && <th />}</tr></thead>
          <tbody>{po.lines.map((l, i) => { const pr = S.products.find(x => x.sku === l.sku); return (
            <tr key={l.sku}><td>{i + 1}</td><td><div className="pcell">{pr && <ProductIcon p={pr} />}<span className="pname">{l.name}<small>{l.sku}</small></span></div></td>
              <td className="r">{edit ? <><input className="inp" type="number" min="1" step="1" value={l.qty} onChange={e => setLine(i, 'qty', e.target.value)} aria-label={`${L('จำนวน', 'Quantity')} ${l.name}`} />{l.ai != null && +l.qty !== l.ai && <div className="th"><button className="linkbtn" onClick={() => setLine(i, 'qty', l.ai)}>↺ {L(`ตามที่ AI แนะนำ (${nf(l.ai)})`, `Use AI quantity (${nf(l.ai)})`)}</button></div>}</> : `${nf(l.qty)} ${L('ชิ้น', 'u')}`}</td>
              <td className="r">{edit ? <input className="inp" type="number" min="0" step="0.01" value={l.price} onChange={e => setLine(i, 'price', e.target.value)} aria-label={`${L('ราคา/หน่วย', 'Unit price')} ${l.name}`} /> : baht2(l.price)}</td>
              <td className="r"><b>{baht((+l.qty || 0) * (+l.price || 0))}</b></td>{edit && <td className="r"><button className="btn sm ghost" onClick={() => setPo(o => ({ ...o, lines: o.lines.filter((_, j) => j !== i) }))} aria-label={`${L('ลบ', 'Remove')} ${l.name}`}>✕</button></td>}</tr>); })}</tbody>
          <tfoot><tr><td colSpan="2">{L('ยอดรวมทั้งสิ้น', 'Total')}</td><td className="r">{nf(sum(po.lines.map(l => +l.qty || 0)))} {L('ชิ้น', 'u')}</td><td /><td className="r">{baht(total)}</td>{edit && <td />}</tr></tfoot></table></div>
          : <div className="note">{L(`ใบสั่งซื้อนี้มาจากไฟล์ Excel ยอดรวม ${baht(po.total)} ไม่มีรายการสินค้าแยก`, `This order came from your workbook with a total of ${baht(po.total)} and no line items.`)}</div>}
        {edit && <Field id="poNote" label={L('หมายเหตุถึง Supplier (ไม่บังคับ)', 'Note to supplier (optional)')}><textarea className="inp" id="poNote" rows="2" value={po.note || ''} onChange={e => setPo({ ...po, note: e.target.value })} style={{ marginTop: 14 }} /></Field>}
        {edit && <Say>{L('น้องพอดีดึงข้อมูลมาให้ครบแล้ว ตรวจสอบความถูกต้องก่อนกดส่งนะคะ!', 'PorDee filled everything in. Please check it before you send!')}</Say>}
        <div className="err" role="alert" style={{ marginTop: 10 }}>{err}</div>
        <div className="actionbar">
          {edit && <button className="btn danger" onClick={del} style={{ marginRight: 'auto' }}>{L('ลบร่างนี้', 'Delete draft')}</button>}
          {edit && <button className="btn" onClick={save}>{L('บันทึก Draft', 'Save draft')}</button>}
          {po.status === 'Draft' && !sendOk && <span className="hint" style={{ maxWidth: 360 }}>{L(`ยอดเกิน ฿${nf(BUYER_PO_LIMIT)} บันทึก Draft ไว้ แล้วให้ผู้จัดการหรือเจ้าของร้านเป็นผู้ส่ง`, `Over ฿${nf(BUYER_PO_LIMIT)}: save the draft and a manager or the owner will send it.`)}</span>}
          {po.status === 'Draft' && <button className="btn primary" onClick={send} disabled={!sendOk}>{L('ยืนยันคำสั่งซื้อ (Send PO)', 'Confirm and send PO')}</button>}
          {po.status === 'Sent' && <button className="btn" onClick={move('In transit')}>{L('ทำเครื่องหมายกำลังจัดส่ง', 'Mark in transit')}</button>}
          {(po.status === 'Sent' || po.status === 'In transit') && (can('poReceive') ? <button className="btn primary" onClick={move('Received')}>{L('รับของแล้ว', 'Mark received')}</button> : <span className="hint">{L('ผู้จัดการหรือเจ้าของร้านเป็นผู้กดรับของ', 'A manager or the owner marks goods received.')}</span>)}
          {po.status === 'Received' && <span className="muted">{L('ใบสั่งซื้อนี้ปิดแล้ว', 'This order is complete.')}</span>}
        </div>
      </Panel>
    </div>
  );
}
