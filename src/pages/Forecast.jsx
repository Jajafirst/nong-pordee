import { useMemo, useState } from 'react';
import { S, ASOF } from '../lib/store';
import { L, fmtDate, dowName } from '../lib/i18n';
import { scoped, forecast, fcTotal, fcRange, ensureModel, chartSeries, weightedAccuracy, hasSales, salesOf, pyRows, pyFirst30, wbFirst30 } from '../lib/engine';
import { setFx, setScenario, setPref } from '../lib/actions';
import { can } from '../lib/perm';
import { baht, nf, pct, sum, isoDow } from '../lib/util';
import { Mimg, Panel, Seg, Th, Chip, Chart, Help } from '../components/ui';
import { ProductCell } from './Products';
import { useRoute } from '../router';

const Check = ({ checked, onChange, children, sub, disabled }) => <label className="chk" style={sub ? { marginLeft: 28, fontWeight: 400 } : undefined}><input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} /> {children}</label>;
const sig = (p, yes, no) => (p < 0.05 ? <Chip cls="ok">{yes}</Chip> : <Chip>{no}</Chip>);

export default function Forecast() {
  const { go } = useRoute(), [sel, setSel] = useState('ALL'), [H, setH] = useState(30);
  const all = scoped(), sc = S.scenario, fx = S.fx;
  const one = all.find(p => p.sku === sel) || null, prods = one ? [one] : all;
  const rowsAll = all.map(p => { const tot = fcTotal(p, H), m = ensureModel(p.sku), prev = hasSales(p.sku) ? sum(salesOf(p.sku, H).q) : 0; return { p, tot, prev, chg: prev ? (tot / prev - 1) * 100 : null, acc: m && m.accuracy, trend: m && m.trend, lift: m && m.lift, rng: fcRange(p, H) }; });
  const rows = one ? rowsAll.filter(r => r.p.sku === one.sku) : rowsAll;
  const tot = sum(rows.map(r => r.tot)), prev = sum(rows.map(r => r.prev)), rev = sum(rows.map(r => r.tot * r.p.price)), acc = weightedAccuracy(prods), chg = prev ? (tot / prev - 1) * 100 : null;
  const cs = useMemo(() => chartSeries(prods, 'units', 30, H), [prods.map(p => p.sku).join(), H, S.src, fx.season, fx.promo, fx.fest, sc, S.products]);
  const model = one && ensureModel(one.sku);
  const daily = one ? forecast(one, H) : (() => { const o = {}; all.forEach(p => forecast(p, H).forEach(f => { o[f.date] = (o[f.date] || 0) + f.v; })); return Object.keys(o).sort().map(d => ({ date: d, v: o[d] })); })();
  const wb = sum(prods.map(wbFirst30)), py = sum(prods.map(pyFirst30));
  const win = (a, b, extra) => <div className="formgrid" style={{ margin: '4px 0 8px 28px' }}>{[[a, 'From', 'จาก'], [b, 'To', 'ถึง']].map(([k, en, th]) => <div className="field" key={k}><label htmlFor={'sc_' + k}>{L(th, en)}</label><input className="inp" id={'sc_' + k} type="date" value={sc[k]} onChange={e => setScenario(k, e.target.value)} /></div>)}{extra}</div>;
  return (
    <div className="grid-f">
      <aside className="stack" style={{ gap: 14 }}>
        <Panel><div className="stack" style={{ gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><Mimg k="calc" w={78} /><div className="muted" style={{ fontSize: 13.5 }}>{L('เลือกสินค้าและช่วงเวลา แล้วดูว่าน้องพอดีใช้ข้อมูลอะไรคิด', 'Pick a product and period, and choose what PorDee uses.')}</div></div>
          <div className="field"><label htmlFor="fsku">{L('เลือกสินค้า', 'Select product')}</label><select className="inp" id="fsku" value={sel} onChange={e => setSel(e.target.value)}><option value="ALL">{L('สินค้าทั้งหมด', 'All products')}</option>{all.map(p => <option key={p.sku} value={p.sku}>{p.name} ({p.sku})</option>)}</select></div>
          <div className="field"><span className="lbl">{L('ช่วงเวลาที่ต้องการพยากรณ์', 'Forecast period')}</span><Seg value={H} onChange={setH} options={[7, 30, 90].map(n => [n, `${n} ${L('วัน', 'days')}`])} /></div>
          {!can('whatIf') && <p className="note">{L('ดูได้อย่างเดียว ผู้จัดการหรือเจ้าของร้านเป็นผู้ปรับสถานการณ์ What-if', 'View only. A manager or the owner sets the what-if scenarios.')}</p>}
          <fieldset disabled={!can('whatIf')} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="stack">
          <div className="field"><span className="lbl">{L('แหล่งพยากรณ์', 'Forecast source')}</span><Seg value={S.src} onChange={v => setPref('src', v)} options={[['py', L('โมเดลสถิติ Python', 'Python stats model')], ['wb', L('ไฟล์ Excel', 'Excel file')]]} /></div>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="lbl" style={{ marginBottom: 4 }}>{L('ข้อมูลที่ AI นำมาวิเคราะห์', 'Data the AI analyses')}</legend>
            <Check checked disabled>{L('ยอดขายย้อนหลัง', 'Sales history')} <span className="hint">{L('(ใช้เสมอ)', '(always)')}</span></Check>
            <Check checked={fx.season} onChange={v => setFx('season', v)}>{L('ฤดูกาล / วันในสัปดาห์', 'Seasonality / weekday')}</Check>
            <Check checked={fx.fest} onChange={v => setFx('fest', v)}>{L('เทศกาล', 'Festivals')}</Check>
            {fx.fest && <><Check sub checked={sc.fest} onChange={v => setScenario('fest', v)}>{L('ใส่ช่วงเทศกาลที่วางแผนไว้', 'Add a planned festival window')}</Check>
              {sc.fest && win('festStart', 'festEnd', <div className="field full"><label htmlFor="fu">{L('ยอดขายเพิ่มขึ้นช่วงเทศกาล (%)', 'Extra demand (%)')}</label><input className="inp" id="fu" type="number" min="0" max="300" step="5" value={sc.festUp} onChange={e => setScenario('festUp', Math.max(0, +e.target.value || 0))} /></div>)}
              <p className="hint" style={{ marginLeft: 28 }}>{L('ประวัติยอดขายยังไม่มีวันเทศกาลเลย จึงต้องกำหนดเปอร์เซ็นต์เอง', 'History has no festival days, so you set the uplift.')}</p></>}
            <Check checked={fx.promo} onChange={v => setFx('promo', v)}>{L('โปรโมชั่น', 'Promotions')}</Check>
            {fx.promo && <><Check sub checked={sc.promo} onChange={v => setScenario('promo', v)}>{L('ใส่ช่วงโปรโมชั่นที่วางแผนไว้', 'Add a planned promotion window')}</Check>{sc.promo && win('promoStart', 'promoEnd')}</>}
          </fieldset>
          </fieldset>
          <p className="hint">{L('ปิดตัวเลือกใดก็ได้เพื่อดูว่าความแม่นยำเปลี่ยนไปอย่างไร ตัวเลขทั้งระบบจะเปลี่ยนตาม', 'Turn options off to see how accuracy changes. Numbers across the app follow.')}{S.src === 'wb' && ' ' + L('(เมื่อใช้ไฟล์ Excel ตัวเลือกจะมีผลกับความแม่นยำและวันที่ 31 เป็นต้นไป)', '(With the Excel source, these affect accuracy and day 31 onward.)')}</p>
        </div></Panel>
      </aside>
      <div className="stack">
        <Panel><div className="stack" style={{ gap: 16 }}>
          <div className="sums" style={{ gap: 40, alignItems: 'flex-end' }}>
            <div><div className="muted" style={{ fontSize: 13.5 }}>{L('AI คาดการณ์ยอดขาย', 'AI forecast')} ({H} {L('วัน', 'days')})</div><div className="bigfig">{nf(tot)}<small>{L('ชิ้น', 'units')}</small>{chg != null && <span className={'pill-up' + (chg < 0 ? ' neg' : '')}>{pct(chg, 0)}</span>}</div></div>
            <div><div className="muted" style={{ fontSize: 13.5 }}>{L('ความแม่นยำของโมเดล', 'Model accuracy')} <Help text={L('ซ่อนยอดขาย 14 วันล่าสุด 3 รอบ แล้วให้โมเดลพยากรณ์เทียบกับยอดจริง', 'Hide the last 14 days three times, forecast them and compare with what sold.')} /></div><div className="bigfig">{acc == null ? '–' : acc.toFixed(1) + '%'}</div></div>
            <div className="s"><b>{baht(rev)}</b><span>{L('ยอดขายที่คาดไว้', 'expected sales')}</span></div>
            {one && rows[0].rng && <div className="s"><b>{nf(rows[0].rng.lo)}–{nf(rows[0].rng.hi)}</b><span>{L('ช่วงที่เป็นไปได้ 80% (ชิ้น)', '80% range (units)')}</span></div>}
          </div>
          <Chart id="forecast" label={L('พยากรณ์', 'Forecast')} divider={ASOF} series={[{ name: L('ยอดขายจริง', 'Actual'), color: 'var(--c-actual)', pts: cs.actual }, { name: L('โมเดลทดสอบย้อนหลัง 14 วัน', 'Model check'), color: 'var(--c-fit)', dash: true, pts: cs.fit }, { name: 'AI forecast', color: 'var(--c-fc)', pts: cs.fc, w: 2.8 }]} />
          {wb > 0 && <p className="note">{L(`เทียบ 30 วันแรก: ไฟล์ Excel พยากรณ์ ${nf(wb)} ชิ้น · โมเดลสถิติ Python ${nf(py)} ชิ้น (${pct((py / wb - 1) * 100, 0)}) สลับแหล่งพยากรณ์ได้ที่แถบด้านซ้าย`, `First 30 days: Excel file ${nf(wb)} units · Python model ${nf(py)} units (${pct((py / wb - 1) * 100, 0)}). Switch the source on the left.`)}</p>}
          <p className="hint">{L('วัน 1–30 ใช้ผลพยากรณ์ตามแหล่งที่เลือก วันถัดไปต่อด้วยรูปแบบและแนวโน้มของโมเดล', 'Days 1–30 follow the chosen source; later days extend the model’s pattern and trend.')}</p>
          <div><button className="btn primary" onClick={() => go('advice', one ? one.sku : undefined)}>🧠 {L('ดูคำแนะนำจากน้องพอดี', 'See PorDee’s advice')}</button></div>
        </div></Panel>
        {model && <Panel title={`${L('ยอดขายตามวันในสัปดาห์', 'Sales by weekday')} · ${one.name}`}>
          {[1, 2, 3, 4, 5, 6, 0].map(d => { const mx = Math.max(...model.dowF); return <div key={d} className="hbar"><span>{dowName(d)}</span><div className="bar"><i style={{ width: (model.dowF[d] / mx * 100).toFixed(0) + '%' }} /></div><span className="num">{(model.dowF[d] * 100).toFixed(0)}%</span></div>; })}
          <p className="hint" style={{ marginTop: 6 }}>{L('ผลโปรโมชั่น', 'Promo lift')} {pct((model.lift - 1) * 100, 0)} · {L('แนวโน้ม 30 วัน', '30-day trend')} {pct(model.trend)}</p></Panel>}
        <Panel title={L('พยากรณ์รายสินค้า', 'Forecast by product')}>
          <div className="tbl-wrap"><table><thead><tr><th>{L('สินค้า', 'Product')}</th><th className="r">{L('พยากรณ์', 'Forecast')} {H}{L('วัน', 'd')}</th><th className="r">{L('ช่วง 80%', '80% range')}</th><th className="r">{L('ช่วงก่อนหน้า', 'Previous')} {H}{L('วัน', 'd')}</th><th className="r">{L('เปลี่ยนแปลง', 'Change')}</th><th className="r">{L('ผลโปรโมชั่น', 'Promo lift')}</th><th className="r">{L('แนวโน้ม 30 วัน', '30-day trend')}</th><th className="r">{L('ความแม่นยำ', 'Accuracy')}</th></tr></thead>
            <tbody>{rowsAll.map(r => <tr key={r.p.sku} style={one && one.sku !== r.p.sku ? { opacity: .45 } : undefined}><td><ProductCell p={r.p} /></td><td className="r"><b>{nf(r.tot)}</b></td><td className="r dim">{r.rng ? `${nf(r.rng.lo)}–${nf(r.rng.hi)}` : '–'}</td><td className="r">{r.prev ? nf(r.prev) : '–'}</td><td className={'r ' + (r.chg == null ? '' : r.chg >= 0 ? 'up' : 'down')}>{r.chg == null ? '–' : pct(r.chg)}</td><td className="r">{r.lift ? pct((r.lift - 1) * 100, 0) : '–'}</td><td className="r">{r.trend == null ? '–' : pct(r.trend)}</td><td className="r">{r.acc == null ? L('ไม่มีประวัติ', 'No history') : r.acc.toFixed(1) + '%'}</td></tr>)}</tbody></table></div>
          <details className="why" style={{ marginTop: 14 }}><summary>{L('ดูพยากรณ์รายวัน', 'Show the day-by-day forecast')}{!one && L(' (รวมทุกสินค้า)', ' (all products)')}</summary>
            <div className="tbl-wrap" style={{ maxHeight: 320, overflow: 'auto', marginTop: 8 }}><table><thead><tr><th>{L('วันที่', 'Date')}</th><th>{L('วัน', 'Day')}</th><th className="r">{L('พยากรณ์ (ชิ้น)', 'Forecast units')}</th></tr></thead><tbody>{daily.map(d => <tr key={d.date}><td>{fmtDate(d.date)}</td><td>{dowName(isoDow(d.date))}</td><td className="r">{nf(d.v)}</td></tr>)}</tbody></table></div></details>
        </Panel>
        <Panel title={L('รายละเอียดโมเดลสถิติ (Python · statsmodels)', 'Statistical model details (Python · statsmodels)')}>
          <p className="muted" style={{ marginBottom: 12 }}>{L('โมเดลถดถอย (OLS) บน log ยอดขายรายวัน ประกอบด้วยแนวโน้มแบบ damped ผลของวันในสัปดาห์ และผลโปรโมชั่น ทดสอบย้อนหลัง 3 รอบ รอบละ 14 วัน เทียบกับวิธีพื้นฐาน 2 แบบ', 'An OLS regression on log daily sales: damped trend, weekday effects and a promotion effect. Backtested on 3 rolling folds of 14 days against two baselines.')}</p>
          <div className="tbl-wrap"><table><thead><tr><th>{L('สินค้า', 'Product')}</th><th className="r">{L('ความแม่นยำ', 'Accuracy')}</th><th className="r">{L('วิธีพื้นฐาน: สัปดาห์ก่อน', 'Baseline: last week')}</th><th className="r">Holt-Winters</th><th className="r">{L('ชนะวิธีพื้นฐาน', 'Beats baselines')}</th><th className="r">R²</th><th className="r">{L('ผลโปรโมชั่น (CI 95%)', 'Promo effect (95% CI)')}</th><th>{L('วันในสัปดาห์', 'Weekday pattern')}</th><th>{L('แนวโน้ม', 'Trend')}</th></tr></thead>
            <tbody>{pyRows().filter(r => all.some(p => p.sku === r.p.sku)).map(({ p, n, v }) => { const d = v.acc - Math.max(v.naive, v.hw), st = n.stats; return <tr key={p.sku} style={one && one.sku !== p.sku ? { opacity: .45 } : undefined}><td><ProductCell p={p} /></td><td className="r"><b>{v.acc.toFixed(1)}%</b></td><td className="r">{v.naive.toFixed(1)}%</td><td className="r">{v.hw.toFixed(1)}%</td><td className="r"><Chip cls={d > 0 ? 'ok' : 'neutral'}>{d > 0 ? '+' : ''}{d.toFixed(1)} {L('จุด', 'pts')}</Chip></td><td className="r">{st.r2.toFixed(2)}</td><td className="r">×{n.lift.toFixed(2)} <span className="th">({st.promoCI[0].toFixed(2)}–{st.promoCI[1].toFixed(2)})</span></td><td>{sig(st.dowP, L('มีรูปแบบชัดเจน', 'Clear pattern'), L('ไม่ชัดเจน', 'Weak'))}</td><td>{sig(st.trendP, st.trendPct > 0 ? L('เพิ่มขึ้น', 'Rising') : L('ลดลง', 'Falling'), L('ไม่มีนัยสำคัญ', 'No clear trend'))}</td></tr>; })}</tbody></table></div>
          <p className="hint" style={{ marginTop: 10 }}>{L('“ชนะวิธีพื้นฐาน” คือความแม่นยำที่เหนือกว่าวิธีที่ดีกว่าในสองวิธี · ผลโปรโมชั่น ×1.50 หมายถึงวันที่มีโปรโมชั่นขายได้มากกว่าปกติราว 50% · “ไม่มีนัยสำคัญ” คือข้อมูลยังไม่พอจะสรุปว่าแนวโน้มต่างจากศูนย์', '“Beats baselines” is accuracy above the better of the two baselines. A promo effect of ×1.50 means promotion days sell about 50% more. “No clear trend” means the data cannot tell the trend from zero.')}</p>
        </Panel>
      </div>
    </div>
  );
}
