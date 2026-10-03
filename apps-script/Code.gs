/**
 * Nong PorDee AI – Google Sheets backend: sign-in, role permissions, create/update/delete, activity log.
 *
 * Setup (once):
 *   1. Open the spreadsheet > Extensions > Apps Script, replace Code.gs with this file.
 *   2. Change SECRET below to a long random phrase (it signs sign-in sessions; nobody needs to type it).
 *   3. Pick the function "setupSheet" in the toolbar and press Run. It adds the Users and Activity Log tabs,
 *      dropdowns and frozen headers. Run it again any time; it never deletes data.
 *   4. Deploy > New deployment > type "Web app", Execute as: Me, Who has access: Anyone > Deploy.
 *   5. Put the Web app URL (ends with /exec) in src/lib/config.js.
 * After changing this file: Deploy > Manage deployments > Edit > Version: New version > Deploy.
 *
 * Accounts live in the "8. Users" tab. To add a person or reset a password, type the new password as plain text
 * in the Password column; it is replaced with a hash the first time that person signs in. Untick Active to block someone.
 */
const SECRET = 'pordee-change-me';
const BUYER_PO_LIMIT = 20000;          // a buyer can send a PO up to this total (THB); keep in step with src/lib/perm.js
const SESSION_HOURS = 12;

const TABLES = {
  products: { sheet: '1. Product List', key: 'sku', cols: { sku: 'SKU', name: 'ชื่อสินค้า', cat: 'หมวดหมู่', sup: 'Supplier', cost: 'ต้นทุน (Cost)', price: 'ราคาขาย (Price)', stock: 'Current Stock', inc: 'Incoming Stock', min: 'Minimum Stock', safety: 'Safety Stock', lead: 'Lead Time (Days)', icon: 'Icon', est: 'Expected Daily Sales' } },
  suppliers: { sheet: '5. Supplier Info', key: 'id', cols: { id: 'Supplier ID', company: 'Company Name', contact: 'Contact Person', phone: 'Phone', email: 'Email', address: 'Address' } },
  pos: { sheet: '6. PO History', key: 'no', cols: { no: 'PO Number', date: 'Order Date', supplier: 'Supplier', total: 'Total Amount (THB)', eta: 'Expected Delivery', status: 'Status', supplierId: 'Supplier ID', note: 'Note', by: 'Created By', approvedBy: 'Sent By', receivedBy: 'Received By' } },
  lines: { sheet: '7. PO Lines', key: 'no', cols: { no: 'PO Number', sku: 'SKU', name: 'ชื่อสินค้า', qty: 'Quantity', price: 'Unit Price', ai: 'AI Quantity' } },
  users: { sheet: '8. Users', key: 'u', cols: { u: 'Username', pass: 'Password', name: 'Name', role: 'Role', active: 'Active' } },
  log: { sheet: '9. Activity Log', key: 'at', cols: { at: 'Time', u: 'User', role: 'Role', action: 'Action', ref: 'Reference', detail: 'Detail' } },
};
const ROLES = ['owner', 'manager', 'buyer'];
const PO_LABEL = { Draft: '📝 ร่าง (Draft)', Sent: '📤 ส่งแล้ว (Sent)', 'In transit': '🚚 กำลังจัดส่ง (Incoming)', Received: '✅ ได้รับสินค้าแล้ว' };
const statusKey = s => { s = String(s); return /draft|ร่าง/i.test(s) ? 'Draft' : /receiv|ได้รับ/i.test(s) ? 'Received' : /transit|incoming|จัดส่ง/i.test(s) ? 'In transit' : /sent|ส่ง/i.test(s) ? 'Sent' : 'Draft'; };
const num = v => (v === '' || v == null ? 0 : Number(v));

