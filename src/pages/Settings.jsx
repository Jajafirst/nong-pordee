import { useState } from 'react';
import { S, resetData } from '../lib/store';
import { L } from '../lib/i18n';
import { setPref, logout, saveSupplier, deleteSupplier, restoreSupplier } from '../lib/actions';
import { connected } from '../lib/sheet';
import { can, permList } from '../lib/perm';
import { downloadWorkbook } from '../lib/exportBook';
import { ROLES } from '../lib/accounts';
import { userOf } from '../lib/accounts';
import { Panel, Seg, Avatar, Modal, Field, useOverlay } from '../components/ui';

function SupplierForm({ x, onClose, toast }) {
  const isNew = !x, [f, setF] = useState(() => x ? { ...x } : { id: '', company: '', contact: '', phone: '', email: '', address: '' }), [errs, setErrs] = useState({});
  const set = k => e => { const v = e.target.value; setF(o => ({ ...o, [k]: v })); setErrs(er => ({ ...er, [k]: undefined })); };
  const used = x ? S.products.filter(p => p.sup === x.id).length : 0;
  const submit = e => {
    e.preventDefault();
    const d = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, String(v).trim()])), er = {};
    if (!d.id) er.id = L('กรอกรหัส Supplier', 'Enter a supplier ID.'); else if (isNew && S.suppliers.some(s => s.id === d.id)) er.id = L(`${d.id} มีอยู่แล้ว`, `${d.id} already exists.`);
    if (!d.company) er.company = L('กรอกชื่อบริษัท', 'Enter a company name.');
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) er.email = L('รูปแบบอีเมลไม่ถูกต้อง', 'Check the email address.');
    setErrs(er); if (Object.keys(er).length) return;
    saveSupplier(d, x && x.id); onClose(); toast((isNew ? L('เพิ่ม Supplier แล้ว: ', 'Supplier added: ') : L('บันทึก Supplier แล้ว: ', 'Supplier saved: ')) + d.company);
  };
  const del = () => { const gone = deleteSupplier(x.id); onClose(); toast(L('ลบ Supplier แล้ว: ', 'Supplier deleted: ') + x.company, { label: L('เลิกลบ', 'Undo'), fn: () => restoreSupplier(gone) }); };
  const I = (k, label, attrs = {}, full) => <Field id={'sf_' + k} label={label} error={errs[k]} full={full}><input className="inp" id={'sf_' + k} value={f[k]} onChange={set(k)} aria-invalid={!!errs[k]} {...attrs} /></Field>;
  return (
    <form onSubmit={submit} noValidate>
      <div className="modal-h"><h2>{isNew ? L('เพิ่ม Supplier', 'Add supplier') : L('แก้ไข ', 'Edit ') + x.company}</h2><button type="button" className="btn sm ghost" onClick={onClose} aria-label={L('ปิด', 'Close')}>✕</button></div>
      <div className="modal-b"><div className="formgrid">
        {I('id', L('รหัส Supplier', 'Supplier ID'), { readOnly: !isNew, placeholder: 'Sup-F' })}{I('company', L('ชื่อบริษัท', 'Company'), { autoFocus: true })}
        {I('contact', L('ผู้ติดต่อ', 'Contact'))}{I('phone', L('โทรศัพท์', 'Phone'), { type: 'tel' })}
        {I('email', 'Email', { type: 'email' })}{I('address', L('ที่อยู่', 'Address'), {}, true)}
      </div>{used > 0 && can('supplierDelete') && <p className="hint" style={{ marginTop: 10 }}>{L(`มีสินค้า ${used} รายการใช้ Supplier นี้ จึงลบไม่ได้`, `${used} products use this supplier, so it can't be deleted.`)}</p>}</div>
      <div className="modal-f">{!isNew && can('supplierDelete') && <button type="button" className="btn danger" onClick={del} disabled={used > 0} style={{ marginRight: 'auto' }}>{L('ลบ Supplier', 'Delete supplier')}</button>}<button type="button" className="btn" onClick={onClose}>{L('ยกเลิก', 'Cancel')}</button><button type="submit" className="btn primary">{L('บันทึก', 'Save')}</button></div>
    </form>
  );
}

