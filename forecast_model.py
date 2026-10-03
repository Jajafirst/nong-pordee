"""
Nong PorDee AI - statistical forecasting engine (runs offline, results are embedded in the app).

Model per SKU (daily units, n = 90 days):
    log(units_t) = a + b * t_damped + weekday effects (Sun = base) + promo effect + e_t
fitted by OLS (statsmodels). The trend is damped so 90-day forecasts do not run away.
Evaluated with rolling-origin backtests (3 folds x 14 days) against two benchmarks:
    - seasonal naive (same weekday, last week)
    - damped-trend additive Holt-Winters (statsmodels ExponentialSmoothing)
Intervals come from Monte Carlo draws of the coefficient covariance + residual noise.
Four variants are produced so the app's toggles (weekday pattern on/off, promotions on/off)
can switch between precomputed results instantly.
"""
import json, warnings
import numpy as np, pandas as pd
import statsmodels.api as sm
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.stats.stattools import durbin_watson
warnings.filterwarnings('ignore')

RAW = json.load(open('data.json'))
START = pd.Timestamp(RAW['start'])
H = 90; DAMP = 30.0; FOLDS = [48, 62, 76]; TEST = 14
rng = np.random.default_rng(2026)

def js_dow(idx):                     # 0=Sun .. 6=Sat, same as JS getUTCDay
    return np.array([(START + pd.Timedelta(days=int(i))).dayofweek for i in idx]) % 7 + 0 if False else np.array([((START + pd.Timedelta(days=int(i))).dayofweek + 1) % 7 for i in idx])

def t_future(h):                      # h = 1..H steps ahead, damped
    return None

def X(t, dow, promo, season, use_promo):
    cols = [np.ones(len(t)), t]
    if season:
        for d in range(1, 7): cols.append((dow == d).astype(float))
    if use_promo: cols.append(promo.astype(float))
    return np.column_stack(cols)

def fit_predict(y, promo, n_train, n_pred, season, use_promo, future_promo=None):
    idx = np.arange(n_train); dow = js_dow(idx)
    Xt = X(idx.astype(float), dow, promo[:n_train], season, use_promo)
    res = sm.OLS(np.log(y[:n_train]), Xt).fit()
    h = np.arange(1, n_pred + 1)
    t_f = (n_train - 1) + DAMP * (1 - np.exp(-h / DAMP))
    idx_f = n_train - 1 + h
    pf = promo[n_train:n_train + n_pred] if future_promo is None else future_promo
    Xf = X(t_f, js_dow(idx_f), pf, season, use_promo)
    mu = Xf @ res.params + res.scale / 2             # log-normal mean correction
    return res, Xf, np.exp(mu)

def seasonal_naive(y, n_train, n_pred):
    last = y[n_train - 14:n_train]
    wk = np.array([np.mean([last[i], last[i + 7]]) for i in range(7)])
    return np.array([wk[(i) % 7] for i in range(n_pred)])

def holt_winters(y, n_train, n_pred):
    try:
        m = ExponentialSmoothing(y[:n_train], trend='add', damped_trend=True, seasonal='add', seasonal_periods=7).fit()
        return np.clip(m.forecast(n_pred), 0, None)
    except Exception:
        return seasonal_naive(y, n_train, n_pred)

def wape(a, p): return float(np.abs(a - p).sum() / a.sum())

