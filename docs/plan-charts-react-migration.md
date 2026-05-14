# Plan: Migrate charts-terminal.html → Next.js React App

**Created:** 2026-05-13 · **Updated:** 2026-05-13  
**Branch:** `feature/tool-instance-system`  
**Commits:** 8 (91a0335 → 8e37005)

---

## Progress Tracker

| Phase | Status | What's Done |
|-------|--------|-------------|
| 0 — Scaffold | ✅ Done | `/charts-v2` route, server-side auth gate, `auth-server.ts` |
| 1 — CSS | ✅ Done | 638 lines extracted to `src/styles/charts-terminal.css` |
| 2 — HTML Shell | ✅ Done | 821 lines → 6 React components (TopBar, LeftToolbar, AnnotationToolbar, MainArea, Sidebar, Overlays) |
| 3 — State | 🔄 In Progress | 5 Zustand stores, bridge hook, 3 TS modules (sharing, templates, toast) |
| 4 — Canvas | ✅ Complete | 2,145 lines across 20 modules |
| 5 — Cutover | ⬜ Not Started | Kill static HTML, rename routes |

### Phase 3 Detail — What's Extracted vs Remaining

**Zustand Stores (defined & wired):**
- `useUIStore` — theme, fullscreen, live mode, sidebar, layout, toggles ✅
- `useDrawingStore` — active tool, annotations, drawing defaults ✅
- `useChartStore` — panels, symbol, bars, crosshair ✅ (not yet wired)
- `useBacktestStore` — trades, markers ✅ (not yet wired)
- `useAuthStore` — user identity, token ✅ (not yet wired)

**TypeScript Modules:**
- `src/lib/charts/sharing.ts` — shareTemplate, shareScan, importSharedItem ✅
- `src/lib/charts/templates.ts` — localStorage template CRUD ✅
- `src/lib/charts/toast.ts` — toast notification utility ✅

**Components wired to Zustand:**
- TopBar: theme, live, priceLine, adj, clean, layout 1/2/4, sidebar tabs ✅
- LeftToolbar: activeTool, flyout active state, bottom buttons ✅
- Sidebar: tab switching, open/close, active tab highlight ✅
- AnnotationToolbar: still uses `(window as any)` ⬜
- MainArea: still uses static HTML ⬜

**Phase 4 — COMPLETE:**
All renderPanel() sub-sections extracted as importable TypeScript modules:
- `format.ts` (71) — fmtPrice, fmtVol, getNY, fmtTimeAxis
- `indicators.ts` (107) — calcEMA, calcSMA, calcBollinger, calcVWAP, calcATR
- `theme.ts` (54) — color constants C{}, font sizes F{}
- `indicators-registry.ts` (69) — IND_REGISTRY with types
- `canvas-utils.ts` (84) — drawHandle, renderPolylinePath, colorWithAlpha
- `render-types.ts` (43) — RenderContext interface
- `render-grid.ts` (91) — grid lines + price/time axes
- `render-candles.ts` (101) — 7 chart styles
- `render-volume.ts` (42) — volume bars
- `render-price-line.ts` (44) — live price line
- `render-panel.ts` (115) — setup + orchestrator
- `render-session.ts` (184) — session shading, BT highlights, PDC
- `render-crosshair.ts` (103) — cursor, sync, OHLC tooltip
- `render-bt-markers.ts` (96) — BT entry/exit arrows
- `render-annotations.ts` (490) — all annotation types + selection
- `render-indicators.ts` (154) — drawLine, drawBand, drawEMA, drawDevBand
- `render-preview.ts` (86) — drawing preview
- `sharing.ts` (106), `templates.ts` (80), `toast.ts` (25)

**Phase 5 — Remaining:**
- Wire renderPanel() to use TypeScript modules instead of inline
- Remove `charts-terminal.html`
- Make `/charts-v2` → `/charts`
- Kill staging project

**Legacy bridge (`useLegacyBridge`):**
- Syncs theme → body.light class ✅
- Syncs sidebar → #sidebar.open class ✅
- Syncs all UI toggles to legacy globals ✅
- Syncs layout → grid CSS ✅
- Syncs activeTool → button states ✅

---

## File Map

### New Files (React/TS)
```
src/app/charts-v2/
  page.tsx              — Server component, auth gate
  ChartsTerminal.tsx    — Client shell, loads scripts, exposes globals

src/components/charts/
  TopBar/TopBar.tsx     — Main toolbar (170 lines)
  LeftToolbar/LeftToolbar.tsx — Drawing tools sidebar (260 lines)
  AnnotationToolbar/AnnotationToolbar.tsx — Floating annotation editor (180 lines)
  MainArea/MainArea.tsx — Grid + backtest sidebar (70 lines)
  Sidebar/Sidebar.tsx  — Watchlist + 7 tab panels (250 lines)
  Overlays/Overlays.tsx — Modals, toasts, popups (100 lines)

src/stores/charts/
  index.ts             — Re-exports
  uiStore.ts           — UI state (theme, sidebar, toggles)
  drawingStore.ts      — Drawing tools, annotations
  chartStore.ts        — Panels, symbol, bars
  backtestStore.ts     — Trade history
  authStore.ts         — User identity

src/hooks/
  useLegacyBridge.ts   — Zustand → legacy DOM sync

src/lib/charts/
  sharing.ts           — Community sharing API client
  templates.ts         — Template CRUD (localStorage)
  toast.ts             — Toast notification utility

src/lib/
  auth-server.ts       — Server-side session helper
```

### Original File (unchanged)
```
public/charts-terminal.html  — 13,916 lines, still the source of truth for JS logic
```

---

## Architecture Diagram

```
/charts-v2 (Next.js page)
  └── ChartsTerminal (client component)
        ├── useLegacyBridge() ← Zustand → DOM sync
        ├── TopBar ← useUIStore
        ├── LeftToolbar ← useDrawingStore
        ├── AnnotationToolbar ← (window as any) [TODO]
        ├── MainArea ← static HTML [TODO]
        ├── Sidebar ← useUIStore
        ├── Overlays ← static HTML [TODO]
        └── <script> loads charts-terminal.html JS
              └── reads DOM classes set by useLegacyBridge
```

---

## Original Plan (for reference)

### Phase 4: Canvas Engine ✅ Complete
- 20 pure-function modules extracted (2,145 lines)
- All renderPanel() sub-sections available as TypeScript imports
- Inline JS can now be gradually replaced with module calls
- Next step: Phase 5 cutover

### Phase 5: Kill Static HTML
- Remove `public/charts-terminal.html`
- Remove `/charts/page.tsx` redirect
- Make `/charts-v2` → `/charts`

### Estimated Remaining Effort

| Phase | Scope | Sessions Left |
|-------|-------|---------------|
| 3 — State (continued) | Wire remaining stores, extract more JS | 1-2 |
| 4 — Canvas | ~4,000 lines into modules | 2-3 |
| 5 — Cutover | Switch over, cleanup | 1 |