/* ---------- web app entry points ---------- */
function doGet(e) {
  return respond(() => { const me = session(e.parameter.token); return { me, products: readAll('products'), suppliers: readAll('suppliers'), pos: readPos() }; });
}
function doPost(e) {
  return respond(() => {
    const body = JSON.parse(e.postData.contents);
    if (body.login) return signIn(body.login.u, body.login.p);
    const me = session(body.token), lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try { (body.ops || []).forEach(op => apply(me, op)); SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
    return {};
  });
}
function respond(fn) {
  let out;
  CACHE = {};
  try { out = Object.assign({ ok: true }, fn()); } catch (err) { out = { ok: false, error: String((err && err.message) || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- accounts and sessions ---------- */
const hex = bytes => bytes.map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
const hashPass = (u, p) => hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SECRET + ':' + u + ':' + p, Utilities.Charset.UTF_8));
const sign = s => Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, SECRET));
const publicUser = r => ({ u: r.u, name: r.name || r.u, role: r.role });

function findUser(u) {
  u = String(u || '').trim().toLowerCase();
  const tb = table('users'), i = keys(tb).map(k => k.toLowerCase()).indexOf(u);
  if (i < 0) return null;
  const row = readRow(tb, i + 2);
  return Object.assign(row, { u: String(row.u).trim().toLowerCase(), role: String(row.role).trim().toLowerCase(), rn: i + 2, tb });
}
function signIn(u, p) {
  const r = findUser(u), bad = new Error('Wrong username or password');
  if (!r || r.active === false || String(r.active).toUpperCase() === 'FALSE' || ROLES.indexOf(r.role) < 0) throw bad;
  const stored = String(r.pass), isHash = /^[0-9a-f]{64}$/.test(stored);
  if (isHash ? stored !== hashPass(r.u, p) : stored !== String(p)) throw bad;
  if (!isHash) r.tb.sh.getRange(r.rn, r.tb.col.pass).setValue(hashPass(r.u, p));   // first sign-in replaces a typed password with its hash
  const payload = r.u + '|' + (Date.now() + SESSION_HOURS * 3600e3);
  log(r, 'sign in', r.u, '');
  return { token: Utilities.base64EncodeWebSafe(payload) + '.' + sign(payload), user: publicUser(r) };
}
/** checks the token and re-reads the user, so a changed role or an unticked Active applies at once */
function session(token) {
  const parts = String(token || '').split('.');
  const payload = parts.length === 2 ? Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString() : '';
  if (!payload || sign(payload) !== parts[1]) throw new Error('Not signed in');
  const [u, exp] = payload.split('|');
  if (Date.now() > Number(exp)) throw new Error('Session expired');
  const r = findUser(u);
  if (!r || r.active === false || String(r.active).toUpperCase() === 'FALSE' || ROLES.indexOf(r.role) < 0) throw new Error('Not signed in');
  return publicUser(r);
}

/* ---------- permissions (mirror of src/lib/perm.js) ---------- */
function deny(msg) { throw new Error('Not allowed: ' + msg); }
function apply(me, op) {
  const boss = me.role === 'owner' || me.role === 'manager';
  if (op.op === 'upsert' && op.table === 'products') {
    if (!boss) deny('only the owner or a manager can change products');
    const old = find('products', op.row.sku);
    if (me.role !== 'owner' && old && (num(old.cost) !== num(op.row.cost) || num(old.price) !== num(op.row.price))) deny('only the owner can change cost or price');
    const row = Object.assign({}, op.row);
    if (old) delete row.inc;   // incoming moves only through purchase orders
    upsert('products', row);
    log(me, old ? 'edit product' : 'add product', op.row.sku, op.row.name + (old && num(old.stock) !== num(op.row.stock) ? ` · stock count ${num(old.stock)} → ${num(op.row.stock)}` : ''));
  } else if (op.op === 'upsert' && op.table === 'suppliers') {
    upsert('suppliers', op.row);
    log(me, 'save supplier', op.row.id, op.row.company);
  } else if (op.op === 'delete' && (op.table === 'products' || op.table === 'suppliers')) {
    if (me.role !== 'owner') deny('only the owner can delete');
    remove(op.table, op.id);
    log(me, 'delete ' + op.table.slice(0, -1), op.id, '');
  } else if (op.op === 'savePo') savePo(me, op.po, boss);
  else if (op.op === 'deletePo') {
    const old = find('pos', op.no);
    if (old && statusKey(old.status) !== 'Draft' && me.role !== 'owner') deny('only drafts can be deleted');
    remove('pos', op.no); remove('lines', op.no);
    log(me, 'delete PO', op.no, '');
  } else throw new Error('Unknown op: ' + op.op);
}
const NEXT = { Draft: ['Draft', 'Sent'], Sent: ['Sent', 'In transit', 'Received'], 'In transit': ['In transit', 'Received'], Received: [] };
function savePo(me, po, boss) {
  const old = find('pos', po.no), from = old ? statusKey(old.status) : 'Draft', to = po.status;
  if (NEXT[from].indexOf(to) < 0) deny(`a PO can not go from ${from} to ${to}`);
  const oldLines = readAll('lines').filter(l => l.no === po.no);
  const lines = from === 'Draft' && po.lines ? po.lines : oldLines;           // only drafts can change their lines
  const total = lines.length ? Math.round(lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0) * 100) / 100 : num(old ? old.total : po.total);
  if (to === 'Sent' && from === 'Draft' && !boss && total > BUYER_PO_LIMIT) deny(`orders over ฿${BUYER_PO_LIMIT} need a manager or the owner to send`);
  if (to === 'Received' && !boss) deny('only the owner or a manager can receive goods');
  const row = { no: po.no, date: po.date, supplier: po.supplier, supplierId: po.supplierId, total, eta: po.eta, status: poLabel(table('pos'), to), note: po.note };
  if (!old) row.by = me.u;
  if (to === 'Sent' && from === 'Draft') row.approvedBy = me.u;
  if (to === 'Received') row.receivedBy = me.u;
  if (from !== 'Draft') { delete row.eta; delete row.date; delete row.supplier; delete row.supplierId; }
  upsert('pos', row);
  if (from === 'Draft' && po.lines) { remove('lines', po.no); appendRows('lines', po.lines.map(l => Object.assign({}, l, { no: po.no }))); }
  // stock moves with the order: sending adds to incoming, receiving moves incoming into stock
  if (from === 'Draft' && to === 'Sent') moveStock(lines, (p, q) => ({ inc: num(p.inc) + q }));
  if (to === 'Received' && from !== 'Received') moveStock(lines, (p, q) => ({ inc: Math.max(0, num(p.inc) - q), stock: num(p.stock) + q }));
  log(me, from === to ? (old ? 'edit PO' : 'create PO') : `PO ${from} → ${to}`, po.no, '฿' + total.toLocaleString('en-US'));
}
function moveStock(lines, fn) {
  lines.forEach(l => { const p = find('products', l.sku); if (p) upsert('products', Object.assign({ sku: l.sku }, fn(p, num(l.qty)))); });
}
function log(me, action, ref, detail) {
  appendRows('log', [{ at: new Date(), u: me.u, role: me.role, action, ref, detail }]);
}

