// Builds the workbook download: same tabs and column names as the original Excel file, from the app's current data.
import RAW from '../data/raw.json';
import { S, ASOF, HIST_START } from './store';
import { statusOf, planFor, reasonFor, forecast, STATUS } from './engine';
import { ROLES } from './accounts';
import { addDays } from './util';
import { xlsx, download } from './xlsx';

const PO_LABEL = { Draft: '📝 ร่าง (Draft)', Sent: '📤 ส่งแล้ว (Sent)', 'In transit': '🚚 กำลังจัดส่ง (Incoming)', Received: '✅ ได้รับสินค้าแล้ว' };
const r2 = n => Math.round(n * 100) / 100;

export function workbook() {
  const P = S.products;
  const products = [['SKU', 'ชื่อสินค้า', 'หมวดหมู่', 'Supplier', 'ต้นทุน (Cost)', 'ราคาขาย (Price)', 'Current Stock', 'Incoming Stock', 'Minimum Stock', 'Safety Stock', 'Lead Time (Days)', 'Status', 'AI Forecast (30 Days)', 'Recommended Order', 'AI Reason', 'Icon', 'Expected Daily Sales'],
    ...P.map(p => { const pl = planFor(p); return [p.sku, p.name, p.cat, p.sup, p.cost, p.price, p.stock, p.inc, p.min, p.safety, p.lead, STATUS[statusOf(p)].th, pl.f30, pl.rec, reasonFor(p, pl), p.icon || '', p.est || '']; })];
  const sales = [['Date', 'SKU', 'ชื่อสินค้า', 'Quantity', 'Promotion', 'Festival', 'ราคาขาย (Price)', 'Revenue']];
  P.forEach(p => { const h = RAW.sales[p.sku]; if (h) h.q.forEach((q, i) => sales.push([addDays(HIST_START, i), p.sku, p.name, q, h.p[i] ? 'Yes' : 'No', h.f[i] ? 'Yes' : 'No', h.price, r2(q * h.price)])); });
  const fc = [['Date', 'SKU', 'ชื่อสินค้า', 'Forecast Quantity']];
  P.forEach(p => forecast(p, 30).forEach(x => fc.push([x.date, p.sku, p.name, x.v])));
  const plan = [['SKU', 'ชื่อสินค้า', 'Supplier', 'Current Stock', 'Incoming Stock', 'AI Forecast (30 Days)', 'Safety Stock', 'Recommended Order', 'ต้นทุน (Cost)', 'Estimated Cost', 'Order By Date'],
    ...P.map(p => { const pl = planFor(p); return [p.sku, p.name, p.sup, p.stock, p.inc, pl.f30, p.safety, pl.rec, p.cost, r2(pl.cost), pl.orderBy]; })];
  const sup = [['Supplier ID', 'Company Name', 'Contact Person', 'Phone', 'Email', 'Address'], ...S.suppliers.map(s => [s.id, s.company, s.contact, s.phone, s.email, s.address])];
  const pos = [['PO Number', 'Order Date', 'Supplier', 'Total Amount (THB)', 'Expected Delivery', 'Status', 'Supplier ID', 'Note', 'Created By', 'Sent By', 'Received By'],
    ...S.pos.map(p => [p.no, p.date, p.supplier, r2(p.total), p.eta, PO_LABEL[p.status] || p.status, p.supplierId || (S.suppliers.find(s => s.company === p.supplier) || {}).id || '', p.note || '', p.by || '', p.approvedBy || '', p.receivedBy || ''])];
  const lines = [['PO Number', 'SKU', 'ชื่อสินค้า', 'Quantity', 'Unit Price', 'AI Quantity'], ...S.pos.flatMap(p => (p.lines || []).map(l => [p.no, l.sku, l.name, l.qty, l.price, l.ai == null ? '' : l.ai]))];
  const log = [['Time', 'User', 'Role', 'Action', 'Reference', 'Detail'], ...S.log.map(e => [e.at, e.name || e.u, (ROLES[e.role] || [e.role])[0], e.action, e.ref, e.detail])];
  return xlsx([
    { name: '1. Product List', rows: products }, { name: '2. Sales History', rows: sales }, { name: '3. Demand Forecast', rows: fc }, { name: '4. Purchase Planning', rows: plan },
    { name: '5. Supplier Info', rows: sup }, { name: '6. PO History', rows: pos }, { name: '7. PO Lines', rows: lines }, { name: '8. Activity Log', rows: log },
  ]);
}
export const downloadWorkbook = () => download(`NongPorDee_${ASOF}_exported-${new Date().toISOString().slice(0, 10)}.xlsx`, workbook());
