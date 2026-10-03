import { useState } from 'react';
import { L } from '../lib/i18n';
import { login } from '../lib/actions';
import { Mimg } from '../components/ui';
import { ACCOUNTS, ROLES } from '../lib/accounts';
import { connected, signIn } from '../lib/sheet';

export default function Login() {
  const [u, setU] = useState(''), [p, setP] = useState(''), [rem, setRem] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const live = connected();
  const submit = async e => {
    e.preventDefault();
    if (!u.trim() || !p) { setErr(L('กรอกชื่อผู้ใช้และรหัสผ่าน', 'Enter your username and password.')); return; }
    if (!live) {
      const a = ACCOUNTS.find(x => x.u === u.trim().toLowerCase() && x.p === p);
      if (!a) { setErr(L('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง ลองใช้บัญชีตัวอย่างด้านล่างได้เลยค่ะ', 'Username or password is not right. Try one of the demo accounts below.')); return; }
      const { p: _, ...user } = a; login(user, rem); return;
    }
    setBusy(true); setErr('');
    try { login(await signIn(u.trim(), p), rem); }
    catch (x) { setBusy(false); setErr(/Wrong username/.test(x.message) ? L('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'Username or password is not right.') : L('เชื่อมต่อ Google Sheets ไม่ได้: ', 'Could not reach Google Sheets: ') + x.message); }
  };
  return (
    <div className="login">
      <section className="login-art"><Mimg k="logo" w={420} /><p>{L('คาดการณ์ให้แม่น สั่งให้พอดี ไม่ขาด ไม่ล้น', 'Forecast accurately. Order just enough. No stockouts, no overstock.')}</p></section>
      <section className="login-form">
        <div><h1 style={{ fontSize: 28 }}>{L('เข้าสู่ระบบ', 'Sign in')}</h1><p className="muted" style={{ marginTop: 4 }}>น้องพอดี AI · Demand Forecast</p></div>
        <form className="row" onSubmit={submit} noValidate>
          <div className="field"><label htmlFor="lu">{L('ชื่อผู้ใช้ (User)', 'Username')}</label><input className="inp" id="lu" value={u} onChange={e => setU(e.target.value)} autoComplete="username" autoCapitalize="none" /></div>
          <div className="field"><label htmlFor="lp">Password</label><input className="inp" id="lp" type="password" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" /></div>
          <label className="chk"><input type="checkbox" checked={rem} onChange={e => setRem(e.target.checked)} /> {L('จดจำฉันไว้', 'Remember me')}</label>
          <div className="err" role="alert">{err}</div>
          <button className="btn primary" type="submit" disabled={busy} style={{ padding: '12px 18px' }}>{busy ? L('กำลังตรวจสอบ…', 'Checking…') : L('เข้าสู่ระบบ', 'Sign in')}</button>
        </form>
        {live ? <p className="hint">{L('บัญชีผู้ใช้จัดการโดยเจ้าของร้านในแท็บ "8. Users" ของ Google Sheets', 'Accounts are managed by the owner in the "8. Users" tab of the Google Sheet.')}</p> : <div className="demo-accts">
          <div className="hint">{L('ระบบเดโมนี้มีบัญชีตัวอย่าง เลือกเพื่อกรอกให้อัตโนมัติ', 'This is a demo with sample accounts. Pick one to fill the form.')}</div>
          {ACCOUNTS.map(a => <button key={a.u} type="button" className="acct" onClick={() => { setU(a.u); setP(a.p); setErr(''); }}><span><b>{L(...ROLES[a.role])}</b><br /><span className="hint">{a.u} / {a.p}</span></span><span className="muted">{L('ใช้บัญชีนี้', 'Use')}</span></button>)}
        </div>}
      </section>
    </div>
  );
}
