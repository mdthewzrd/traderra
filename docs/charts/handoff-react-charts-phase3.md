# Charts React Conversion — Phase 3+ Handoff

**Date**: 2026-05-16  
**Branch**: `feature/tool-instance-system`  
**Status**: Phase 1-2 complete, Phase 3 partial (React chart renders but missing features)

## Current State

### What Works
- Pure React charts rendering (no charts-engine.js loaded)
- Candlesticks, volume, grid, price/time axes, crosshair, live price line
- All Mike preset indicators: EMA Band 9/20, EMA Band 72/89, Dev Band S 9/20, Dev Band 72/89, VWAP, Volume SMA
- LOOK tab: live color changes, save/load/reset, 4 presets (default/gold/light/nord)
- SETTINGS tab: zoom/pan sensitivity sliders, crosshair display settings
- Vault tab: lists active tools grouped by type, click to open settings
- Tools tab: full tool instance system (add/duplicate/delete, params editor, color editor, hot button toggle)
- Hot buttons in TopBar: quick-toggle for tools marked as hot
- Watchlist: symbol list with click-to-load, add/remove symbols
- Layout shell: TopBar, LeftToolbar, AnnotationToolbar, MainArea, Sidebar, Overlays

### What Doesn't Work Yet
Everything listed below in the implementation plan.

---

## Architecture

```
src/
├── app/charts/
│   ├── page.tsx              — server component, loads ChartsTerminal
│   └── ChartsTerminal.tsx    — client entry, no script loading
├── components/charts/
│   ├── TopBar/               — toolbar with hot buttons, draw/trade menus
│   ├── LeftToolbar/          — drawing tool categories
│   ├── AnnotationToolbar/    — per-annotation edit popup (exists, not wired)
│   ├── MainArea/             — contains ReactChartPanel + BT sidebar
│   ├── Sidebar/              — tab bar + 7 tab components
│   ├── Overlays/             — modal-overlay, scan-add-modal, pct/text popups
│   └── ChartCanvas/
│       ├── ReactChartPanel.tsx  — THE canvas renderer (407 lines)
│       └── ChartCanvas.tsx      — legacy wrapper (unused now)
├── stores/charts/
│   ├── uiStore.ts            — theme, sidebar, toggles
│   ├── chartStore.ts         — symbol, panels, bar cache
│   ├── toolStore.ts          — tool instances, IND_CATALOG, deriveInds()
│   ├── indicatorStore.ts     — derived from toolStore, reads inds map
│   ├── drawingStore.ts       — annotations, active tool, magnet/stay/lock/hide
│   ├── watchlistStore.ts     — watchlist symbols
│   ├── backtestStore.ts      — BT trades/stats
│   └── authStore.ts          — user auth
├── hooks/
│   ├── useBars.ts            — Polygon.io bar fetcher
│   └── useLegacyBridge.ts    — DELETED (no legacy engine)
├── lib/charts/
│   ├── theme.ts              — mutable C object + F font sizes
│   ├── format.ts             — fmtPrice, fmtVol, fmtTimeAxis, getNY, isIntraday
│   ├── indicators.ts         — calcEMA, calcSMA, calcATR, calcBollinger, calcVWAP, computeIndicators()
│   ├── render-panel.ts       — renderPanelSetup() — creates RenderContext
│   ├── render-grid.ts        — grid lines + price/time axes
│   ├── render-candles.ts     — candles (candlestick only, no hollow/OHLC/area/heikin/baseline)
│   ├── render-volume.ts      — volume bars
│   ├── render-crosshair.ts   — crosshair lines
│   ├── render-price-line.ts  — live price horizontal line
│   ├── render-indicators.ts  — drawLine, drawBandFill, drawBandLines, drawEMABand, drawDevBand
│   ├── render-session.ts     — renderSessionShading(), renderBtHighlights() (EXISTS, NOT CALLED)
│   ├── render-annotations.ts — renderAnnotations() (EXISTS, NOT CALLED)
│   ├── render-preview.ts     — renderAnnotationPreview() (EXISTS, NOT CALLED)
│   ├── render-bt-markers.ts  — renderBtMarkers() (EXISTS, NOT CALLED)
│   └── render-types.ts       — RenderContext interface
└── styles/
    └── charts-terminal.css   — 638 lines
```

