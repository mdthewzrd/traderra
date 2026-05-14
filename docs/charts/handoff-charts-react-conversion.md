# Traderra Charts — React Conversion Handoff

**Date:** 2026-05-14
**Status:** Foundation complete. HTML layout cloned in React. Ready for full component extraction.
**Branch:** `feature/tool-instance-system`
**Production:** https://traderra-lime.vercel.app

---

## The Mission

Convert the Traderra Charts terminal from a 12,000-line vanilla JS app into a proper React + TypeScript application. The visual layout and behavior must remain **identical** — this is a structural migration, not a redesign.

**Architecture principle: Python calculates, React renders.** Like Pine Script.
- Python indicators (server-side) → compute values
- React + TypeScript (client-side) → render canvas, handle UI

---

## What's Done

### ✅ Infrastructure
- `/charts` route with server-side auth gate (redirects to `/sign-in` if unauthenticated)
- Route groups: `app/(main)/layout.tsx` has Footer + Renata sidebar; `app/charts/` does NOT
- Auth token injection: `/api/auth/token` returns session token → stored in localStorage for CloudStore
- Python indicator API: 12 indicators at `/api/py/calc`, `/api/py/indicators`, `/api/py/health`
- Polygon data proxy: `/api/chart-data/bars` (API key server-side, not in client JS)

### ✅ React Foundation
- `src/app/charts/page.tsx` — server component, auth check, renders ChartsTerminal
- `src/app/charts/layout.tsx` — fragment wrapper (no footer/renata)
- `src/app/charts/ChartsTerminal.tsx` — **currently renders raw HTML via dangerouslySetInnerHTML + loads charts-engine.js**
- `src/styles/charts-terminal.css` — 638 lines of CSS extracted from inline styles

### ✅ TypeScript Modules (extracted from inline JS)
- **20 render modules** in `src/lib/charts/` (1,549 lines total):
  - `render-candles.ts` (101 lines) — 7 chart styles
  - `render-grid.ts` (91 lines) — price/time axes + grid lines
  - `render-volume.ts` (42 lines) — volume bars
  - `render-annotations.ts` (490 lines) — all annotation types
  - `render-crosshair.ts` (103 lines) — cursor crosshair + OHLC tooltip
  - `render-bt-markers.ts` (96 lines) — backtest entry/exit arrows
  - `render-price-line.ts` (44 lines) — live price line
  - `render-session.ts` (184 lines) — pre/post market, PDC, BT highlights
  - `render-indicators.ts` (154 lines) — indicator line/band rendering
  - `render-preview.ts` (86 lines) — drawing preview
  - `render-panel.ts` (115 lines) — setup + orchestrator
  - `render-types.ts` (43 lines) — shared interfaces
  - `format.ts` (71 lines) — fmtPrice, fmtVol, fmtTimeAxis
  - `indicators.ts` (107 lines) — calcEMA, calcSMA, calcBollinger, calcATR, calcVWAP
  - `indicators-registry.ts` (69 lines) — IND_REGISTRY
  - `canvas-utils.ts` (84 lines) — drawing helpers
  - `theme.ts` (54 lines) — color/font constants

- **6 Zustand stores** in `src/stores/charts/` (556 lines total):
  - `chartStore.ts` (87 lines) — panels, symbol, bar cache, crosshair
  - `uiStore.ts` (97 lines) — theme, fullscreen, chart style, sidebar, toggles
  - `drawingStore.ts` (133 lines) — annotations, active tool, defaults
  - `backtestStore.ts` (49 lines) — trade history, markers, stats
  - `authStore.ts` (31 lines) — user identity
  - `watchlistStore.ts` (153 lines) — multiple watchlists, persisted to localStorage

- **React hooks** in `src/hooks/`:
  - `useBars.ts` (79 lines) — fetches OHLCV from `/api/chart-data/bars`
  - `useIndicator.ts` (119 lines) — fetches Python-calculated indicator values

- **Pure React canvas** (proof of concept, not wired):
  - `src/components/charts/ChartCanvas/ChartCanvas.tsx` (411 lines) — working canvas with candles, volume, crosshair, pan/zoom

### ✅ Python Indicators (12 registered)
Located at `traderra_indicators/indicators/`:
`ema`, `sma`, `ema_band`, `ema_cross`, `bollinger`, `deviation`, `deviation_single`, `pzones` (key levels), `pdc` (prior day close), `sma_vol`, `vol`, `vwap`

API endpoints (Python serverless on Vercel):
- `GET /api/py/indicators` → JSON schemas for all indicators
- `POST /api/py/calc` → `{ key, params, data } → { result }`
- `GET /api/py/health` → `{ status: "ok", indicators: 12 }`

---

## What Needs To Be Done

### The Conversion Task

Convert `src/app/charts/ChartsTerminal.tsx` from `dangerouslySetInnerHTML` + `charts-engine.js` into **real React components** with proper state management.