/* ---------- table helpers ---------- */
let CACHE = {};
function table(name) {
  if (CACHE[name]) return CACHE[name];
  const t = TABLES[name], sh = SpreadsheetApp.getActive().getSheetByName(t.sheet);
  if (!sh) throw new Error('Missing tab: ' + t.sheet + ' (run setupSheet once)');
  const head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(h => String(h).trim());
  Object.keys(t.cols).forEach(f => { if (head.indexOf(t.cols[f]) < 0) { sh.getRange(1, head.length + 1).setValue(t.cols[f]); head.push(t.cols[f]); } });
  const col = {};
  Object.keys(t.cols).forEach(f => { col[f] = head.indexOf(t.cols[f]) + 1; });
  return (CACHE[name] = { t, sh, col, width: head.length });
}
function keys(tb) {
  const n = tb.sh.getLastRow() - 1;
  return n > 0 ? tb.sh.getRange(2, tb.col[tb.t.key], n).getValues().map(r => String(r[0]).trim()) : [];
}
function toRow(tb, r) {
  const tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone(), o = {};
  Object.keys(tb.col).forEach(f => { const v = r[tb.col[f] - 1]; o[f] = Object.prototype.toString.call(v) === '[object Date]' ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : v; });
  return o;
}
const readRow = (tb, rn) => toRow(tb, tb.sh.getRange(rn, 1, 1, tb.width).getValues()[0]);
function readAll(name) {
  const tb = table(name), n = tb.sh.getLastRow() - 1;
  if (n < 1) return [];
  return tb.sh.getRange(2, 1, n, tb.width).getValues().map(r => toRow(tb, r)).filter(o => String(o[tb.t.key]).trim() !== '');
}
function find(name, id) { const tb = table(name), i = keys(tb).indexOf(String(id).trim()); return i < 0 ? null : readRow(tb, i + 2); }
function readPos() {
  const by = {};
  readAll('lines').forEach(l => (by[l.no] = by[l.no] || []).push(l));
  return readAll('pos').map(p => Object.assign(p, { status: statusKey(p.status), lines: by[p.no] || null }));
}
/** writes the given fields into one row in a single call; formula cells are kept as formulas */
function writeRow(tb, rn, row) {
  const rg = tb.sh.getRange(rn, 1, 1, tb.width), vals = rg.getValues()[0], fs = rg.getFormulas()[0];
  Object.keys(tb.col).forEach(f => { const i = tb.col[f] - 1; if (f in row && !fs[i]) vals[i] = row[f] == null ? '' : row[f]; });
  rg.setValues([vals.map((v, i) => fs[i] || v)]);
}
/** update the row with this key, or fill the first empty row (copying formulas from the row above) */
function upsert(name, row) {
  const tb = table(name), ks = keys(tb);
  let i = ks.indexOf(String(row[tb.t.key]).trim());
  if (i < 0) { i = ks.indexOf(''); if (i < 0) i = ks.length; copyFormulas(tb, i + 2); }
  writeRow(tb, i + 2, row);
}
function appendRows(name, rows) {
  if (!rows.length) return;
  const tb = table(name), start = keys(tb).length + 2, out = rows.map(row => { const a = new Array(tb.width).fill(''); Object.keys(tb.col).forEach(f => { if (f in row) a[tb.col[f] - 1] = row[f] == null ? '' : row[f]; }); return a; });
  tb.sh.getRange(start, 1, out.length, tb.width).setValues(out);
}
function remove(name, id) {
  const tb = table(name), ks = keys(tb);
  for (let i = ks.length - 1; i >= 0; i--) if (ks[i] === String(id).trim()) tb.sh.deleteRow(i + 2);
}
function copyFormulas(tb, rn) {
  if (rn <= 2) return;
  const above = tb.sh.getRange(rn - 1, 1, 1, tb.width).getFormulasR1C1()[0], here = tb.sh.getRange(rn, 1, 1, tb.width).getFormulas()[0];
  above.forEach((f, i) => { if (f && !here[i]) tb.sh.getRange(rn, i + 1).setFormulaR1C1(f); });
}
/** prefer the matching option from the Status dropdown, if the column has one */
function poLabel(tb, st) {
  const rule = tb.sh.getRange(2, tb.col.status).getDataValidation();
  if (rule && rule.getCriteriaType() === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) {
    const hit = rule.getCriteriaValues()[0].find(o => statusKey(o) === st);
    if (hit) return hit;
  }
  return PO_LABEL[st] || st;
}