### Key Files Outside React
- `public/charts-engine.js` — 12,199 lines, NOT loaded, kept as reference only
- `public/charts-engine-footer.js` — NOT loaded
- `public/indicators/vault.js` — NOT loaded
- `docs/charts/reference/charts-terminal-backup.html` — 13,916 lines, NEVER DELETE

### Key Patterns
- **Theme C is mutable singleton** — all render modules import it and read properties at call time. Mutations to `C.up` etc. take effect on next frame.
- **toolStore → indicatorStore subscription** — `useIndicatorStore` subscribes to `useToolStore` and derives `inds` from active tool `legacyKeys`.
- **ReactChartPanel animation loop** — `requestAnimationFrame` loop calls `render()` every frame. Reads `liveIndsRef.current` for indicator state.
- **Hot buttons** — tools with `hot: true` render in TopBar. Left-click toggles, right-click opens settings.

---

## Implementation Plan

### Phase 3A: Missing Canvas Features (4-6 hours)

#### 3A-1. Session Shading — 30 min
**Files**: `ReactChartPanel.tsx`  
**What**: Call `renderSessionShading(rc)` after grid, before candles.  
**Code location**: `render-session.ts` already exports this. It handles pre-market (gray), after-hours (dark), regular session boundaries, and day-change vertical lines.  
**Prerequisite**: `isIntraday()` check (only shade for intraday timeframes).

```typescript
// In ReactChartPanel render(), after renderTimeAxis(rc), before renderVolume(rc):
import { renderSessionShading } from '@/lib/charts/render-session'
if (isIntraday(tf)) renderSessionShading(rc)
```

#### 3A-2. Chart Style Variants — 1 hour
**Files**: `render-candles.ts`, `ReactChartPanel.tsx`, `uiStore.ts`  
**What**: Add hollow, OHLC bars, area, Heikin Ashi, baseline chart styles.  
**Reference**: `charts-engine.js` lines 2135-2260. Each style has different rendering logic.

The `render-candles.ts` file currently only does candlestick. Need to add:
- `chartStyle` prop to RenderContext (from `useUIStore`)
- Branch logic in `renderCandles()`:
  - `'candles'` — current behavior
  - `'hollow'` — same but up candles have hollow body (no fill)
  - `'ohlc'` — horizontal ticks left (open) and right (close) on a vertical line
  - `'area'` — filled area under close line
  - `'heikin'` — Heikin Ashi calculation then candlestick rendering
  - `'baseline'` — area above/below a reference price, different colors