#### Source Files
- **HTML to convert:** `docs/charts-terminal-backup.html` lines 649-1470 (822 lines of HTML body)
- **JS to replace:** `public/charts-engine.js` (12,199 lines) — all canvas rendering, events, state
- **JS footer:** `public/charts-engine-footer.js` (219 lines) — ScanManager init
- **CSS (already extracted):** `src/styles/charts-terminal.css` (638 lines)

#### Conversion Order (recommended)

**Phase 1: Static HTML → JSX Components** (biggest visual win)
Convert the raw HTML into React components. Keep `charts-engine.js` for interactivity initially. Each component renders the same HTML with the same IDs/classes/styles.

1. **TopBar** (`#topbar`) — ~90 lines of HTML
   - Logo, symbol input, TF buttons, dropdown menus (Draw, Trade), action buttons
   - Dropdowns: chart style, templates, layout buttons
   - Ticker info display (`#ti-sym`, `#ti-price`, `#ti-chg`)
   - Convert inline `onclick` → React `onClick`, `class` → `className`

2. **LeftToolbar** (`#left-toolbar`) — ~115 lines of HTML
   - Categorized tool buttons with SVG icons
   - Flyout panels (`#fo-trend`, `#fo-fib`, `#fo-shape`, `#fo-annot`, `#fo-trade`, `#fo-measure`)
   - Bottom actions (magnet, stay-draw, lock, hide)
   - Convert `ltToggle`/`ltPick` to React state

3. **AnnotationToolbar** (`#ann-toolbar`) — ~240 lines of HTML
   - Floating toolbar with color picker, weight, linetype, opacity dropdowns
   - SV/Hue/Alpha canvas pickers
   - Convert `annToggleDropdown` to React state

4. **Sidebar** (`#sidebar`) — ~280 lines of HTML
   - Tabs: SCANS, BT, LAB, TOOLS, VAULT, SETTINGS
   - Scan panel with run controls, results
   - BT simulator panel
   - Strategy Lab
   - Tools panel (indicator tools)
   - Vault (saved annotations)
   - Settings panel

5. **MainArea** (`#main-area`) — ~100 lines of HTML
   - Grid container (`#grid`) where panels are created
   - Backtest sidebar (`#bt-sidebar`)

6. **Overlays** — ~50 lines of HTML
   - `#fs-backdrop`, `#toast`, modals (`#modal-box`, `#scan-add-modal`, `#pct-popup`, `#text-popup`)
   - Various popup/indicator settings panels

**Phase 2: Wire State to Components**
Replace DOM manipulation with Zustand store updates:
- Symbol input → `chartStore.setSymbol()`
- TF buttons → `chartStore.setPanelTf()`
- Tool selection → `drawingStore` active tool
- Sidebar toggle → `uiStore.sidebarOpen`
- Theme toggle → `uiStore.theme`
- Watchlist → `watchlistStore`

**Phase 3: Canvas Engine → React**
Replace `charts-engine.js` panel system with React:
- Panel creation (`buildPanels()`) → React `ChartCanvas` component
- Mouse/wheel events → React event handlers
- Data fetching (`fetchBars()`) → `useBars()` hook
- Rendering (`renderPanel()`) → existing TS render modules
- Window resize → `ResizeObserver` in React

**Phase 4: Indicator System → Python API**
Replace inline `calcEMA`/`calcATR` calls with Python API:
- `useIndicator('ema', { period: 9 }, bars)` → fetches from `/api/py/calc`
- Indicator tool instances → React state + Python calculation
- Indicator buttons in topbar → React components

**Phase 5: Kill charts-engine.js**
Once all sections are React:
- Delete `public/charts-engine.js`
- Delete `public/charts-engine-footer.js`
- Remove script loading from ChartsTerminal
- Remove `(window as any)` globals

---

## Critical Technical Notes

### Body Flex Layout
The charts CSS uses `body { display: flex; flex-direction: column }` and expects all top-level elements (topbar, left-toolbar, main-area, sidebar) as direct children of body. The current ChartsTerminal uses `display: contents` on its wrapper div to achieve this.

### Route Structure
```
app/
├── layout.tsx              ← Root: providers only (NO footer, NO renata)
├── (main)/                 ← Route group for journal pages
│   ├── layout.tsx          ← Adds Footer + RenataSidebar
│   ├── dashboard/
│   ├── journal/
│   └── ... (all other pages)
├── charts/                 ← Outside (main) group
│   ├── layout.tsx          ← Fragment wrapper
│   ├── page.tsx            ← Server: auth check → ChartsTerminal
│   └── ChartsTerminal.tsx  ← Client: THE CHART APP
├── api/
│   ├── chart-data/         ← Next.js routes (bars, session, templates, etc.)
│   ├── auth/               ← Next.js routes (token, sign-in, etc.)
│   ├── scans/              ← Next.js routes
│   └── shared/             ← Next.js routes (community sharing)
└── shared/[slug]/route.ts  ← Shared item HTML page
```

### Python API Location
```
api/py/                     ← Vercel Python serverless (NOT in src/app/api/)
├── calc/index.py           ← POST /api/py/calc
├── health.py               ← GET /api/py/health
└── indicators.py           ← GET /api/py/indicators

traderra_indicators/        ← Python indicator library
├── base.py                 ← BaseIndicator, ParamDef, ColorDef, OutputDef
├── registry.py             ← @register decorator, REGISTRY dict
└── indicators/             ← 12 indicator modules
```

