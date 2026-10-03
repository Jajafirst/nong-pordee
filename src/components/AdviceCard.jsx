import { L, fmtShort } from '../lib/i18n';
import { reasonFor } from '../lib/engine';
import { nf } from '../lib/util';
import { Mimg, ProductIcon } from './ui';

/** "น้องพอดีแนะนำ" card for one product: order now, chase a late delivery, or nothing to do yet */
export default function AdviceCard({ x, full, onPlan, onDetail, onPo }) {
  if (!x) return <div className="advice"><Mimg k="advice" w={116} /><div className="bubble"><b>{L('ตอนนี้ยังไม่มีรายการที่ต้องทำ', 'Nothing needs action right now')}</b><p className="muted">{L('สต๊อกและของที่กำลังมาเพียงพอ และของเข้าทันทุกรายการค่ะ', 'Stock and incoming orders cover demand, and every delivery arrives in time.')}</p></div></div>;
  const { p, pl } = x, head = <div className="muted" style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>💡 {L('น้องพอดีแนะนำ', 'PorDee suggests')} · <ProductIcon p={p} /> <b>{p.name}</b></div>;
  const why = full && <div className="reason" style={{ marginTop: 8 }}><b>{L('เหตุผล', 'Why')}:</b> {reasonFor(p, pl)}</div>;
  const detail = onDetail && <button className="btn sm" onClick={() => onDetail(p.sku)}>{L('ดูรายละเอียด', 'See details')}</button>;
  if (pl.rec > 0) return (
    <div className="advice"><Mimg k="advice" w={116} />
      <div className="bubble">{head}
        <div className="big">{L('ควรสั่งเพิ่ม', 'Order')} {nf(pl.rec)} {L('ชิ้น', 'units')}</div>
        <div style={{ marginTop: 2 }}>📅 {L('ควรสั่งภายใน', 'Order by')}: <b>{pl.now ? L('วันนี้', 'today') : fmtShort(pl.orderBy)}</b>{pl.gap > 0 && <span className="down"> · {L(`อาจขาดของ ~${pl.gap} วัน`, `about ${pl.gap} days likely empty`)}</span>}</div>
        {pl.late && <div className="down" style={{ marginTop: 2 }}>⚠️ {L(`ของที่สั่งไว้มาถึง ${fmtShort(pl.late.until)} ช้าไป ~${pl.late.days} วัน ควรเร่ง Supplier ด้วย`, `The order already placed arrives ${fmtShort(pl.late.until)}, ~${pl.late.days} days too late. Chase the supplier too.`)}</div>}
        {why}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}><button className="btn primary sm" onClick={() => onPlan(p.sku)}>{L('สร้างแผนการสั่งซื้อ', 'Create purchase plan')}</button>{detail}</div>
      </div>
    </div>);
  if (pl.late) return (
    <div className="advice"><Mimg k="alert" w={116} />
      <div className="bubble">{head}
        <div className="big">{L('เร่ง Supplier ส่งของ', 'Chase the delivery')}</div>
        <div style={{ marginTop: 2 }}>{L(`สต๊อกบนชั้นหมดประมาณ ${fmtShort(pl.late.out)} แต่ของจะมาถึง ${fmtShort(pl.late.until)}`, `The shelf runs out around ${fmtShort(pl.late.out)}, but stock arrives ${fmtShort(pl.late.until)}`)} · <span className="down">{L(`ขาดของ ~${pl.late.days} วัน`, `~${pl.late.days} days out of stock`)}</span></div>
        <div className="muted" style={{ marginTop: 2 }}>{L('ไม่ต้องสั่งเพิ่ม เพราะของที่สั่งไว้พอแล้ว แค่มาไม่ทัน', 'No new order needed: what is on order is enough, it is just late.')}</div>
        {why}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{pl.late.po && onPo && <button className="btn primary sm" onClick={() => onPo(pl.late.po)}>{L('ดู ', 'Open ')}{pl.late.po}</button>}{detail}</div>
      </div>
    </div>);
  return (
    <div className="advice"><Mimg k="success" w={116} />
      <div className="bubble">{head}
        <div className="big">{L('ยังไม่ต้องสั่ง', 'No order needed yet')}</div>
        {pl.cover < 90 && <div style={{ marginTop: 2 }}>📅 {L('สั่งรอบถัดไปภายใน', 'Next order by')}: <b>{fmtShort(pl.orderBy)}</b></div>}
        {why}
        {detail && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{detail}</div>}
      </div>
    </div>);
}
