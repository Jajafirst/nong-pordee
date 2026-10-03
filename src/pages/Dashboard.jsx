import { useMemo, useState } from 'react';
import { L } from '../lib/i18n';
import { S, ASOF } from '../lib/store';
import { scoped, counts, adviceList, urgentList, planFor, statusOf, ORD, salesSummary, dailyTotals, chartSeries, weightedAccuracy, fcTotal, forecast, salesOf, hasSales } from '../lib/engine';
import { baht, nf, pct, sum } from '../lib/util';
import { fmtShort } from '../lib/i18n';
import { Mimg, Panel, Tile, Seg, Spark, Chart, StatusChip, ProductIcon, Empty } from '../components/ui';
import AdviceCard from '../components/AdviceCard';
import { useOrderNow } from '../components/useOrderNow';
import { useRoute } from '../router';
import { can } from '../lib/perm';

export default function Dashboard() {
  const { go } = useRoute(), orderNow = useOrderNow(), prods = scoped();
  const money = can('viewSales'), [sku, setSku] = useState('ALL'), [met, setMet] = useState(money ? 'rev' : 'units');
  const rows = salesSummary(prods, 90), c = counts(prods), adv = adviceList(prods), urgent = urgentList(prods);
  const chartProds = sku === 'ALL' ? prods : prods.filter(p => p.sku === sku);
  const cs = useMemo(() => chartSeries(chartProds, met, 60, 30), [chartProds.map(p => p.sku).join(), met, S.src, S.fx.season, S.fx.promo, S.fx.fest, S.scenario, S.products]);
  if (!prods.length || !rows.length) return <Panel><Empty title={L('ยังไม่มีข้อมูลยอดขาย', 'No sales data yet')} sub={L('เมื่อมีข้อมูลการขาย น้องพอดีจะเริ่มพยากรณ์ให้ทันที เริ่มต้นด้วยการเพิ่มสินค้าแรกของร้าน', 'Add your first product and sales, then PorDee starts forecasting.')}><button className="btn primary" onClick={() => go('products')}>{L('ไปที่หน้าสินค้า', 'Go to products')}</button></Empty></Panel>;
  const total = sum(rows.map(r => r.rev)), units = sum(rows.map(r => r.units)), daily = dailyTotals(prods, 90), ds = Object.keys(daily).sort();
  const fc30 = sum(prods.map(p => fcTotal(p, 30))), prev30 = sum(prods.map(p => (hasSales(p.sku) ? sum(salesOf(p.sku, 30).q) : 0)));
  const fcDaily = (() => { const o = {}; prods.forEach(p => forecast(p, 30).forEach(f => { o[f.date] = (o[f.date] || 0) + f.v; })); return Object.keys(o).sort().map(d => o[d]); })();
  const late = prods.map(p => ({ p, st: statusOf(p), pl: planFor(p) })).filter(x => x.pl.late).sort((a, b) => a.pl.shelf - b.pl.shelf);
  const alertN = c.risk + c.watch + c.over, acc = weightedAccuracy(prods), chg = prev30 ? (fc30 / prev30 - 1) * 100 : 0;
  const msg = urgent.length ? L(`วันนี้มี ${urgent.length} รายการที่ต้องสั่งด่วน น้องพอดีแนะนำให้รีบสั่งนะคะ`, `${urgent.length} product${urgent.length > 1 ? 's need' : ' needs'} ordering now.`) + (late.length ? L(` และมี ${late.length} รายการที่ของเข้าไม่ทัน`, ` ${late.length} more will run out before deliveries arrive.`) : '')
    : late.length ? L(`วันนี้มี ${late.length} รายการที่จะหมดก่อนของที่สั่งไว้มาถึง ควรติดต่อ Supplier ให้เร่งส่งนะคะ`, `${late.length} product${late.length > 1 ? 's' : ''} will run out before the ordered stock arrives. Ask suppliers to deliver sooner.`) + (adv.length ? L(` ส่วนการสั่งรอบถัดไปมี ${adv.length} รายการ สั่งภายใน ${fmtShort(adv.map(x => x.pl.orderBy).sort()[0])}`, ` ${adv.length} product${adv.length > 1 ? 's' : ''} need a next order by ${fmtShort(adv.map(x => x.pl.orderBy).sort()[0])}.`) : '')
    : c.risk ? L(`วันนี้มี ${c.risk} รายการเสี่ยงของขาด`, `${c.risk} product${c.risk > 1 ? 's are' : ' is'} at risk of running out.`)
    : alertN ? L(`มี ${alertN} รายการที่ควรจับตา แต่ยังไม่วิกฤตค่ะ`, `${alertN} item${alertN > 1 ? 's' : ''} to keep an eye on, nothing critical.`) : L('ทุกอย่างอยู่ในเกณฑ์ปกติค่ะ', 'Everything is on target.');
  return (
    <div className="stack">
      <section className="hero">
        <div><h1>👋 {L('สวัสดี! น้องพอดีมีอะไรมาแนะนำวันนี้บ้าง?', 'Hello! What is Nong PorDee recommending today?')}</h1><p>{msg}</p>
          <p style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {urgent.length > 0 && <button className="btn primary" onClick={() => orderNow(urgent.map(x => x.p.sku))}>⚡ {L(`สั่งสินค้าเร่งด่วนเลย (${urgent.length} รายการ)`, `Order urgent items (${urgent.length})`)}</button>}
            <button className={'btn' + (urgent.length ? '' : ' primary')} onClick={() => go(c.risk ? 'alerts' : 'advice')}>{c.risk ? L('ดู Stock Alert', 'See stock alerts') : L('ดูคำแนะนำ', 'See advice')}</button></p></div>
        <Mimg k="welcome" w={170} free />
      </section>
      <section className="tiles" aria-label={L('ตัวเลขสำคัญ', 'Key figures')}>
        <Tile cls="blue" k={<>🔮 Forecast {L('30 วัน', '30 days')}</>} v={nf(fc30)} unit={L('ชิ้น', 'units')} d={<span className={chg >= 0 ? 'up' : 'down'}>{prev30 ? pct(chg) : ''} {L('เทียบ 30 วันก่อน', 'vs previous 30 days')}</span>} spark={<Spark vals={fcDaily} color="var(--blue)" />} />
        <Tile cls="ok" k="📦 Stock" v={nf(sum(prods.map(p => p.stock)))} unit={L('ชิ้น', 'units')} d={`${L('มูลค่าตามต้นทุน', 'Value at cost')} ${baht(sum(prods.map(p => p.stock * p.cost)))}`} />
        <Tile cls={c.risk ? 'risk' : alertN ? 'sun' : 'ok'} k="⚠️ Alert" v={alertN} unit={L('รายการ', 'items')} d={`${L('เสี่ยงขาด', 'Risk')} ${c.risk} · ${L('เฝ้าระวัง', 'Watch')} ${c.watch} · ${L('ล้น', 'Over')} ${c.over}`} />
        {money ? <Tile k={<>💰 {L('ยอดขาย 90 วัน', 'Sales, 90 days')}</>} v={baht(total)} d={`${L('เฉลี่ย', 'Avg')} ${baht(total / 90)}/${L('วัน', 'day')} · ${nf(units)} ${L('ชิ้น', 'units')}`} spark={<Spark vals={ds.slice(-30).map(d => daily[d])} color="var(--mint)" />} />
          : <Tile k={<>📝 {L('ใบสั่งซื้อที่ยังไม่ปิด', 'Open orders')}</>} v={S.pos.filter(o => o.status !== 'Received').length} unit={L('ใบ', 'orders')} d={`${L('ร่างรอส่ง', 'Drafts to send')} ${S.pos.filter(o => o.status === 'Draft').length} · ${L('มูลค่า', 'Value')} ${baht(sum(S.pos.filter(o => o.status !== 'Received').map(o => o.total)))}`} />}
      </section>
      <div className="grid2">
        <Panel title={<>📈 {L('ยอดขายจริง vs AI Forecast', 'Actual sales vs AI forecast')}</>} actions={<>
          <span className="chip ok" title={L('ทดสอบย้อนหลัง 3 รอบ รอบละ 14 วัน', '3 rolling backtests of 14 days')}>{L('ความแม่นยำ', 'Accuracy')} {acc == null ? '–' : acc.toFixed(1) + '%'}</span>
          <select className="inp" style={{ width: 'auto' }} value={sku} onChange={e => setSku(e.target.value)} aria-label={L('สินค้า', 'Product')}><option value="ALL">{L('สินค้าทั้งหมด', 'All products')}</option>{prods.map(p => <option key={p.sku} value={p.sku}>{p.name}</option>)}</select>
          {money && <Seg value={met} onChange={setMet} label={L('หน่วย', 'Metric')} options={[['rev', L('บาท', 'Baht')], ['units', L('ชิ้น', 'Units')]]} />}</>}>
          <Chart id="dash" label={L('ยอดขายจริงเทียบพยากรณ์', 'Actual versus forecast')} fmt={met === 'rev' ? baht : nf} axis={met === 'rev' ? v => (v >= 1000 ? Math.round(v / 1000) + 'k' : v) : undefined} divider={ASOF}
            series={[{ name: L('ยอดขายจริง', 'Actual'), color: 'var(--c-actual)', pts: cs.actual }, { name: L('โมเดลทดสอบย้อนหลัง 14 วัน', 'Model check (last 14 days held out)'), color: 'var(--c-fit)', dash: true, pts: cs.fit }, { name: 'AI forecast', color: 'var(--c-fc)', pts: cs.fc, w: 2.8 }]} />
        </Panel>
        <div className="stack">
          <AdviceCard x={urgent[0] || late[0] || adv[0]} onPlan={sk => go('plan', sk)} onDetail={sk => go('detail', sk)} onPo={no => go('po', no)} />
          <Panel title={L('รายการสินค้าที่ต้องสั่งซื้อ', 'Products to order')} actions={<button className="btn sm" onClick={() => go('plan')}>{L('ดูทั้งหมด', 'View all')}</button>}>
            {adv.length ? adv.slice(0, 5).map(x => (
              <div key={x.p.sku} className="miniRow"><div className="pcell"><ProductIcon p={x.p} /><div className="pname">{x.p.name}<small><StatusChip st={x.st} /></small></div></div>
                <div style={{ textAlign: 'right' }}><b className="num">{nf(x.pl.rec)}</b> {L('ชิ้น', 'units')}<div className="th">{x.pl.now ? L('สั่งวันนี้', 'order today') : fmtShort(x.pl.orderBy)}</div></div></div>)) : <p className="muted">{L('ยังไม่มีรายการที่ต้องสั่ง', 'Nothing to order.')}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