**Important:** Python API must stay at `/api/py/` — the `/api/` root directory is auto-discovered by Vercel as Python serverless functions. If Python files share paths with Next.js routes, Python wins and breaks the TS routes.

### Auth Flow
1. User signs in via better-auth → session cookie
2. `/charts` page → server checks session → redirect to `/sign-in` if missing
3. ChartsTerminal client → fetches `/api/auth/token` → stores in `localStorage['traderra-auth-token']`
4. CloudStore (in charts-engine.js) reads token from localStorage for API calls

### Canvas Rendering Architecture
The existing TS render modules are pure functions that take a `RenderContext`:
```typescript
interface RenderContext {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  data: any[]
  W: number; H: number
  PRICE_W: number; TIME_H: number
  viewStart: number; viewBars: number
  // ... derived coordinates
}
```
Each render function (`renderGrid`, `renderCandles`, etc.) reads from this context and draws to the canvas. No DOM or global state dependencies.

### charts-engine.js Sections (by line range)
These are the sections that need React replacements:

| Lines | Section | React Replacement |
|-------|---------|-------------------|
| 1-960 | CloudStore, auth, globals, helpers | Zustand stores + React hooks |
| 961-1629 | Backtest state, panel defaults, renderPanel | ChartCanvas component |
| 1631-1901 | Grid, session shading, volume, candles | TS render modules (done) |
| 1903-2338 | Indicators (calc + draw) | useIndicator() + Python API |
| 2332-3038 | Annotations, preview, crosshair, BT markers, price line | TS render modules (done) |
| 3039-3527 | Canvas mouse/wheel events | React event handlers |
| 3528-3985 | Selection toolbar, annotation CRUD | React state + drawingStore |
| 3986-5441 | Panel init, resize, fullscreen | React effects |
| 5442-7834 | Sidebar, scan panel, presets | React components |
| 7835-8272 | Scan → BT integration | React component |
| 8273-9067 | Strategy Lab, helpers | React component |
| 9068-10345 | Scan system, tab switching, runs | React component + API |
| 10346-10426 | Theme toggle | uiStore |
| 10427-10538 | Modal, watchlist | React component + watchlistStore |
| 10539-10644 | Bar cache | useBars() hook |
| 10645-10823 | Sidebar sync, vault, settings | React component |
| 10824-10882 | Sidebar drag divider | React drag handler |
| 10883-12156 | BT strategy, popups, dropdowns, tool instances, hot buttons, chart style, templates, sharing | React components |
| 12157-12199 | Toolbar drag, keyboard shortcuts | React event handlers |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `docs/charts-terminal-backup.html` | Original 13,916-line file (ground truth) |
| `public/charts-terminal.html` | Current static HTML (1,472 lines, CSS only + script tags) |
| `public/charts-engine.js` | All chart logic (12,199 lines) — TO BE REPLACED |
| `public/charts-engine-footer.js` | ScanManager init (219 lines) — TO BE REPLACED |
| `public/indicators/vault.js` | Indicator preset definitions |
| `src/app/charts/ChartsTerminal.tsx` | **THE FILE TO EDIT** — currently raw HTML |
| `src/styles/charts-terminal.css` | All chart CSS (638 lines) |
| `src/lib/charts/render-*.ts` | Canvas rendering modules (ready to use) |
| `src/lib/charts/engine-override.ts` | TS render override system (from Phase 5, reference only) |
| `src/stores/charts/*.ts` | Zustand stores (ready to use) |
| `src/hooks/useBars.ts` | Polygon data fetching hook |
| `src/hooks/useIndicator.ts` | Python indicator calculation hook |
| `src/components/charts/ChartCanvas/ChartCanvas.tsx` | Pure React canvas (proof of concept) |

---

## Deployment

```bash
# Build
cd ~/traderra && npx next build

# Deploy production
npx vercel --prod --yes

# Test endpoints
curl -s https://traderra-lime.vercel.app/api/py/health
curl -s "https://traderra-lime.vercel.app/api/chart-data/bars?symbol=AAPL&tf=D&from=2026-05-01&to=2026-05-14"
```

- **Production:** https://traderra-lime.vercel.app
- **Vercel project:** `traderra` (projectId: `prj_bekUPbL4nzAp7l0jP2zs9IuaadSA`)
- **Branch:** `feature/tool-instance-system`
- **DB:** PostgreSQL via Prisma on Neon

---

## Do NOT

- ❌ Deploy to production without user confirmation
- ❌ Delete `docs/charts-terminal-backup.html` (it's the ground truth)
- ❌ Move Python API files out of `/api/py/` (Vercel routing will break)
- ❌ Put Python files at `/api/` root (conflicts with Next.js routes)
- ❌ Remove the `(main)` route group structure (footer/renata must stay off charts)
- ❌ Change the chart's visual appearance — this is a structural migration only
