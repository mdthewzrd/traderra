# Plan: Migrate charts-terminal.html → Next.js React App

**Created:** 2026-05-13  
**Scope:** Convert 13,916-line static HTML file into proper React/Next.js app  
**Branch:** `feature/charts-react-migration` (from `feature/tool-instance-system`)

---

## Current State

| Metric | Value |
|--------|-------|
| Total lines | 13,916 |
| Functions | ~361 |
| Global vars (`var/let/const` at top level) | ~50+ |
| `document.getElementById` calls | ~670 |
| External deps | 1 (`/indicators/vault.js`, 165 lines) |
| Canvas panels | 4 (5min, 15min, 60min, Daily) |
| CSS | ~1,475 lines inline `<style>` |

**Entry:** `/charts` → redirects to `/charts-terminal.html` (static file in `public/`)

**Key state systems:**
- `panels[]` — 4 chart panels, each with canvas, tools, indicators, bars
- `annotations[]` — drawing layer (trendlines, fibs, rectangles, etc.)
- `CloudStore` — server sync for templates, layouts, settings
- `ScanManager` — scan creation, running, results
- `StrategyLab` — strategy project management
- `BT_*` — backtest state
- `IND_REGISTRY` / `IND_CATALOG` — indicator definitions
- `PRESETS` / `TOOLS_KEY` — preset/tool persistence

---

## Migration Strategy: Incremental Slice-Out

**NOT a big-bang rewrite.** Extract sections one at a time, each deployable independently.

### Phase 0: Scaffold
- Create `/src/app/charts-v2/` route (parallel to existing, no disruption)
- Set up shared state context (React context or Zustand store)
- Add middleware auth gate (currently unprotected — anyone can load the HTML)
- **Verify:** `/charts-v2` renders identical to `/charts`

### Phase 1: Extract CSS → Stylesheet
- Move 1,475 lines of `<style>` to `/styles/charts.module.css` or CSS modules
- Replace inline styles in DOM construction with className references
- **Verify:** Visual regression check

### Phase 2: Extract HTML Shell → React Components
Break the 900-line `<body>` HTML into components:
```
ChartsLayout
├── TopBar
│   ├── TickerInfo
│   ├── ToolbarButtons (TOOLS, VAULT, SET, indicators, TPL dropdown)
│   └── ThemeToggle / Reload
├── Sidebar
│   ├── SidebarTabs (vault, scan, settings, tools, bt, lab)
│   ├── VaultPanel
│   ├── ScanPanel
│   ├── SettingsPanel
│   ├── ToolsPanel
│   ├── BacktestPanel
│   └── LabPanel
├── ChartArea
│   ├── ChartPanel[] (4 panels with canvas)
│   └── PanelDivider
├── AnnotationToolbar (floating)
└── Modals
    ├── ModalGeneric
    ├── ScanAddModal
    └── ToolSettingsPopup
```

### Phase 3: Extract JS Modules → Hooks & Stores
Migrate global state to Zustand (lightweight, no boilerplate):

| Current Global | → Zustand Store |
|---------------|-----------------|
| `panels[]`, `symbol`, `annotations[]` | `useChartStore` |
| `CloudStore` object | `useCloudStore` (server sync) |
| `ScanManager` | `useScanStore` |
| `StrategyLab` | `useStrategyStore` |
| `BT_*` vars | `useBacktestStore` |
| `IND_REGISTRY`, `PRESETS` | Static imports (already const) |
| `drawDefaults`, `toolStep`, `toolAnchor` | `useDrawingStore` |
| `fullscreenPanel`, `liveMode`, `showPriceLine` | `useUIStore` |

**Hooks to extract:**
| Hook | Purpose |
|------|---------|
| `usePolygonData(symbol, tf)` | Bar fetching + caching (replaces BAR_CACHE) |
| `useCanvas(panelIdx)` | Canvas rendering loop |
| `useAnnotations(panelIdx)` | Drawing tools |
| `useCrosshair(panels)` | Synchronized crosshair |
| `useBacktest(trades)` | Backtest overlay |
| `useKeyboardShortcuts()` | Global hotkeys |

### Phase 4: Canvas Engine (hardest part)
- The 4 canvas panels are the core (~4,000 lines of render logic)
- Options:
  - **A) Keep raw canvas in React refs** — wrap existing render functions, call from `useEffect`. Minimal risk, incremental.
  - **B) Migrate to lightweight charting lib** (lightweight-charts, visx) — cleaner but huge effort
- **Recommend: Option A** — keep canvas logic, just organize it into modules called from React

### Phase 5: Kill Static HTML
- Remove `public/charts-terminal.html`
- Remove `/charts/page.tsx` redirect
- Make `/charts-v2` → `/charts`
- Remove `traderra-charts` staging project (no longer needed)

---

## Dependency Order (what to do first)

```
Phase 0 (scaffold)  ← start here
  ↓
Phase 1 (CSS) + Phase 2 (HTML shell)  ← can parallel
  ↓
Phase 3 (state extraction)  ← depends on component structure
  ↓
Phase 4 (canvas)  ← depends on state stores
  ↓
Phase 5 (cutover)  ← everything must be migrated
```

## Estimated Effort

| Phase | Scope | Time |
|-------|-------|------|
| 0 — Scaffold | Routing, auth, shell | 1 session |
| 1 — CSS | 1,475 lines → modules | 1 session |
| 2 — HTML shell | ~900 lines → 15 components | 2 sessions |
| 3 — State | ~50 globals → 6 stores + hooks | 2-3 sessions |
| 4 — Canvas | ~4,000 lines into modules | 2-3 sessions |
| 5 — Cutover | Switch over, cleanup | 1 session |
| **Total** | | **~10 sessions** |

## Risks

| Risk | Mitigation |
|------|------------|
| Canvas rendering breaks during refactor | Phase 0 keeps existing code working; diff screenshots |
| Global state interdependencies | Zustand stores can reference each other; extract in dependency order |
| 670 getElementById calls | Replace gradually during component extraction |
| `vault.js` external script | Inline into React component in Phase 2 |
| Feature drift during migration | Freeze features on old HTML; new features go into React only |

## Tech Choices

| Choice | Decision | Why |
|--------|----------|-----|
| State management | **Zustand** | No boilerplate, works outside React, easy migration from globals |
| Canvas approach | **Keep raw canvas in refs** | Lowest risk, proven working code |
| CSS | **CSS Modules** | Scoped, no runtime cost, Next.js native |
| Auth gate | **Next.js middleware** | Server-side, no client redirect hack |
