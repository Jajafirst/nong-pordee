// What each role may do. The Apps Script (apps-script/Code.gs, apply/savePo) enforces the same rules on the sheet;
// this copy only decides what the screens offer.
import { userOf } from './accounts';
import { L } from './i18n';

export const BUYER_PO_LIMIT = 20000;   // THB; keep in step with Code.gs
const RULES = {
  productEdit: ['owner', 'manager'],     // add products, edit stock levels, min / safety / lead time
  productPrice: ['owner'],               // change cost or selling price of an existing product
  productDelete: ['owner'],
  supplierEdit: ['owner', 'manager', 'buyer'],
  supplierDelete: ['owner'],
  poSendAny: ['owner', 'manager'],       // send a PO of any size (buyers up to BUYER_PO_LIMIT)
  poReceive: ['owner', 'manager'],       // receiving goods adds to stock
  resetData: ['owner'],
  viewLog: ['owner', 'manager'],
  viewSales: ['owner', 'manager'],       // revenue and gross profit (Sales page, sales report, dashboard revenue)
  whatIf: ['owner', 'manager'],          // change forecast inputs and festival / promotion what-ifs (the plan follows them)
  exportData: ['owner', 'manager'],      // download the full workbook (includes sales and profit)
};
// pages each role can open; sub-pages (product detail, PO editor) follow their parent page
const PAGES = { sales: 'viewSales' };
const PARENT = { detail: 'products', po: 'orders' };
export const canSee = page => { const k = PAGES[PARENT[page] || page]; return !!userOf() && (!k || can(k)); };
export const can = k => { const u = userOf(); return !!u && RULES[k].includes(u.roleKey); };
export const canSend = total => can('poSendAny') || total <= BUYER_PO_LIMIT;

/** plain-language list for the Settings page */
export const permList = () => [
  [can('productEdit'), L('เพิ่มและแก้ไขสินค้า (สต๊อก, Min, Safety, Lead time)', 'Add and edit products (stock, min, safety, lead time)')],
  [can('productPrice'), L('เปลี่ยนต้นทุนและราคาขาย', 'Change cost and selling price')],
  [can('productDelete'), L('ลบสินค้าและ Supplier', 'Delete products and suppliers')],
  [can('supplierEdit'), L('เพิ่มและแก้ไข Supplier', 'Add and edit suppliers')],
  [true, L('สร้าง แก้ไข และลบร่างใบสั่งซื้อ', 'Create, edit and delete draft orders')],
  [can('poSendAny') || 'limit', can('poSendAny') ? L('ส่งใบสั่งซื้อได้ทุกยอด', 'Send orders of any size') : L(`ส่งใบสั่งซื้อได้ไม่เกิน ฿${BUYER_PO_LIMIT.toLocaleString('en-US')} (เกินนี้ให้ผู้จัดการหรือเจ้าของส่ง)`, `Send orders up to ฿${BUYER_PO_LIMIT.toLocaleString('en-US')} (larger ones go to a manager or the owner)`)],
  [can('poReceive'), L('รับของเข้าสต๊อก', 'Receive goods into stock')],
  [can('viewSales'), L('ดูยอดขาย กำไร และรายงานยอดขาย', 'See sales, profit and the sales report')],
  [can('whatIf'), L('ปรับสถานการณ์ What-if ในหน้า Demand Forecast', 'Change what-if scenarios on Demand Forecast')],
  [can('viewLog'), L('ดูบันทึกการใช้งาน และส่งออก Excel', 'See the activity log and export to Excel')],
];
