# Nong PorDee AI (React)

Inventory forecasting and purchasing assistant. React 18 + a statistical forecast fitted in Python (statsmodels).

## Run / build
    npm install
    node build.mjs          # bundles src/ into dist/index.html (React is inlined, nothing loads from a CDN)

## Data and roles
The app starts from the workbook data in `src/data/raw.json` (refreshed from the Google Sheet on 2026-10-03).
Changes are saved in the browser. Settings > Export to Excel downloads everything as .xlsx with the workbook's tabs plus an activity log.

Roles (rules and page access in `src/lib/perm.js`):
- owner: everything, including cost/price changes, deleting products or suppliers, and resetting demo data
- manager: add/edit products and stock counts, send any PO, receive goods, sales and profit, what-if scenarios, activity log, Excel export
- buyer: products, stock alerts, forecast (view only), advice, purchase planning and POs; add/edit suppliers; send POs up to 20,000 THB.
  No Sales page, no sales report tab, no revenue on the dashboard, no export or activity log.

Optional live Google Sheets sync: deploy `apps-script/Code.gs` and set `SHEET_URL` in `src/lib/config.js` (empty = off).

## Refresh the forecasts (Python)
    pip install statsmodels pandas numpy scipy
    python3 forecast_model.py            # reads data.json, writes py_model.json
    cp py_model.json src/data/py.json    # then rebuild

## Layout
    src/lib/store.js      app state + persistence (one store, components subscribe with useStore)
    src/lib/engine.js     forecast lookup, what-if windows, stock status, purchase plan, reasons
    src/lib/actions.js    every state change (orders, products, suppliers, settings)
    src/lib/sheet.js      Google Sheets sync (pull, queued push, retry)
    apps-script/Code.gs   the Apps Script web app that reads and writes the spreadsheet
    src/lib/i18n.js       Thai / English helper L(th, en) and date formats
    src/components/       shared UI: charts, gauge, modal, toasts, category bar, advice card
    src/pages/            one file per screen (Dashboard, Products, Sales, Forecast, Advice, Alerts, Plan, Orders, Reports, Settings)
    src/router.jsx        small hash router (back button works)
    src/data/             workbook data (raw.json), Python model output (py.json), mascot images (img.json)

Demo logins: owner/owner123, manager/manager123, buyer/buyer123.
