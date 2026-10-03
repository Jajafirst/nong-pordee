import { useEffect } from 'react';
import { S, ASOF, LAST_HIST, useStore } from './lib/store';
import { daysBetween } from './lib/util';
import { L, fmtDate } from './lib/i18n';
import { scoped, counts, adviceList, activeScenario, modelAltered, categories } from './lib/engine';
import { logout } from './lib/actions';
import { connected, pull } from './lib/sheet';
import { canSee } from './lib/perm';
import { userOf } from './lib/accounts';
import { RouterProvider, useRoute } from './router';
import { Avatar, CategoryBar, OverlayProvider, Panel, Empty } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Products, ProductDetail } from './pages/Products';
import Sales from './pages/Sales';
import Forecast from './pages/Forecast';
import Advice from './pages/Advice';
import Alerts from './pages/Alerts';
import Plan from './pages/Plan';
import { Orders, PoEditor } from './pages/Orders';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

/** navigation grouped by what the person is doing */
const GROUPS = [
  { t: ['ภาพรวม', 'Overview'], items: [['dashboard', 'Dashboard', 'Dashboard', '🏠']] },
  { t: ['สินค้าและสต๊อก', 'Products and stock'], items: [['products', 'สินค้า', 'Products', '📦'], ['alerts', 'Stock Alert', 'Stock alert', '⚠️']] },
  { t: ['ยอดขายและพยากรณ์', 'Sales and forecast'], items: [['sales', 'ยอดขาย', 'Sales data', '📊'], ['forecast', 'Demand Forecast', 'Demand forecast', '🔮'], ['advice', 'น้องพอดีแนะนำ', 'PorDee advice', '🧠']] },
  { t: ['จัดซื้อ', 'Purchasing'], items: [['plan', 'Purchase Planning', 'Purchase planning', '🛒'], ['orders', 'ใบสั่งซื้อ (PO)', 'Purchase orders', '📝']] },
  { t: ['รายงานและระบบ', 'Reports and system'], items: [['reports', 'รายงาน', 'Reports', '📈'], ['settings', 'Settings', 'Settings', '⚙️']] },
];
const TITLES = { po: ['ใบสั่งซื้อ (Purchase Order)', 'Purchase order'], detail: ['รายละเอียดสินค้า', 'Product detail'] };
const NAV_OF = { po: 'orders', detail: 'products' };
const SEARCH_PAGES = ['products', 'sales', 'alerts', 'plan', 'orders'];
const CAT_PAGES = ['dashboard', 'products', 'sales', 'forecast', 'alerts', 'plan', 'reports'];


