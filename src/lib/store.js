// Global app state kept outside React so the forecast engine can read it directly.
// Components subscribe with useStore(); every change goes through update() so caches reset and the UI re-renders.
import { useSyncExternalStore } from 'react';
import RAW from '../data/raw.json';
import { SHEET_URL } from './config';

export const LAST_HIST = '2026-09-30';     // last day with sales records
export const FC_START = '2026-10-01';      // the forecast files start the day after the last sales record
const localToday = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
/** "today" for every stock, delivery and ordering rule: the real date (never before the forecast start) */
export const ASOF = localToday() > FC_START ? localToday() : FC_START;
export const HIST_START = RAW.start;

const KEY = 'pordee.react.v2';   // v2: data refreshed from the workbook on 2026-10-03
const fresh = () => ({
  products: RAW.products.map(p => ({ ...p, est: 0 })),
  pos: RAW.pos.map(p => ({ ...p })),
  suppliers: RAW.suppliers.map(x => ({ ...x })),
  sheet: { pending: [] },   // changes waiting to reach Google Sheets (see lib/sheet.js)
  sync: { state: 'idle', msg: '', at: 0 },
  log: [],
  chartView: {},   // chosen view per chart id: line | area | bar | hist | table   // activity log, newest first: { at, u, name, role, action, ref, detail }
  scenario: { fest: false, festStart: '2026-10-23', festEnd: '2026-10-31', festUp: 20, promo: false, promoStart: '2026-10-10', promoEnd: '2026-10-16' },
  fx: { season: true, promo: true, fest: true },
  src: 'py', overDays: 45, theme: 'auto', lang: 'th', cat: 'all', user: null,
});
export const S = fresh();
export const MEMO = new Map();
export const memo = (key, fn) => { if (MEMO.has(key)) return MEMO.get(key); const v = fn(); MEMO.set(key, v); return v; };

try {
  const o = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (o && o.products && o.pos) Object.assign(S, o, { user: null, sync: S.sync });
  const u = JSON.parse(sessionStorage.getItem('pordee.user') || localStorage.getItem('pordee.remember') || 'null');
  if (u && u.u && u.role) S.user = u;   // { u, name, role, token? }
} catch (e) { /* storage may be blocked: run in memory */ }
S.sheet = { pending: (S.sheet.pending || []).filter(x => x.token), url: SHEET_URL };

let version = 0;
const subs = new Set();
const persist = () => { try { const { user, sync, ...rest } = S; localStorage.setItem(KEY, JSON.stringify(rest)); } catch (e) {} };
export function update(fn) { fn(S); version++; MEMO.clear(); persist(); subs.forEach(f => f()); }
export function resetData() { const lang = S.lang, user = S.user, sheet = S.sheet; update(s => { Object.assign(s, fresh(), { lang, user, sheet }); }); }
export function useStore() { useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => version); return S; }
