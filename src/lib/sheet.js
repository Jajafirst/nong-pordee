// Google Sheets sync through the Apps Script web app in apps-script/Code.gs.
// signIn() checks a username and password against the "8. Users" tab and returns a session token.
// pull() replaces local products, suppliers and POs with the sheet. push() queues changes, sends them in order,
// and keeps them (in S.sheet.pending, each with the token of the person who made it) to retry if sending fails.
import { S, update } from './store';

const num = v => (v === '' || v == null ? 0 : Number(v));
const toProduct = r => ({ sku: String(r.sku).trim(), name: String(r.name), cat: String(r.cat), sup: String(r.sup), cost: num(r.cost), price: num(r.price), stock: num(r.stock), inc: num(r.inc), min: num(r.min), safety: num(r.safety), lead: num(r.lead) || 1, icon: String(r.icon || ''), est: num(r.est) });
const toSupplier = r => ({ id: String(r.id).trim(), company: String(r.company), contact: String(r.contact), phone: String(r.phone), email: String(r.email), address: String(r.address) });
const toPo = p => ({ no: String(p.no).trim(), date: String(p.date), supplier: String(p.supplier), supplierId: String(p.supplierId || ''), total: num(p.total), eta: String(p.eta), status: p.status, note: String(p.note || ''),
  by: String(p.by || ''), approvedBy: String(p.approvedBy || ''), receivedBy: String(p.receivedBy || ''),
  lines: p.lines && p.lines.map(l => ({ sku: String(l.sku), name: String(l.name), qty: num(l.qty), price: num(l.price), ai: l.ai === '' || l.ai == null ? null : num(l.ai) })) });

export const connected = () => !!S.sheet.url;
const setSync = (state, msg = '') => update(s => { s.sync = { state, msg, at: state === 'ok' ? Date.now() : s.sync.at }; });
const SESSION_GONE = /^(Not signed in|Session expired)/;

async function call(body, token) {
  const url = S.sheet.url;
  const r = body
    ? await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
    : await fetch(url + (url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token));
  let j;
  try { j = await r.json(); } catch (e) { throw new Error('The URL did not answer like the Apps Script web app'); }
  if (!j.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function endSession() {
  try { sessionStorage.removeItem('pordee.user'); localStorage.removeItem('pordee.remember'); } catch (e) {}
  update(s => { s.user = null; s.sync = { state: 'idle', msg: '', at: 0 }; });
}

/** resolves to { u, name, role, token } or throws with the server's message */
export async function signIn(u, p) {
  const j = await call({ login: { u, p } });
  if (!j.token || !j.user) throw new Error('the web app is running old code. Deploy the new apps-script/Code.gs (Deploy > Manage deployments > Edit > New version)');
  return { ...j.user, token: j.token };
}

let chain = Promise.resolve();
const serial = fn => (chain = chain.then(fn).catch(() => {}));

/** sends queued changes, one request per person who made them; true when nothing is left */
async function flush() {
  while (S.sheet.pending.length) {
    const token = S.sheet.pending[0].token, n = S.sheet.pending.findIndex(x => x.token !== token), batch = S.sheet.pending.slice(0, n < 0 ? undefined : n);
    setSync('saving');
    try { await call({ token, ops: batch.map(x => x.op) }); }
    catch (e) {
      // a refused change (no permission) is dropped so it can't block the queue; the next pull restores the sheet's data
      if (/^Not allowed/.test(e.message)) { update(s => { s.sheet.pending = s.sheet.pending.slice(batch.length); }); setSync('error', e.message); continue; }
      if (SESSION_GONE.test(e.message) && token === (S.user || {}).token) endSession();
      setSync('error', e.message); return false;
    }
    update(s => { s.sheet.pending = s.sheet.pending.slice(batch.length); });
  }
  if (S.sync.state === 'saving') setSync('ok');
  return S.sync.state !== 'error';
}
export function push(...ops) {
  if (!connected() || !S.user) return;
  const token = S.user.token;
  update(s => { s.sheet.pending.push(...ops.map(op => ({ token, op: JSON.parse(JSON.stringify(op)) }))); });
  serial(flush);
}
export const pull = () => (connected() && S.user ? serial(async () => {
  const sent = await flush();
  if (!sent && S.sheet.pending.length) return;   // never overwrite changes that have not reached the sheet yet
  const refused = !sent ? S.sync.msg : '';       // keep "Not allowed: …" visible after the reload
  setSync('loading');
  try {
    const d = await call(null, S.user.token);
    update(s => { s.user = { ...s.user, ...d.me }; s.products = d.products.map(toProduct); s.suppliers = d.suppliers.map(toSupplier); s.pos = d.pos.map(toPo).sort((a, b) => b.no.localeCompare(a.no)); });
    setSync(refused ? 'error' : 'ok', refused);
  } catch (e) { if (SESSION_GONE.test(e.message)) endSession(); else setSync('error', e.message); }
}) : Promise.resolve());
