import { useState } from 'react';
import { S } from '../lib/store';
import { L, fmtDate } from '../lib/i18n';
import { scoped, adviceList, statusOf, planFor, reasonFor, ORD } from '../lib/engine';
import { nf } from '../lib/util';
import { Panel, Gauge, StatusChip } from '../components/ui';
import AdviceCard from '../components/AdviceCard';
import { ProductCell } from './Products';
import { useRoute } from '../router';

export default function Advice({ sku: initial }) {
  const { go } = useRoute(), prods = scoped(), list = adviceList(prods), [pick, setPick] = useState(initial || null);
  const urgentFirst = prods.map(q => ({ q, st: statusOf(q), pl: planFor(q) })).sort((a, b) => (b.pl.rec > 0) - (a.pl.rec > 0) || ORD.indexOf(a.st) - ORD.indexOf(b.st) || a.pl.shelf - b.pl.shelf);
  const p = prods.find(x => x.sku === pick) || (urgentFirst[0] && urgentFirst[0].q);
  if (!p) return null;
  const st = statusOf(p), pl = planFor(p), x = { p, st, pl }, others = list.filter(o => o.p.sku !== p.sku);
  return (
    <div className="stack">
      <Panel><div className="stack" style={{ gap: 16 }}>
        <div className="toolbar" style={{ margin: 0 }}><div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><label htmlFor="asku">{L('สินค้า', 'Product')}</label><select className="inp" id="asku" value={p.sku} onChange={e => setPick(e.target.value)}>{prods.map(q => <option key={q.sku} value={q.sku}>{q.name}</option>)}</select></div><StatusChip st={st} /></div>
        <div className="facts">{[['Stock ' + L('ปัจจุบัน', 'now'), nf(p.stock)], [L('กำลังมา', 'Incoming'), nf(p.inc)], ['AI Forecast (30 ' + L('วัน', 'd') + ')', nf(pl.f30)], ['Safety Stock', nf(p.safety)], ['Lead Time', p.lead + ' ' + L('วัน', 'days')]].map(([k, v]) => <div key={k}><span>{k}</span><b>{v} {k !== 'Lead Time' ? L('ชิ้น', 'units') : ''}</b></div>)}</div>
        <Gauge p={p} st={st} />
      </div></Panel>
      <AdviceCard x={x} onPlan={sk => go('plan', sk)} onPo={no => go('po', no)} />
      <Panel title={L('เหตุผลของน้องพอดี', 'Why PorDee suggests this')}><p className="reason">{reasonFor(p, pl)}</p></Panel>
      {others.length > 0 && <Panel title={L('สินค้าอื่นที่ควรสั่ง', 'Other products to order')}><div className="tbl-wrap"><table><tbody>{others.map(o => <tr key={o.p.sku}><td><ProductCell p={o.p} /></td><td><StatusChip st={o.st} /></td><td className="r"><b>{nf(o.pl.rec)}</b> {L('ชิ้น', 'units')}</td><td>{o.pl.now ? L('สั่งวันนี้', 'order today') : fmtDate(o.pl.orderBy)}</td><td className="r"><button className="btn sm" onClick={() => setPick(o.p.sku)}>{L('ดูคำแนะนำ', 'View advice')}</button></td></tr>)}</tbody></table></div></Panel>}
    </div>
  );
}