function Sidebar() {
  const { page, go, menu } = useRoute(), prods = scoped(), c = counts(prods);
  const badge = { alerts: c.risk, plan: adviceList(prods).length, orders: S.pos.filter(p => p.status === 'Draft').length };
  const cur = NAV_OF[page] || page;
  return (
    <aside className={'rail' + (menu ? ' open' : '')}>
      <div className="brand"><Avatar /><div className="logo-t"><span className="b">น้อง</span><span className="g">พอดี</span><span className="ai">AI</span><small>{L('คาดการณ์ให้แม่น สั่งให้พอดี', 'Forecast right, order just right')}</small></div></div>
      <nav className="nav" aria-label="Main">
        {GROUPS.map(g => ({ ...g, items: g.items.filter(i => canSee(i[0])) })).filter(g => g.items.length).map(g => (
          <div key={g.t[1]} className="navgroup" role="group" aria-label={L(...g.t)}>
            <div className="navlabel">{L(...g.t)}</div>
            {g.items.map(([id, th, en, em]) => (
              <button key={id} type="button" aria-current={cur === id ? 'page' : undefined} onClick={() => go(id)}>
                <span className="em" aria-hidden="true">{em}</span><span>{L(th, en)}</span>
                {badge[id] > 0 && <span className={'badge' + (id === 'alerts' ? '' : ' soft')}>{badge[id]}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="rail-foot"><button className="btn sm" onClick={logout}>{L('ออกจากระบบ', 'Sign out')}</button></div>
    </aside>
  );
}

/** shows whether edits have reached Google Sheets; click to send anything waiting and reload */
function SyncPill() {
  if (!connected()) return null;
  const { state, msg, at } = S.sync, n = S.sheet.pending.length;
  const t = { saving: L('กำลังบันทึกลงชีต…', 'Saving to sheet…'), loading: L('กำลังโหลดจากชีต…', 'Loading from sheet…'), error: L('บันทึกไม่สำเร็จ · ลองใหม่', 'Not saved · retry'),
    ok: L('ซิงก์แล้ว ', 'Synced ') + (at ? new Date(at).toLocaleTimeString(S.lang === 'en' ? 'en-GB' : 'th-TH', { hour: '2-digit', minute: '2-digit' }) : ''), idle: 'Google Sheets' }[state];
  return <button className={'btn sm sync ' + state} onClick={() => pull()} disabled={state === 'saving' || state === 'loading'} title={state === 'error' ? msg : L('กดเพื่อโหลดข้อมูลล่าสุดจากชีต', 'Reload the latest data from the sheet')} aria-live="polite">
    {state === 'error' ? '⚠️' : '☁️'}<span className="sync-t"> {t}{n > 0 && state !== 'saving' ? L(` (รอส่ง ${n})`, ` (${n} waiting)`) : ''}</span></button>;
}

function Topbar() {
  const { page, go, q, setQ, menu, setMenu } = useRoute(), me = userOf(), risk = counts(scoped()).risk;
  useEffect(() => {
    const f = e => { if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { const g = document.getElementById('gsearch'); if (g) { e.preventDefault(); g.focus(); g.select(); } } };
    document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f);
  }, []);
  return (
    <header className="topbar">
      <button className="iconbtn menu-btn" onClick={() => setMenu(!menu)} aria-label={L('เปิดเมนู', 'Open menu')}>☰</button>
      {SEARCH_PAGES.includes(page) && <label className="search"><span aria-hidden="true">🔍</span><input id="gsearch" type="search" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur(); } }} placeholder={L('ค้นหาสินค้า…  ( / )', 'Search products…  ( / )')} aria-label={L('ค้นหาสินค้า', 'Search products')} /></label>}
      <span className="grow" />
      <SyncPill />
      <button className="iconbtn" onClick={() => go('alerts')} aria-label={L('การแจ้งเตือน', 'Alerts')}>🔔{risk > 0 && <span className="dot">{risk}</span>}</button>
      <div className="usr"><Avatar /><div><b>{L(me.name, me.nameEn)}</b><span>{L(me.role, me.roleEn)}</span></div></div>
    </header>
  );
}

function Shell() {
  const { page, param, setMenu, menu, go } = useRoute();
  // load from the sheet on sign-in, and again when the person comes back to the tab (at most every 30 s)
  useEffect(() => {
    let last = Date.now(); pull();
    const f = () => { if (document.visibilityState === 'visible' && Date.now() - last > 30000) { last = Date.now(); pull(); } };
    document.addEventListener('visibilitychange', f); window.addEventListener('focus', f);
    return () => { document.removeEventListener('visibilitychange', f); window.removeEventListener('focus', f); };
  }, []);
  const all = GROUPS.flatMap(g => g.items), t = TITLES[page] || (all.find(i => i[0] === page) || all[0]).slice(1, 3);
  const cnt = { all: S.products.length }; categories().forEach(c => { cnt[c] = S.products.filter(p => p.cat === c).length; });
  let body;
  if (!canSee(page)) body = <Panel><Empty title={L('หน้านี้ไม่ได้อยู่ในสิทธิ์ของคุณ', 'This page is not part of your role')} sub={L(`บัญชี${userOf().role}เข้าหน้านี้ไม่ได้ ติดต่อเจ้าของร้านหากต้องใช้ข้อมูลนี้`, `${userOf().roleEn} accounts can't open this page. Ask the store owner if you need it.`)}><button className="btn" onClick={() => go('dashboard')}>{L('กลับไปหน้า Dashboard', 'Back to the dashboard')}</button></Empty></Panel>;
  else switch (page) {
    case 'products': body = <Products />; break;
    case 'detail': body = <ProductDetail sku={param} />; break;
    case 'sales': body = <Sales />; break;
    case 'forecast': body = <Forecast />; break;
    case 'advice': body = <Advice sku={param} />; break;
    case 'alerts': body = <Alerts />; break;
    case 'plan': body = <Plan initial={param} />; break;
    case 'orders': body = <Orders />; break;
    case 'po': body = <PoEditor no={param} />; break;
    case 'reports': body = <Reports />; break;
    case 'settings': body = <Settings />; break;
    default: body = <Dashboard />;
  }
  return (
    <div className="shell">
      <Sidebar />
      <div className={'scrim' + (menu ? ' open' : '')} onClick={() => setMenu(false)} />
      <main className="main">
        <Topbar />
        <div className="pagehead">
          <h1>{page === 'dashboard' ? 'Dashboard' : L(...t)}</h1>
          {activeScenario() && <span className="scn-pill">{L('มีสถานการณ์ What-if', 'What-if scenario on')}</span>}
          {modelAltered() && <span className="scn-pill">{L('ปรับข้อมูลที่ AI ใช้', 'Model inputs changed')}</span>}
          <span className={'asof' + (daysBetween(LAST_HIST, ASOF) > 7 ? ' stale' : '')} title={L('สต๊อกเป็นยอดล่าสุดที่บันทึกไว้ ยอดขายใช้ข้อมูลถึงวันที่แสดง', 'Stock is the latest recorded count; sales history runs to the date shown')}>{L('วันนี้', 'Today')} {fmtDate(ASOF)} · {L('ยอดขายถึง', 'sales to')} {fmtDate(LAST_HIST)}{daysBetween(LAST_HIST, ASOF) > 7 ? L(' · ควรอัปเดตข้อมูลยอดขาย', ' · sales data needs updating') : ''}</span>
        </div>
        {CAT_PAGES.includes(page) && <CategoryBar counts={cnt} />}
        <div key={page + (param || '')}>{body}</div>
      </main>
    </div>
  );
}

export default function App() {
  const s = useStore();
  useEffect(() => { const r = document.documentElement; if (s.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', s.theme); r.lang = s.lang; }, [s.theme, s.lang]);
  if (!userOf()) return <Login />;
  return <RouterProvider><OverlayProvider><Shell /></OverlayProvider></RouterProvider>;
}