/* ---------- one-time sheet setup (run from the Apps Script editor) ---------- */
function setupSheet() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABLES).forEach(name => {
    const t = TABLES[name];
    if (!ss.getSheetByName(t.sheet)) ss.insertSheet(t.sheet).getRange(1, 1, 1, Object.keys(t.cols).length).setValues([Object.keys(t.cols).map(f => t.cols[f])]);
    const tb = table(name);
    tb.sh.setFrozenRows(1);
    tb.sh.getRange(1, 1, 1, tb.width).setFontWeight('bold').setBackground('#eef6f0');
  });
  const users = table('users'), rows = Math.max(200, users.sh.getMaxRows()) - 1;
  if (!keys(users).filter(String).length) appendRows('users', [
    { u: 'owner', pass: 'owner123', name: 'คุณณภัทร', role: 'owner', active: true },
    { u: 'manager', pass: 'manager123', name: 'คุณพิม', role: 'manager', active: true },
    { u: 'buyer', pass: 'buyer123', name: 'คุณอาร์ม', role: 'buyer', active: true },
  ]);
  users.sh.getRange(2, users.col.role, rows).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ROLES, true).build());
  users.sh.getRange(2, users.col.active, rows).insertCheckboxes();
  const pos = table('pos');
  pos.sh.getRange(2, pos.col.status, Math.max(500, pos.sh.getMaxRows()) - 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(Object.values(PO_LABEL), true).build());
  const prod = table('products'), sup = table('suppliers');
  prod.sh.getRange(2, prod.col.sup, Math.max(200, prod.sh.getMaxRows()) - 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sup.sh.getRange(2, sup.col.id, Math.max(100, sup.sh.getMaxRows()) - 1), true).setAllowInvalid(true).build());
  table('log').sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
}