`uiStore.ts` already has `chartStyle` field. TopBar already has chart style buttons (they're in the LeftToolbar). Just need to wire the rendering.

#### 3A-3. OHLCV Tooltip in Crosshair — 30 min
**Files**: `render-crosshair.ts`  
**What**: When crosshair is on a bar, show O/H/L/C/V text overlay.  
**Reference**: `charts-engine.js` lines 2820-2860. Draws a floating label near the crosshair with price data.  
Check if `render-crosshair.ts` already does this. If not, add:
- Read `rc.cx`, `rc.cy` to find hovered bar index
- Draw tooltip box with formatted OHLCV values

#### 3A-4. Scrollbar + Scroll Arrows — 1.5 hours
**Files**: New `ReactChartPanel.tsx` additions  
**What**: Bottom scrollbar showing position in data range. ◀ ▶ arrows for single-bar navigation.  
**Reference**: `charts-engine.js` lines 4111-4127 (scrollbar), panel HTML has arrow buttons.

Implementation:
- Add a scrollbar div below the canvas (inside `canvasWrapRef`)
- Track `viewStart` / `viewBars` / `bars.length`
- Draggable thumb = drag to pan
- Click track = jump to position
- Arrow buttons = scroll ±1 bar
- Mouse wheel already works for zoom

#### 3A-5. Live Data Polling — 1 hour
**Files**: New `useLiveBars.ts` hook or add to `useBars.ts`  
**What**: When liveMode is on, poll for new bars every 3 seconds.  
**Reference**: `charts-engine.js` lines 5727-5810 (`liveTick()`, `liveRefresh()`).

Implementation:
- Create `useLiveBars` hook that wraps `useBars`
- When `liveMode === true` and `symbol` is set:
  - Set interval to fetch latest bar(s)
  - Append new bar to existing `bars` array (don't refetch all)
  - Reset interval when symbol/tf changes or liveMode toggles off
- The interval should call `/api/chart-data/bars?symbol=X&tf=5&from=LATEST_BAR_DATE`

#### 3A-6. Target Line (PDC) — 30 min
**Files**: New `render-target.ts` or add to `render-price-line.ts`  
**What**: Vertical dashed line at a target date. Horizontal line at Prior Day Close.  
**Reference**: `charts-engine.js` lines 3300-3360 (PDC), 2810-2830 (target line).

Implementation:
- PDC: For intraday, find last bar of previous regular session. Draw horizontal dashed line at that close price.
- Target: Read target date from `uiStore` or `chartStore`. Draw vertical dashed line at that date position.
- Both should be optional (toggled via UI)

#### 3A-7. Key Levels (pzones) — 1 hour
**Files**: New `render-pzones.ts`, `toolStore.ts` (add pzones to IND_CATALOG)  
**What**: Pivot zone support/resistance bands based on swing highs/lows.  
**Reference**: `charts-engine.js` lines 1966-2085 (pzones rendering).

This is complex — involves swing point detection, zone merging, and rectangle drawing. The `IND_REGISTRY` already has `pzones` with 13 params. Need:
- Swing high/low detection algorithm
- Zone calculation from swing points
- ATR-based zone width
- Support (green) and resistance (red) zone rendering

---

### Phase 3B: Drawing System (3-4 hours)

#### 3B-1. Annotation Rendering — 1 hour
**Files**: `ReactChartPanel.tsx` (add call), `render-annotations.ts` (verify works)  
**What**: Render stored annotations from `drawingStore.annotations[]` on the canvas.  
`render-annotations.ts` already exists (490 lines) and exports `renderAnnotations(rc)`.  
Need to:
- Pass annotations array via RenderContext
- Call `renderAnnotations(rc)` after candles, before crosshair
- Verify all annotation types render: trendline, fib_ret, box_orange, box_yellow, text_orange, text_yellow, hl_cyan, hl_magenta, hl_green, hl_white, entry_arrow, exit_arrow, short_arrow, cover_arrow, stop_line, trail_stop

#### 3B-2. Drawing Interaction — 2 hours
**Files**: `ReactChartPanel.tsx` (mouse event handlers)  
**What**: Click/drag on canvas to place annotations. Multi-step tools (trendline = 2 clicks).

The `drawingStore` already tracks `activeTool`, `toolStep`, `toolAnchor`, `annotations[]`.  
Need mouse handlers in ReactChartPanel:
- `onMouseDown`: If `activeTool` is set, capture first/second click positions
  - For 2-click tools (trendline, fib): first click = anchor, second click = endpoint, create annotation
  - For single-click tools (text, arrow): create annotation at click position
  - For highlight tools (hl_*): click + drag = rectangle region
- `onMouseMove`: If drawing, show preview via `renderAnnotationPreview(rc)`
- `onMouseUp`: Finalize annotation

Must convert pixel coordinates → bar time + price using existing `rc.xToTime()` and `rc.yToPrice()` functions (add these to RenderContext if missing).

#### 3B-3. Annotation Selection + Edit — 1 hour
**Files**: `ReactChartPanel.tsx`, `AnnotationToolbar.tsx`  
**What**: Click existing annotation to select it. Show edit toolbar with color/width/delete controls.  
**Reference**: `charts-engine.js` `handleAnnotationClick()` (lines 4762-4800).

Need:
- Hit detection: check if click is near any annotation's points
- `setSelectedAnn()` in drawingStore
- AnnotationToolbar shows/hides based on `selectedAnn !== null`
- Edit controls: color picker, line width slider, delete button
- Drag to move annotation points

#### 3B-4. Drawing Undo/Redo — 15 min
**Files**: `drawingStore.ts`  
**What**: Push/pop annotation history. Ctrl+Z / Ctrl+Y.  
Add `_history: string[]` and `_redoStack: string[]` to drawingStore. Before each mutation, push `JSON.stringify(annotations)` to history.

#### 3B-5. Annotation Persistence — 30 min
**Files**: `drawingStore.ts`  
**What**: Save/load annotations to localStorage keyed by symbol.  
`annStorageKey = 'traderra-annotations-' + symbol`  
Load on symbol change, save on annotation mutation (debounced 500ms).

---

### Phase 3C: Multi-Panel Support (2-3 hours)

#### 3C-1. Panel Layout — 1.5 hours
**Files**: `MainArea.tsx`, `ReactChartPanel.tsx`, `uiStore.ts`  
**What**: Support 1, 2, or 4 panels in vertical/horizontal split.  
TopBar already has layout buttons (1/2/4). `useUIStore.activeLayout` already tracks this.

Implementation:
- `MainArea` renders 1, 2, or 4 `ReactChartPanel` components based on `activeLayout`
- Each panel gets a `panelIdx` (0-3) and reads its TF from `chartStore.panels[panelIdx].tf`
- Panel dividers for resizing (drag to resize)
- CSS grid or flexbox layout:
  - Layout 1: single panel full height
  - Layout 2: 2 panels stacked vertically
  - Layout 4: 2×2 grid

#### 3C-2. Per-Panel TF Buttons — 1 hour
**Files**: `ReactChartPanel.tsx`  
**What**: Each panel header has TF buttons (1m, 5m, 15m, 60m, D, W, M).  
**Reference**: `charts-engine.js` `buildPanels()` line 4142. TF_LIST = [{tf:'5',l:'5m'}, {tf:'15',l:'15m'}, ...]

Add TF buttons to ReactChartPanel header row. Clicking changes `chartStore.panels[panelIdx].tf`, which triggers re-fetch via `useBars`.

#### 3C-3. Per-Panel Indicator Presets — 30 min
**Files**: `ReactChartPanel.tsx`  
**What**: SAM / MIKE quick-apply preset buttons in the ind-row.  
**Reference**: `charts-engine.js` line 4148-4150.

Add preset buttons to panel header. Clicking applies preset indicator config to that panel.

#### 3C-4. Crosshair Sync — 30 min
**Files**: `ReactChartPanel.tsx`  
**What**: When hovering one panel, other panels show crosshair at same time position.  
**Reference**: `charts-engine.js` lines 2800-2830.

Use `chartStore.globalCrossTime` — all panels read it and draw their vertical crosshair at that time.

#### 3C-5. Date Range Picker — 1 hour
**Files**: `ReactChartPanel.tsx` or new `PanelControls.tsx`  
**What**: FROM/TO/TARGET/BACK/FWD date inputs per panel. APPLY / APPLY ALL buttons.  
**Reference**: `charts-engine.js` panel HTML (`.pdr` div).

Add date inputs below the panel header. Wire to `useBars(fromDate, toDate)`.

---

### Phase 3D: Sidebar Tab Functionality (3-4 hours)

#### 3D-1. Scan System — 2 hours
**Files**: `TabScan.tsx`, new `scanStore.ts`, new API routes  
**What**: Full scan pipeline — add scans (upload CSV, builtin, Python code), run, view results.  
This is a major feature. Key sub-features:
- Scan list with add/delete
- Scan types: CSV upload, builtin conditions, Python code (via API)
- Live vs historical scan modes
- Results table with sortable columns
- Scan backtest (run backtest against scan results)
- Filter by F1/F2/Both

**Reference**: `charts-engine.js` lines 6894-9700 (massive scan system).  
**Recommendation**: Start with CSV upload + results display. Add Python scans and backtest later.

#### 3D-2. Backtest Tab — 1.5 hours
**Files**: `TabBt.tsx`, `backtestStore.ts`  
**What**: CSV upload of trades, display stats, trade list with chart highlighting.  
The BT sidebar HTML already exists in `MainArea.tsx` (dangerouslySetInnerHTML). Need to:
- Wire the file input to parse CSV
- Calculate stats (trades, PnL, win rate, avg win/loss, best/worst)
- Render trade list rows
- Click trade = highlight date range on chart
- Manual sim (equity, R%, shares calculation)

#### 3D-3. Watchlist Persistence — 30 min
**Files**: `watchlistStore.ts`  
**What**: Save/load watchlist to localStorage + cloud.  
Add `localStorage.setItem('traderra-watchlist', JSON.stringify(symbols))` on mutation, load on init.

---

### Phase 3E: Templates & Cloud (2-3 hours)

#### 3E-1. Chart Templates — 1 hour
**Files**: New `templateStore.ts`, `TopBar.tsx` (wire TemplateDropdown)  
**What**: Save/Apply/Delete/Share chart templates (indicators + params + chart style + theme).  
**Reference**: `charts-engine.js` lines 11978-12110.

Template structure:
```typescript
interface ChartTemplate {
  id: string; name: string;
  chartStyle: string; theme: string;
  tools: ToolInstance[]; // serialized tool state
  ts: number;
}
```

Save to `localStorage('traderra-templates')`. TemplateDropdown already exists in TopBar but `tpl-list` is empty.

#### 3E-2. Cloud Sync — 1.5 hours
**Files**: New `cloudStore.ts` or extend `authStore.ts`  
**What**: Sync settings, annotations, templates, watchlist to cloud via API.  
**Reference**: `charts-engine.js` CloudStore object (lines 4-100).

Implementation:
- Auth: read `traderra-auth-token` from localStorage
- Save/load endpoints: `/api/chart-settings`, `/api/chart-data/session`
- Profile icon: show initials, click for auth menu
- Sync on change (debounced)

---

### Phase 3F: Polish (1-2 hours)

#### 3F-1. Chart Screenshot — 15 min
**Files**: `ReactChartPanel.tsx` or TopBar  
**What**: Export canvas as PNG image.  
```typescript
canvas.toBlob(blob => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = `${symbol}-${tf}.png`; a.click()
})
```

#### 3F-2. Filter Prints Toggle — 15 min
**Files**: `TabLook.tsx`, `useBars.ts` or API route  
**What**: The "Filter Prints" button in Look tab should toggle cleanPrints.  
Wire `sc-clean` button to `useUIStore.setCleanPrints()`.

#### 3F-3. Font Scale Quick Buttons — 15 min
**Files**: `TabLook.tsx`  
**What**: S/M/L buttons in Look tab should set font sizes to preset scales.

#### 3F-4. Panel Fullscreen — 30 min
**Files**: `ReactChartPanel.tsx`  
**What**: ⛶ button in panel header expands to full chart area.

#### 3F-5. Left Toolbar Flyouts — 30 min
**Files**: `LeftToolbar.tsx`  
**What**: Category buttons should open flyout menus with all tool variants, showing SVG icons. Currently uses flat buttons.

---

## Implementation Priority Order

### Do First (core chart experience)
1. **3A-1** Session Shading — 30 min, render module exists
2. **3A-3** OHLCV Tooltip — 30 min, critical UX
3. **3A-5** Live Data Polling — 1 hour, makes chart usable for real trading
4. **3B-1** Annotation Rendering — 1 hour, render module exists
5. **3B-2** Drawing Interaction — 2 hours, needed to actually draw

### Do Second (completeness)
6. **3A-4** Scrollbar — 1.5 hours
7. **3A-2** Chart Styles — 1 hour
8. **3C-1** Multi-Panel Layout — 1.5 hours
9. **3C-2** Per-Panel TF Buttons — 1 hour
10. **3E-1** Templates — 1 hour

### Do Third (sidebar tabs)
11. **3B-3** Annotation Edit — 1 hour
12. **3B-4** Drawing Undo/Redo — 15 min
13. **3B-5** Annotation Persistence — 30 min
14. **3D-3** Watchlist Persistence — 30 min
15. **3D-2** Backtest Tab — 1.5 hours

### Do Last (advanced features)
16. **3A-6** Target/PDC Lines — 30 min
17. **3A-7** Key Levels (pzones) — 1 hour
18. **3C-3** Per-Panel Presets — 30 min
19. **3C-4** Crosshair Sync — 30 min
20. **3C-5** Date Range Picker — 1 hour
21. **3D-1** Scan System — 2 hours
22. **3E-2** Cloud Sync — 1.5 hours
23. **3F** Polish items — 1-2 hours

---

## Reference: Legacy Engine Function Map

When implementing React equivalents, search for these functions in `charts-engine.js`:

| Feature | Legacy Function | Line |
|---------|----------------|------|
| Session shading | inline in `renderPanel()` | ~1700 |
| Candle styles | inline in `renderPanel()` | ~2135 |
| OHLCV tooltip | inline in `renderPanel()` | ~2820 |
| Scrollbar | `updateScrollbar()` | 4111 |
| Live polling | `liveTick()`, `liveRefresh()` | 5727-5810 |
| Annotations render | inline in `renderPanel()` | ~2500 |
| Annotation click | `handleAnnotationClick()` | 4762 |
| Drawing preview | `renderAdvancedPreview()` | 3357 |
| Annotation toolbar | `annRenderColorPicker()` | 3567 |
| Undo/Redo | `drawingUndo()`, `drawingRedo()` | 11798-11799 |
| Templates | `saveNewTemplate()`, `applyTemplate()` | 11998-12088 |
| Scans | `runScan()`, `scanAddOpen()` | 6894, 9122 |
| Cloud sync | `CloudStore` object | 4-100 |
| Screenshot | `chartScreenshot()` | 11786 |
| Key Levels | inline in `renderPanel()` | ~2064 |
| PDC line | inline in `renderPanel()` | ~3300 |

---

## Data Flow Diagram

```
User clicks symbol in watchlist
  → Sidebar.tsx calls chartStore.setSymbol('SPY')
  → ReactChartPanel re-renders
  → useBars('SPY', '15') fetches from /api/chart-data/bars
  → bars state updates
  → render() draws new data on canvas

User toggles indicator in Tools tab
  → TabTools calls toolStore.toggleTool(id)
  → toolStore updates tools[], derives inds{}
  → indicatorStore subscribes, updates inds
  → liveIndsRef.current updates on next poll (200ms)
  → render() reads inds, computeIndicators() runs
  → indicator drawn on canvas

User changes color in LOOK tab
  → TabLook ColorInput onChange → syncThemeFromInputs()
  → syncThemeFromInputs() mutates C.up, C.dn, etc.
  → Next animation frame: render() reads C.up, C.dn
  → Canvas shows new colors
```

---

## Known Gotchas

1. **Element IDs** — charts-engine.js had top-level `getElementById` calls. Some sidebar buttons still reference `window.openIndBtnPopup?.()` etc. These are safe no-ops but should be cleaned up.

2. **`C` is mutable** — the theme object is a mutable singleton. This is intentional for live preview but means you can't do React-style immutability with it.

3. **`F` is mutable too** — font sizes object, same pattern as C.

4. **`isIntraday()`** — must match bare number TFs ('5', '15', '60') not just '5m' format. Already fixed in both `format.ts` and `indicators.ts`.

5. **Bar timestamps** — API route converts Polygon ms→seconds for intraday, date strings for daily+. This convention must be maintained.

6. **`window.panels`** — no longer exists. ReactChartPanel reads from `useIndicatorStore` (derived from `useToolStore`). Any code checking `window.panels` will get undefined.

7. **BT sidebar** — still uses `dangerouslySetInnerHTML` in MainArea.tsx. The HTML elements are needed for when BT functionality is implemented (file input, stats fields, trade list).

8. **Scan tab** — TabScan.tsx has the full HTML structure but no JS logic. Same pattern as BT.

---

## Deployment

```bash
cd /home/mdwzrd/traderra
# Build check
npx next build
# Deploy
npx vercel --prod --token $VERCEL_TOKEN --yes
# URL: https://traderra-lime.vercel.app/charts
```

## Git Checkpoints

Create checkpoints at major milestones:
```
c12 — after 3A-1/3A-3/3A-5 (session shading, tooltip, live data)
c13 — after 3B-1/3B-2 (annotations render + drawing interaction)
c14 — after 3C-1/3C-2 (multi-panel)
c15 — after 3D/3E (sidebar tabs + templates)
```
