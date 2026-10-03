import { createContext, useCallback, useContext, useEffect, useState } from 'react';
const Ctx = createContext(null);
const parse = () => { try { const [p, ...r] = (window.location.hash.replace(/^#\/?/, '') || 'dashboard').split('/'); return { page: p || 'dashboard', param: decodeURIComponent(r.join('/')) || null }; } catch (e) { return { page: 'dashboard', param: null }; } };
/** Tiny hash router: back/forward buttons work, and page + search live in context. */
export function RouterProvider({ children }) {
  const [route, setRoute] = useState(parse);
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  useEffect(() => { const f = () => { setRoute(parse()); setQ(''); setMenu(false); window.scrollTo(0, 0); }; window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  const go = useCallback((page, param) => {
    setRoute({ page, param: param || null }); setQ(''); setMenu(false); window.scrollTo(0, 0);
    try { window.history.pushState(null, '', '#/' + page + (param ? '/' + encodeURIComponent(param) : '')); } catch (e) { /* sandboxed frame: keep state in memory */ }
  }, []);
  return <Ctx.Provider value={{ ...route, go, q, setQ, menu, setMenu }}>{children}</Ctx.Provider>;
}
export const useRoute = () => useContext(Ctx);
