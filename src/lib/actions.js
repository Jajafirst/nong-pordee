// All state changes live here so pages stay presentational.
import { S, update } from './store';
import { buildDrafts, nextPoNo, poLineTotal } from './engine';
import { push } from './sheet';
import { download } from './xlsx';

const me = () => (S.user || {}).u || '';
const stamp = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16).replace('T', ' '); };
const baht = n => '฿' + Math.round(n).toLocaleString('en-US');
/** adds an activity log row inside an update(); kept to the latest 1,000 */
const logIt = (s, action, ref, detail = '') => { const u = S.user || {}; s.log.unshift({ at: stamp(), u: u.u || '', name: u.name || u.u || '', role: u.role || '', action, ref, detail }); s.log.length = Math.min(s.log.length, 1000); };

const productOp = sku => ({ op: 'upsert', table: 'products', row: S.products.find(p => p.sku === sku) });
const poOp = no => ({ op: 'savePo', po: S.pos.find(p => p.no === no) });

export const createDraftPos = skus => { const nos = [], drafts = buildDrafts(skus); update(s => { drafts.forEach(d => { const no = nextPoNo(); s.pos.unshift({ ...d, no, by: me() }); nos.push(no); logIt(s, 'สร้างใบสั่งซื้อ (Create PO)', no, `${d.supplier} · ${baht(d.total)}`); }); }); push(...nos.map(poOp)); return nos; };
export function commitPo(po, status) {
  update(s => {
    const i = s.pos.findIndex(p => p.no === po.no), before = s.pos[i], next = { ...po, status: status || po.status };
    if (next.status === 'Sent' && before.status === 'Draft') next.approvedBy = me();
    if (next.status === 'Received' && before.status !== 'Received') next.receivedBy = me();
    if (next.lines) {
      next.lines = next.lines.map(l => ({ ...l, qty: +l.qty, price: +l.price })); next.total = Math.round(poLineTotal(next) * 100) / 100;
      const adj = f => next.lines.forEach(l => { const p = s.products.find(x => x.sku === l.sku); if (p) f(p, l.qty); });
      if (status === 'Sent') adj((p, q) => { p.inc += q; });
      if (status === 'Received' && before.status !== 'Draft') adj((p, q) => { p.inc = Math.max(0, p.inc - q); p.stock += q; });
    }
    s.pos[i] = next;
    const TH = { Draft: 'แก้ไขร่าง (Edit draft)', Sent: 'ส่งใบสั่งซื้อ (Send PO)', 'In transit': 'กำลังจัดส่ง (In transit)', Received: 'รับของเข้าสต๊อก (Receive goods)' };
    logIt(s, before.status === next.status ? TH.Draft : TH[next.status], next.no, `${next.supplier} · ${baht(next.total)}`);
  });
  push(poOp(po.no));   // the sheet moves incoming and stock itself when a PO is sent or received
}
export function deletePo(no) { let gone; update(s => { gone = s.pos.find(p => p.no === no); s.pos = s.pos.filter(p => p.no !== no); logIt(s, 'ลบร่างใบสั่งซื้อ (Delete draft)', no); }); push({ op: 'deletePo', no }); return gone; }
export const restorePo = po => { update(s => { s.pos.push(po); s.pos.sort((a, b) => b.no.localeCompare(a.no)); logIt(s, 'เลิกลบใบสั่งซื้อ (Undo delete)', po.no); }); push(poOp(po.no)); };
export function saveProduct(d, orig) {
  update(s => {
    const old = orig && s.products.find(x => x.sku === orig), notes = [];
    if (old) { if (old.stock !== d.stock) notes.push(`นับสต๊อก ${old.stock} → ${d.stock}`); if (old.cost !== d.cost || old.price !== d.price) notes.push(`ราคา ${old.cost}/${old.price} → ${d.cost}/${d.price}`); Object.assign(old, d); }
    else s.products.push({ est: 0, ...d });
    logIt(s, old ? 'แก้ไขสินค้า (Edit product)' : 'เพิ่มสินค้า (Add product)', d.sku, [d.name, ...notes].join(' · '));
  });
  push(productOp(d.sku));
}
export function deleteProduct(sku) { let gone; update(s => { gone = s.products.find(p => p.sku === sku); s.products = s.products.filter(p => p.sku !== sku); logIt(s, 'ลบสินค้า (Delete product)', sku, gone.name); }); push({ op: 'delete', table: 'products', id: sku }); return gone; }
export const restoreProduct = p => { update(s => { s.products.push(p); logIt(s, 'เลิกลบสินค้า (Undo delete)', p.sku, p.name); }); push(productOp(p.sku)); };
export function saveSupplier(d, orig) { update(s => { if (orig) Object.assign(s.suppliers.find(x => x.id === orig), d); else s.suppliers.push(d); logIt(s, orig ? 'แก้ไข Supplier (Edit supplier)' : 'เพิ่ม Supplier (Add supplier)', d.id, d.company); }); push({ op: 'upsert', table: 'suppliers', row: d }); }
export function deleteSupplier(id) { let gone; update(s => { gone = s.suppliers.find(x => x.id === id); s.suppliers = s.suppliers.filter(x => x.id !== id); logIt(s, 'ลบ Supplier (Delete supplier)', id, gone.company); }); push({ op: 'delete', table: 'suppliers', id }); return gone; }
export const restoreSupplier = x => saveSupplier(x);
export const setFx = (k, v) => update(s => { s.fx[k] = v; });
export const setScenario = (k, v) => update(s => { s.scenario[k] = v; });
export const setPref = (k, v) => update(s => { s[k] = v; });
/** user: { u, name, role, token? } from the sheet, or a demo account */
export const login = (user, remember) => { const j = JSON.stringify(user); try { if (location.hash) history.replaceState(null, '', location.pathname); } catch (e) {}   // every sign-in starts on the dashboard
  try { sessionStorage.setItem('pordee.user', j); if (remember) localStorage.setItem('pordee.remember', j); } catch (e) {} update(s => { s.user = user; logIt(s, 'เข้าสู่ระบบ (Sign in)', user.u); }); };
export const logout = () => { try { sessionStorage.removeItem('pordee.user'); localStorage.removeItem('pordee.remember'); } catch (e) {} update(s => { s.user = null; }); };
export async function saveCsv(filename, text, toast) {
  const L2 = (a, b) => (S.lang === 'en' ? b : a);
  try {
    const d = window.claude && window.claude.use && await window.claude.use('downloads');
    if (d) await d.save({ filename, data: '\ufeff' + text }); else download(filename, '\ufeff' + text);
    toast(L2('บันทึกไฟล์ CSV สำเร็จ', 'CSV saved.'));
  } catch (e) { if (!e || e.code !== 'declined') toast(L2('บันทึกไฟล์ไม่สำเร็จ ลองอีกครั้งนะคะ', 'Could not save the file. Try again.')); }
}
export const canDownload = () => true;
