# Traderra Charts — React Implementation

## Architecture

Pure React canvas-based charting terminal. No legacy `charts-engine.js` loaded.

```
src/
├── app/charts/
│   ├── ChartsTerminal.tsx    ← Root client component, theme hydration
│   ├── error.tsx             ← Error boundary
│   ├── layout.tsx            ← Body style overrides for charts
│   └── page.tsx              ← Server component entry
├── components/charts/
│   ├── TopBar/               ← Symbol input, DRAW/TRADE dropdowns, tbtn-row
│   ├── LeftToolbar/          ← Drawing tool categories + flyouts
│   ├── AnnotationToolbar/    ← Selected annotation editor (color/weight/style/lock)
│   ├── MainArea/             ← Panel grid (1/2/4) + BT sidebar
│   ├── ChartCanvas/
│   │   └── ReactChartPanel.tsx  ← Canvas rendering + mouse interaction + RAF loop
│   ├── Overlays/             ← ContextMenu, DrawHint, Toast
│   └── Sidebar/
│       ├── Sidebar.tsx       ← Watchlist + tab bar + tab content
│       └── tabs/             ← TabLook, TabTools, TabSettings, TabVault, TabScan, TabBt, TabLab
├── stores/charts/
│   ├── uiStore.ts            ← Theme, fullscreen, toggles, settings
│   ├── chartStore.ts         ← Symbol, TF, layout, crosshair
│   ├── drawingStore.ts       ← Annotations, active tool, undo/redo
│   ├── toolStore.ts          ← Tool instances with params/colors
│   ├── indicatorStore.ts     ← Active indicators per panel
│   ├── watchlistStore.ts     ← Watchlist CRUD + localStorage
│   ├── backtestStore.ts      ← BT results + highlights
│   └── authStore.ts          ← Auth token
├── lib/charts/
│   ├── theme.ts              ← Mutable C (colors) + F (fonts) + hexRgb
│   ├── render-candles.ts     ← Candle/hollow/OHLC/line/area/heikin/baseline
│   ├── render-volume.ts      ← Volume bars
│   ├── render-panel.ts       ← Panel orchestrator (grid, axes, candles, volume, indicators)
│   ├── render-grid.ts        ← Price/time grid
│   ├── render-crosshair.ts   ← Crosshair + price label
│   ├── render-indicators.ts  ← EMA/SMA/BB/VWAP/pzones rendering
│   ├── render-annotations.ts ← Drawing annotations
│   ├── render-preview.ts     ← Highlight drag preview
│   ├── render-bt-markers.ts  ← Backtest entry/exit markers
│   ├── render-session.ts     ← Pre/after market shading
│   ├── render-price-line.ts  ← Last price horizontal line
│   ├── render-pzones.ts      ← Support/resistance zones
│   ├── indicators.ts         ← calcEMA/SMA/ATR/BB/VWAP/computeIndicators
│   ├── canvas-utils.ts       ← Annotation hit-testing, screen coords
│   ├── format.ts             ← Price/volume formatting
│   ├── templates.ts          ← Chart template save/load/delete
│   ├── sharing.ts            ← Community sharing API client
│   └── toast.ts              ← Toast notification helper
├── hooks/
│   ├── useBars.ts            ← Polygon API bar fetching
│   └── useLiveBars.ts        ← 3s polling wrapper
└── styles/
    └── charts-terminal.css   ← All chart CSS (shared with original HTML)
```

## Key Patterns

### Mutable Theme Bridge
`C` (colors) and `F` (fonts) are mutable objects in `theme.ts`. Zustand stores don't trigger re-renders for canvas — the RAF loop reads `C`/`F` directly every frame. Components that change colors write to `C` via `applyCfg()`.

### Window Globals
Render modules read from `(window as any).annotations`, `._chartStyle`, `.showPriceLine`, `._hideAll`, etc. `ReactChartPanel.tsx` bridges Zustand → window each frame in the render loop.

### localStorage Hydration
Store fields loaded from localStorage (theme cfg, indBtns, watchlist) use `useEffect` hydration — never at module scope — to avoid SSR/client mismatch.

## Known Gaps (deferred)
1. **CLN (clean prints)** — toggle stores state but doesn't filter bars
2. **Scan add modal** — static HTML, onclick handlers dead
3. **PCT position sizing popup** — not implemented in React
4. **ADJ toggle** — stores state but API always sends `adjusted=true`
5. **Scan engine execution** — CSV upload works, no built-in strategy runner

## Reference Files
- Original HTML: `docs/charts/reference/charts-terminal.html`
- Legacy engine: `docs/charts/reference/charts-engine.js`
- Phase 3 handoff: `docs/charts/handoff-react-charts-phase3.md`
- Visual diff: `docs/charts/diff-react-vs-html.md`
