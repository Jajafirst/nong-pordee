import { useState } from 'react';
import { S, ASOF } from '../lib/store';
import { L, fmtDate, fmtShort } from '../lib/i18n';
import { scoped, counts, statusOf, planFor, urgentList, ORD, STATUS, stLabel, iconFor } from '../lib/engine';
import { setPref } from '../lib/actions';
import { nf, nf1, daysBetween } from '../lib/util';
import { Panel, Banner, Th, useSort, StatusChip, StatusGlyph, Gauge, GaugeLegend, Empty, OrderBy } from '../components/ui';
import { ProductCell } from './Products';
import { useOrderNow } from '../components/useOrderNow';
import { useRoute } from '../router';
import { can } from '../lib/perm';

export default function Alerts() {
  const { go, q } = useRoute(), orderNow = useOrderNow(), sort = useSort(), [f, setF] = useState('all');
  const prods = scoped(), c = counts(prods), all = prods.map(p => ({ p, st: statusOf(p), pl: planFor(p) })), urgent = urgentList(prods);
  const ql = q.trim().toLowerCase();
  const base = all.filter(x => (f === 'all' || x.st === f) && (!ql || (x.p.name + x.p.sku + x.p.cat).toLowerCase().includes(ql))).sort((a, b) => ORD.indexOf(a.st) - ORD.indexOf(b.st) || a.pl.shelf - b.pl.shelf);
  const rows = sort.apply(base, { name: x => x.p.name, stock: x => x.p.stock, cover: x => x.pl.shelf, status: x => ORD.indexOf(x.st) * 1000 + Math.min(x.pl.shelf, 999), by: x => (x.pl.rec ? x.pl.orderBy : '9') });
  const risky = all.filter(x => x.st === 'risk'), over = all.filter(x => x.st === 'over'), late = risky.filter(x => x.pl.late);
  const overdue = S.pos.filter(o => (o.status === 'Sent' || o.status === 'In transit') && o.eta < ASOF);
  const lasts = x => (x.pl.shelf < 1 ? L('หมดวันนี้', 'out today') : L(`หมดใน ~${Math.floor(x.pl.shelf)} วัน`, `out in ~${Math.floor(x.pl.shelf)}d`));
  const actions = <>{urgent.length > 0 && <button className="btn primary sm" onClick={() => orderNow(urgent.map(x => x.p.sku))}>⚡ {L(`สั่งสินค้าเร่งด่วนเลย (${urgent.length} รายการ)`, `Order urgent items (${urgent.length})`)}</button>}
    {late.length > 0 && <button className={'btn sm' + (urgent.length ? '' : ' primary')} onClick={() => go('orders')}>📝 {L('ดูใบสั่งซื้อที่ต้องเร่ง', 'See orders to chase')}</button>}
    <button className="btn sm" onClick={() => go('plan')}>{L('ไปที่ Purchase Planning', 'Go to purchase planning')}</button></>;
  const riskTitle = urgent.length
    ? L(`มีสินค้า ${risky.length} รายการเสี่ยงของขาด น้องพอดีแนะนำให้รีบสั่งนะคะ!`, `${risky.length} product${risky.length > 1 ? 's are' : ' is'} at risk of running out. Order soon!`)
    : late.length === risky.length
      ? L(`มีสินค้า ${risky.length} รายการจะหมดก่อนของที่สั่งไว้มาถึง ติดต่อ Supplier ให้เร่งส่งนะคะ`, `${risky.length} product${risky.length > 1 ? 's' : ''} will run out before the ordered stock arrives. Ask suppliers to deliver sooner.`)
      : L(`มีสินค้า ${risky.length} รายการเสี่ยงของขาด`, `${risky.length} product${risky.length > 1 ? 's are' : ' is'} at risk of running out`);
  const banner = risky.length
    ? <Banner cls="risk" img="alert" title={riskTitle} actions={actions}>{risky.map((x, i) => <span key={x.p.sku}>{i > 0 && ' · '}{iconFor(x.p)} <b>{x.p.name}</b> ({L('เหลือ', 'left')} {nf(x.p.stock)}, {lasts(x)}{x.pl.late ? L(`, ของเข้า ${fmtShort(x.pl.late.until)}`, `, stock arrives ${fmtShort(x.pl.late.until)}`) : ''})</span>)}</Banner>
    : over.length ? <Banner cls="over" img="alert" title={L(`มีสินค้า ${over.length} รายการที่สต๊อกล้น (เกิน ${S.overDays} วัน)`, `${over.length} product${over.length > 1 ? 's carry' : ' carries'} more than ${S.overDays} days of stock`)}>{L('ลองชะลอการสั่งซื้อ หรือทำโปรโมชั่นเพื่อระบายสต๊อกนะคะ', 'Consider pausing reorders or running a promotion.')}</Banner>
    : <Banner cls="ok" img="success" title={L('ตอนนี้ไม่มีสินค้าที่ต่ำกว่า Min Stock', 'No products are below minimum stock')}>{L('น้องพอดีจะแจ้งเตือนทันทีเมื่อมีสินค้าใกล้หมดหรือล้นค่ะ', 'PorDee will flag anything that drops below its limits.')}</Banner>;
  return (
    <div className="stack">{banner}
      {overdue.length > 0 && <Banner cls="watch" img="alert" title={L(`ใบสั่งซื้อ ${overdue.length} ใบเลยกำหนดส่งแล้ว`, `${overdue.length} order${overdue.length > 1 ? 's are' : ' is'} past the expected delivery date`)} actions={<button className="btn sm" onClick={() => go('orders')}>{L('ดูใบสั่งซื้อ', 'See orders')}</button>}>
        {overdue.map((o, i) => <span key={o.no}>{i > 0 && ' · '}<button className="linkbtn" onClick={() => go('po', o.no)}>{o.no}</button> {o.supplier} ({L(`เลยมา ${daysBetween(o.eta, ASOF)} วัน`, `${daysBetween(o.eta, ASOF)} days late`)})</span>)}
        {' '}{L('ตรวจสอบกับ Supplier หรือกดรับของถ้าได้รับแล้ว', 'Check with the supplier, or mark it received if it has arrived.')}</Banner>}
      <div className="scards">{ORD.map(k => <button key={k} className={'scard ' + STATUS[k].cls} aria-pressed={f === k} onClick={() => setF(f === k ? 'all' : k)}><span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><StatusGlyph st={k} /> {stLabel(k)}</span><b>{c[k]}</b><span style={{ fontSize: 13 }}>{L('รายการ', 'items')}</span></button>)}</div>
      <Panel>
        <div className="toolbar">
          <div className="seg" role="group" aria-label={L('สถานะ', 'Status')}><button aria-pressed={f === 'all'} onClick={() => setF('all')}>{L('ทั้งหมด', 'All')}</button>{ORD.map(k => <button key={k} aria-pressed={f === k} onClick={() => setF(k)}>{stLabel(k)}</button>)}</div>
          <span className="grow" /><div className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><label htmlFor="od">{L('ของล้นเมื่อเกิน', 'Overstock above')}</label><input className="inp" id="od" disabled={!can('whatIf')} style={{ width: 76, minWidth: 0 }} type="number" min="7" max="365" defaultValue={S.overDays} onBlur={e => { const n = Math.round(+e.target.value); if (n >= 7) setPref('overDays', n); }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} /><span className="muted">{L('วัน', 'days')}</span></div>
        </div>
        <GaugeLegend />
        <div className="tbl-wrap" style={{ marginTop: 10 }}><table>
          <thead><tr><Th label={L('สินค้า', 'Product')} k="name" sort={sort} /><Th label={L('สต๊อกปัจจุบัน', 'Stock')} k="stock" sort={sort} cls="r" /><Th label="Min Stock" cls="r" help={L('ต่ำกว่า Min = เสี่ยงของขาด', 'Below min = stockout risk')} /><Th label="Safety" cls="r" help={L('ต่ำกว่า Safety = เฝ้าระวัง', 'Below safety = watch')} /><th style={{ minWidth: 140 }}>{L('ระดับสต๊อก', 'Level')}</th><Th label={L('อยู่ได้', 'Lasts')} k="cover" sort={sort} cls="r" help={L('จำนวนวันที่สต๊อกบนชั้นพอขายตามยอดพยากรณ์ ก่อนของรอบถัดไปเข้า', 'Days the stock on the shelf lasts at forecast demand, before the next delivery')} /><Th label={L('สถานะ', 'Status')} k="status" sort={sort} /><Th label={L('สั่งภายใน', 'Order by')} k="by" sort={sort} /><th /></tr></thead>
          <tbody>{rows.length ? rows.map(x => <tr key={x.p.sku}><td><ProductCell p={x.p} /></td>
            <td className="r"><b>{nf(x.p.stock)}</b>{x.p.inc > 0 && <div className="th">+{nf(x.p.inc)} {L('กำลังมา', 'incoming')}</div>}</td><td className="r">{nf(x.p.min)}</td><td className="r">{nf(x.p.safety)}</td><td><Gauge p={x.p} st={x.st} /></td>
            <td className={'r ' + (x.pl.shelf < x.p.lead ? 'down' : '')}>{x.pl.shelf >= 90 ? '90+' : nf1(x.pl.shelf)} {L('วัน', 'd')}<div className="th">{x.pl.next ? L(`ของเข้า ${fmtShort(x.pl.next.date)} +${nf(x.pl.next.qty)}`, `+${nf(x.pl.next.qty)} on ${fmtShort(x.pl.next.date)}`) : `Lead ${x.p.lead} ${L('วัน', 'd')}`}</div></td><td><StatusChip st={x.st} /></td>
            <td><OrderBy pl={x.pl} /></td>
            <td className="r">{x.pl.late && x.pl.late.po && <button className="btn sm primary" onClick={() => go('po', x.pl.late.po)}>{L('เร่ง ', 'Chase ')}{x.pl.late.po}</button>}{!x.pl.late && x.pl.rec > 0 && <button className={'btn sm' + (x.st === 'risk' ? ' primary' : '')} onClick={() => orderNow([x.p.sku])}>{L('สร้าง PO', 'Create PO')}</button>}</td></tr>)
            : <tr><td colSpan="9"><Empty title={L('ไม่พบสินค้าที่ค้นหา', 'No products found')} sub={L('ลองเปลี่ยนคำค้นหาหรือตัวกรองดูนะคะ', 'Try a different search or filter.')} /></td></tr>}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
