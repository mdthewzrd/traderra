# Traderra Charts — React Conversion

## Architecture

React shell + legacy canvas engine (being migrated):

| Layer | Technology | Status |
|-------|-----------|--------|
| UI Chrome (topbar, sidebar, toolbar) | React + Zustand | ✅ Phase 1-2 |
| Tab content (settings, scans, vault) | Original HTML (dangerouslySetInnerHTML) | Bridge |
| Canvas rendering | charts-engine.js (12K lines vanilla JS) | Phase 3 target |
| Data fetching | charts-engine.js → Polygon API | Phase 4 target |
| Python indicators | /api/py/* (serverless) | ✅ Working |

## Key Files

### Active (used in production)
- `src/app/charts/ChartsTerminal.tsx` — Main entry point, composes all components + loads scripts
- `src/components/charts/TopBar/TopBar.tsx` — Symbol input, tool dropdowns, layout buttons (Zustand-wired)
- `src/components/charts/LeftToolbar/LeftToolbar.tsx` — Drawing tools with flyouts (fully Zustand-wired)
- `src/components/charts/AnnotationToolbar/AnnotationToolbar.tsx` — Floating annotation editor (bridge)
- `src/components/charts/Sidebar/Sidebar.tsx` — Watchlist + tab navigation (Zustand + HTML bridge)
- `src/components/charts/Sidebar/sidebar-tabs-html.ts` — Original tab content HTML for legacy interop
- `src/components/charts/MainArea/MainArea.tsx` — Grid container + BT sidebar (HTML bridge)
- `src/components/charts/Overlays/Overlays.tsx` — Backdrop, toast, draw hint
- `src/components/charts/ChartCanvas/ChartCanvas.tsx` — Pure React canvas (proof of concept, not wired)
- `src/hooks/useLegacyBridge.ts` — Zustand ↔ charts-engine.js state sync
- `src/stores/charts/` — 6 Zustand stores (chart, ui, drawing, backtest, auth, watchlist)
- `src/lib/charts/render-*.ts` — 15+ TS canvas render modules (ready for Phase 3)
- `src/styles/charts-terminal.css` — All chart CSS (638 lines)

### Legacy (to be replaced)
- `public/charts-engine.js` — All chart logic (12,199 lines) — THE FILE TO KILL
- `public/charts-engine-footer.js` — ScanManager init (219 lines)
- `public/indicators/vault.js` — Indicator preset definitions

### Reference
- `docs/charts/reference/charts-terminal-backup.html` — Ground truth original (13,916 lines, DO NOT DELETE)
- `docs/charts/handoff-charts-react-conversion.md` — Full conversion plan with line-by-line map

## Migration Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Static HTML → JSX Components | ✅ Done |
| 2 | Wire Zustand state to components | 🔄 Partial (topbar, sidebar, left toolbar) |
| 3 | Canvas engine → React (ChartCanvas + render modules) | ⬜ Next |
| 4 | Indicators → Python API | ⬜ Future |
| 5 | Kill charts-engine.js entirely | ⬜ Final |

## Rules

- Never delete `docs/charts/reference/charts-terminal-backup.html`
- All element IDs must be preserved for charts-engine.js interop until Phase 5
- Python API must stay at `/api/py/` (Vercel routing constraint)
- Charts route is outside `(main)` route group (no footer/renata sidebar)