out = {}
for sku, h in RAW['sales'].items():
    y = np.array(h['q'], float); promo = np.array(h['p'], int); n = len(y)
    node = {'v': {}}
    for season in (1, 0):
        for use_promo in (1, 0):
            key = f'{season}{use_promo}'
            errs, tot, e_n, e_h = 0.0, 0.0, 0.0, 0.0
            wk_err, wk_tot = 0.0, 0.0
            fit_last = None
            for nt in FOLDS:
                _, _, pred = fit_predict(y, promo, nt, TEST, season, use_promo)
                a = y[nt:nt + TEST]
                errs += np.abs(a - pred).sum(); tot += a.sum()
                e_n += np.abs(a - seasonal_naive(y, nt, TEST)).sum(); e_h += np.abs(a - holt_winters(y, nt, TEST)).sum()
                for w in range(2): wk_err += abs(pred[w*7:w*7+7].sum() - a[w*7:w*7+7].sum()); wk_tot += a[w*7:w*7+7].sum()
                fit_last = pred
            res, Xf, fc = fit_predict(y, promo, n, H, season, use_promo, future_promo=np.zeros(H))
            # Monte Carlo for sums
            k = len(res.params); L = np.linalg.cholesky(res.cov_params() + 1e-12 * np.eye(k))
            draws = 2000
            beta = res.params[None, :] + (rng.standard_normal((draws, k)) @ L.T)
            eps = rng.standard_normal((draws, H)) * np.sqrt(res.scale)
            sim = np.exp(beta @ Xf.T + eps)
            sums = {}
            for N in (7, 30, 90):
                tot_sim = sim[:, :N].sum(1)
                sums[N] = [float(np.percentile(tot_sim, 10)), float(np.percentile(tot_sim, 90))]
            node['v'][key] = dict(acc=round(100 * (1 - errs / tot), 2), accW=round(100 * (1 - wk_err / wk_tot), 2),
                                  naive=round(100 * (1 - e_n / tot), 2), hw=round(100 * (1 - e_h / tot), 2),
                                  fc=[round(float(x), 1) for x in fc], fit=[round(float(x), 1) for x in fit_last],
                                  lo={str(N): round(v[0]) for N, v in sums.items()}, hi={str(N): round(v[1]) for N, v in sums.items()})
            if season and use_promo:
                names = ['const', 't'] + [f'dow{d}' for d in range(1, 7)] + ['promo']
                par = dict(zip(names, res.params)); pv = dict(zip(names, res.pvalues))
                ci = np.exp(res.conf_int()[names.index('promo')])
                dow_c = np.array([0.0] + [par[f'dow{d}'] for d in range(1, 7)])           # Sun..Sat
                dowF = np.exp(dow_c) / np.exp(dow_c).mean()
                R = np.zeros((6, k)); 
                for i in range(6): R[i, 2 + i] = 1
                ft = res.f_test(R)
                node.update(lift=round(float(np.exp(par['promo'])), 3), dowF=[round(float(x), 3) for x in dowF],
                            stats=dict(r2=round(float(res.rsquared), 3), adjr2=round(float(res.rsquared_adj), 3), promoP=float(pv['promo']),
                                       promoCI=[round(float(ci[0]), 2), round(float(ci[1]), 2)], trendPct=round(float((np.exp(par['t']) - 1) * 100), 3),
                                       trendP=float(pv['t']), dowP=float(ft.pvalue), sigma=round(float(np.sqrt(res.scale)), 3), dw=round(float(durbin_watson(res.resid)), 2), n=n))
    node['trend30'] = round(float(y[-30:].mean() / y[-60:-30].mean() * 100 - 100), 2)
    out[sku] = node

json.dump(out, open('py_model.json', 'w'), separators=(',', ':'))
wb = RAW['forecast']
print(f"{'SKU':8} {'acc':>6} {'naive':>6} {'HW':>6} | {'py30':>6} {'wb30':>6} {'lo-hi 30d':>12} | lift  trend/day%  promoP  dowP   R2")
for sku, nd in out.items():
    v = nd['v']['11']; s = nd['stats']
    print(f"{sku:8} {v['acc']:6.1f} {v['naive']:6.1f} {v['hw']:6.1f} | {sum(v['fc'][:30]):6.0f} {sum(wb[sku]):6.0f} {v['lo']['30']:>5}-{v['hi']['30']:<5} | {nd['lift']:.2f}  {s['trendPct']:+.2f}  {s['promoP']:.3f}  {s['dowP']:.3f}  {s['r2']:.2f}")
import os; print('json bytes', os.path.getsize('py_model.json'))
for key in ('11', '10', '01', '00'):
    print(key, 'mean acc', round(np.mean([nd['v'][key]['acc'] for nd in out.values()]), 1))