export default function Settings() {
  const { open, close, toast } = useOverlay(), me = userOf();
  const editSup = x => open(<SupplierForm x={x} onClose={close} toast={toast} />);
  const reset = () => open(<Modal title={L('รีเซ็ตข้อมูลเดโม?', 'Reset demo data?')} onClose={close} narrow footer={<><button className="btn" onClick={close}>{L('ยกเลิก', 'Cancel')}</button><button className="btn danger" onClick={() => { resetData(); close(); toast(L('คืนค่าข้อมูลตั้งต้นแล้ว', 'Demo data restored.')); }}>{L('รีเซ็ต', 'Reset')}</button></>}><p>{L('ระบบจะกลับไปใช้สินค้า สต๊อก และใบสั่งซื้อจากไฟล์ Excel ใบสั่งซื้อที่คุณสร้างไว้จะหายไป', 'This restores products, stock levels and orders from your workbook. Orders you created here will be removed.')}</p></Modal>);
  return (
    <div className="stack">
      <Panel title={L('การตั้งค่าทั่วไป', 'General')}><div className="stack" style={{ gap: 16 }}>
        <div className="field"><span className="lbl">{L('ภาษา', 'Language')}</span><Seg value={S.lang} onChange={v => setPref('lang', v)} options={[['th', 'ไทย'], ['en', 'English']]} /></div>
        <div className="field"><span className="lbl">{L('ธีม', 'Theme')}</span><Seg value={S.theme} onChange={v => setPref('theme', v)} options={[['auto', L('ตามอุปกรณ์', 'Auto')], ['light', L('สว่าง', 'Light')], ['dark', L('มืด', 'Dark')]]} /></div>
        <fieldset disabled={!can('whatIf')} className="stack" style={{ border: 0, padding: 0, margin: 0, minWidth: 0, gap: 16 }}>{!can('whatIf') && <p className="hint">{L('แหล่งพยากรณ์และเกณฑ์สต๊อกล้นมีผลกับทุกคน ปรับได้เฉพาะผู้จัดการหรือเจ้าของร้าน', 'Forecast source and the overstock limit affect everyone, so only a manager or the owner can change them.')}</p>}
        <div className="field"><span className="lbl">{L('แหล่งพยากรณ์', 'Forecast source')}</span><Seg value={S.src} onChange={v => setPref('src', v)} options={[['py', L('โมเดลสถิติ Python', 'Python stats model')], ['wb', L('ไฟล์ Excel', 'Excel file')]]} /><span className="hint">{L('โมเดลสถิติให้ช่วงความเชื่อมั่นและผลทดสอบย้อนหลัง ไฟล์ Excel คือผลพยากรณ์ 30 วันเดิม เปลี่ยนแล้วแผนสั่งซื้อจะคำนวณใหม่ทันที', 'The stats model adds ranges and backtests. The Excel file is your original 30-day forecast. The purchase plan recalculates when you switch.')}</span></div>
        <div className="field" style={{ maxWidth: 260 }}><label htmlFor="od2">{L('สต๊อกล้นเมื่ออยู่ได้เกิน (วัน)', 'Overstock when cover exceeds (days)')}</label><input className="inp" id="od2" type="number" min="7" max="365" defaultValue={S.overDays} onBlur={e => { const n = Math.round(+e.target.value); if (n >= 7) setPref('overDays', n); }} /></div>
        </fieldset>
        <div><div className="lbl" style={{ marginBottom: 4 }}>{L('บัญชีผู้ใช้', 'Account')}</div><div className="pcell"><Avatar /><div><b>{L(me.name, me.nameEn)}</b><div className="th">{L(me.role, me.roleEn)}</div></div><button className="btn sm" style={{ marginLeft: 14 }} onClick={logout}>{L('ออกจากระบบ', 'Sign out')}</button></div>
          <ul className="perms" aria-label={L('สิทธิ์ของคุณ', 'What you can do')}>{permList().map(([ok, t]) => <li key={t} className={ok ? '' : 'no'}><span aria-hidden="true">{ok === true ? '✓' : ok ? '◐' : '✕'}</span>{t}{!ok && <span className="sr-only"> {L('(ไม่มีสิทธิ์)', '(not allowed)')}</span>}</li>)}</ul></div>
      </div></Panel>
      <Panel title={L('รายชื่อ Supplier', 'Supplier directory')} actions={<button className="btn sm primary" onClick={() => editSup(null)}>＋ {L('เพิ่ม Supplier', 'Add supplier')}</button>}><div className="tbl-wrap"><table><thead><tr><th>ID</th><th>{L('บริษัท', 'Company')}</th><th>{L('ผู้ติดต่อ', 'Contact')}</th><th>{L('โทรศัพท์', 'Phone')}</th><th>Email</th><th>{L('ที่อยู่', 'Address')}</th><th /></tr></thead><tbody>{S.suppliers.map(s => <tr key={s.id}><td><b>{s.id}</b></td><td>{s.company}</td><td>{s.contact}</td><td>{s.phone}</td><td>{s.email}</td><td>{s.address}</td><td className="r"><button className="btn sm" onClick={() => editSup(s)}>{L('แก้ไข', 'Edit')}</button></td></tr>)}</tbody></table></div></Panel>
      {can('exportData') && <Panel title={L('ส่งออกเป็น Excel', 'Export to Excel')}>
        <p className="muted" style={{ marginBottom: 12 }}>{L('ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ .xlsx แท็บเหมือนไฟล์ Excel ต้นฉบับ: สินค้า ยอดขาย พยากรณ์ แผนจัดซื้อ Supplier ใบสั่งซื้อ รายการสินค้าในใบสั่งซื้อ และบันทึกการใช้งาน', 'Download everything as an .xlsx file with the same tabs as the original workbook: products, sales, forecast, purchase plan, suppliers, orders, order lines and the activity log.')}</p>
        <button className="btn primary" onClick={() => { try { downloadWorkbook(); toast(L('ดาวน์โหลดไฟล์ Excel แล้ว', 'Excel file downloaded.')); } catch (e) { toast(L('สร้างไฟล์ไม่สำเร็จ ลองอีกครั้งนะคะ', 'Could not create the file. Try again.')); } }}>⬇ {L('ดาวน์โหลด Excel (.xlsx)', 'Download Excel (.xlsx)')}</button>
      </Panel>}
      {can('viewLog') && <Panel title={L('บันทึกการใช้งาน (Activity log)', 'Activity log')}>{S.log.length
        ? <><div className="tbl-wrap"><table><thead><tr><th>{L('เวลา', 'Time')}</th><th>{L('ผู้ใช้', 'User')}</th><th>{L('การทำงาน', 'Action')}</th><th>{L('อ้างอิง', 'Reference')}</th><th>{L('รายละเอียด', 'Detail')}</th></tr></thead>
            <tbody>{S.log.slice(0, 50).map((e, i) => <tr key={i}><td style={{ whiteSpace: 'nowrap' }}>{e.at}</td><td>{e.name || e.u}<div className="th">{ROLES[e.role] ? L(...ROLES[e.role]) : e.role}</div></td><td>{e.action}</td><td><b>{e.ref}</b></td><td>{e.detail}</td></tr>)}</tbody></table></div>
            {S.log.length > 50 && <p className="hint" style={{ marginTop: 8 }}>{L(`แสดง 50 รายการล่าสุดจาก ${S.log.length} ดูทั้งหมดได้ในไฟล์ Excel`, `Showing the latest 50 of ${S.log.length}. The Excel file has all of them.`)}</p>}</>
        : <p className="muted">{L('ยังไม่มีการเปลี่ยนแปลง ทุกการแก้ไขจะถูกบันทึกที่นี่ว่าใครทำอะไร เมื่อไร', 'No changes yet. Every edit is recorded here with who did it and when.')}</p>}</Panel>}
      {!connected() && can('resetData') && <Panel title={L('ข้อมูลเดโม', 'Demo data')}><p className="muted" style={{ marginBottom: 12 }}>{L('ข้อมูลที่แก้ไขเก็บไว้ในเบราว์เซอร์นี้เท่านั้น รีเซ็ตเพื่อกลับไปใช้ข้อมูลตั้งต้นจากไฟล์ Excel', 'Edits are saved in this browser only. Reset to return to the workbook data.')}</p><button className="btn danger" onClick={reset}>{L('รีเซ็ตข้อมูลเดโม', 'Reset demo data')}</button></Panel>}
    </div>
  );
}
