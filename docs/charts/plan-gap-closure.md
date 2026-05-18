# Gap Closure Plan — React Charts vs Original HTML

> Generated: 2026-05-18
> Branch: `feature/tool-instance-system`
> Reference: `docs/charts/reference/charts-terminal-backup.html`
> Status: **ALL 33 gaps implemented** → 7/7 phases complete

---

## Phase G1: Layout & Structure Fixes (5 items)

> **Goal**: Fix the core layout so the app looks correct at a glance — sidebar collapse, margins, panel hot buttons.

### G1-1. MainArea margin-right responds to sidebar open/close
- **File**: `src/components/charts/MainArea.tsx`
- **Problem**: `marginRight: 350` hardcoded in all 4 layout branches. When sidebar closes, chart area doesn't expand.
- **Fix**: Read `useUIStore(s => s.sidebarOpen)` and set `marginRight: sidebarOpen ? 350 : 0`. Add `transition: 'margin-right 0.15s ease'` to match original.
- **Original**: `#main-area { margin-right: 350px; transition: margin-right 0.15s ease; }` + JS toggles it.

### G1-2. Per-panel hot buttons in `ind-row`
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: Original `renderHotButtons()` populates `<div id="ind-hot-${i}">` inside each panel's ind-row with toggle buttons for each hot tool. React only shows static indicator dots.
- **Fix**: Replace the static indicator dots with actual `<button className="ptog">` elements for each hot tool (from `useToolStore`). Each button shows the tool's `hotLabel`, colored by `hotColor`, with on/off toggle. Right-click opens tool settings.

### G1-3. `ind-btns-container` in TopBar
- **Files**: `src/components/charts/TopBar/TopBar.tsx`, new `IndBtnPopup.tsx`
- **Problem**: Original has a dynamically populated container for custom indicator quick-toggle buttons, plus a `+` button that opens `ind-btn-popup` (a modal with catalog selector + params + name). React renders the container empty and `+` calls a non-existent global function.
- **Fix**: Build `IndBtnPopup` React component. Read custom ind buttons from a new `indBtnStore` or `uiStore.indBtns`. Render toggle buttons in `ind-btns-container`.

### G1-4. TabLook "EDITING: DARK/LIGHT" label
- **File**: `src/components/charts/Sidebar/tabs/TabLook.tsx`
- **Problem**: Original shows which theme is being edited (DARK or LIGHT).
- **Fix**: Read `useUIStore(s => s.theme)` and display in the header.

### G1-5. Screenshot button in TopBar
- **File**: `src/components/charts/TopBar/TopBar.tsx`
- **Problem**: Original has `window.chartScreenshot` wired but no topbar button exposes it.
- **Fix**: Add a 📷 button (or use the existing one from Lab) that calls `window.chartScreenshot()`.

---

## Phase G2: Panel Header Functionality (4 items)

> **Goal**: Wire the `pdr` row controls so APPLY, BACK, FWD, TARGET actually work.

### G2-1. FROM/TO APPLY — scroll chart to date range
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: Date inputs have onChange but APPLY button has no onClick.
- **Fix**: Wire APPLY button to read `from-${i}` and `to-${i}` inputs, compute the bar index range, and call `setViewStart()`. Match original logic.

### G2-2. BACK/FWD inputs
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: `back-${i}` and `fwd-${i}` number inputs exist but aren't used.
- **Fix**: BACK = number of days before FROM to show. FWD = number of days after TO to show. When APPLY is clicked, compute the expanded date range and scroll to show it.

### G2-3. TARGET date — scroll to target + show dashed line
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`, `src/stores/charts/uiStore.ts`
- **Problem**: Target date input sets `targetDate` in store but doesn't scroll to it.
- **Fix**: When target date changes and APPLY is clicked, scroll the chart so the target date is centered. The dashed target line already renders via `renderSessionShading`.

### G2-4. APPLY ALL — apply date range to all panels
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: APPLY ALL button exists but has no onClick.
- **Fix**: Read FROM/TO from the current panel, propagate to all panels via `chartStore`. For each panel, set the same date range and scroll.

---

## Phase G3: Settings & Input Wiring (5 items)

> **Goal**: Make TabSettings sliders and TabLook font scales actually affect the chart render loop.

### G3-1. TabSettings sliders → ReactChartPanel zoom/pan config
- **File**: `src/stores/charts/uiStore.ts`, `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: Zoom Sensitivity, Trackpad Pan, Mouse Scroll, Right Padding save to localStorage but aren't read by the React render loop.
- **Fix**: Add `zoomSens`, `trackPanSens`, `mousePanSens`, `rightPad` to `uiStore`. TabSettings writes to store on change. ReactChartPanel reads from store for wheel/drag handlers.

### G3-2. TabSettings DISPLAY section
- **File**: `src/components/charts/Sidebar/tabs/TabSettings.tsx`
- **Problem**: Crosshair color/opacity and Price/Time label size sliders exist but don't sync to `C` and `F`.
- **Fix**: Wire the sliders to update `C.cross` and `F.p/F.t` via the same `applyCfg` pattern used in TabLook.

### G3-3. TabLook UI Scale slider
- **File**: `src/components/charts/Sidebar/tabs/TabLook.tsx`
- **Problem**: `sf-ui` slider exists but doesn't actually change the UI font size.
- **Fix**: When `sf-ui` changes, set `document.documentElement.style.fontSize` to the slider value + 'px'. Match original: `document.body.style.fontSize = v + 'px'`.

### G3-4. TabLook theme persistence — load saved theme on startup
- **File**: `src/components/charts/Sidebar/tabs/TabLook.tsx`, `src/app/charts/ChartsTerminal.tsx`
- **Problem**: "Save as Default" saves to localStorage but the saved theme isn't loaded on startup.
- **Fix**: On mount, read `localStorage.getItem('traderra-chart-settings')` and apply to `C` and `F` before first render.

### G3-5. TabSettings persistence — load saved settings on startup
- **File**: `src/components/charts/Sidebar/tabs/TabSettings.tsx`, `src/app/charts/ChartsTerminal.tsx`
- **Problem**: Settings save to localStorage but aren't loaded on startup.
- **Fix**: On mount, read `localStorage.getItem('traderra-trackpad')` and apply to uiStore + DOM inputs.

---

## Phase G4: Scan & Backtest Tabs (5 items)

> **Goal**: Full scan CRUD, scan execution, and backtest runner wired end-to-end.

### G4-1. Scan tab — saved scan list CRUD
- **File**: `src/components/charts/Sidebar/tabs/TabScan.tsx`, new `src/stores/charts/scanStore.ts`
- **Problem**: Scan list shows but save/load/delete likely incomplete.
- **Fix**: Create `scanStore` with `scans: Scan[]`, `activeScan`, `addScan()`, `removeScan()`, `updateScan()`. Persist to localStorage. Scan list shows saved scans with click-to-load and delete.

### G4-2. Scan tab — run scan engine
- **File**: `src/components/charts/Sidebar/tabs/TabScan.tsx`
- **Problem**: `▶ SCAN` button doesn't run the actual scan. Original has `scanRun()` that fetches daily bars and applies filter logic.
- **Fix**: For uploaded CSV scans: parse results and display in table. For built-in scans: fetch bars via `useBars`, apply filter function, display results. Wire Live/Historical toggle and F1/F2/Both filter radio buttons.

### G4-3. Scan tab — historical date range + presets
- **File**: `src/components/charts/Sidebar/tabs/TabScan.tsx`
- **Problem**: FROM/TO date inputs and 1M/3M/6M/1Y/2Y preset buttons exist but aren't wired.
- **Fix**: Wire date inputs to `scan-from`/`scan-to`. Preset buttons fill date range. Historical mode shows date range UI.

### G4-4. BT tab — backtest runner
- **File**: `src/components/charts/Sidebar/tabs/TabBt.tsx`, `src/stores/charts/backtestStore.ts`
- **Problem**: Side/Entry/Stop/Stop%/Target(R)/Max Hold/Risk inputs exist but RUN BT doesn't compute anything.
- **Fix**: Implement backtest logic: read scan results from scanStore, fetch daily bars for each symbol, apply entry/exit rules based on config, compute P&L, win rate, avg R, max DD, equity curve. Store results in backtestStore. Display in summary grid.

### G4-5. BT tab — REVIEW mode
- **File**: `src/components/charts/Sidebar/tabs/TabBt.tsx`
- **Problem**: REVIEW button exists but doesn't iterate through trades on the chart.
- **Fix**: When REVIEW is clicked, show trade list. Clicking a trade loads that symbol and scrolls to the entry date. BT markers (entry/exit arrows) render on the chart via `render-bt-markers.ts`.

---

## Phase G5: Lab Tab (4 items)

> **Goal**: Strategy Lab with project CRUD, phases, captures, and notes.

### G5-1. Lab project CRUD
- **File**: `src/components/charts/Sidebar/tabs/TabLab.tsx`, new `src/stores/charts/labStore.ts`
- **Problem**: "+ NEW" button and project list are stubs.
- **Fix**: Create `labStore` with `projects: LabProject[]`, `activeProject`, `createProject()`, `deleteProject()`, `updateProject()`. Persist to localStorage. Project list shows with click-to-open.

### G5-2. Lab project detail view
- **File**: `src/components/charts/Sidebar/tabs/TabLab.tsx`
- **Problem**: `lab-project-detail` exists but is always hidden.
- **Fix**: When a project is selected, show the detail view with: back button, title (editable), status badge, phase tabs, entries list.

### G5-3. Lab phases & entries
- **File**: `src/components/charts/Sidebar/tabs/TabLab.tsx`
- **Problem**: Phase tabs and entries are stubs.
- **Fix**: Each project has phases (Idea, Setup, Execution, Review). Each phase has entries (text notes + optional screenshot). Entries render as cards with timestamp. Click 📷 to capture current chart as a data URL and attach to entry.

### G5-4. Lab capture button
- **File**: `src/components/charts/Sidebar/tabs/TabLab.tsx`
- **Problem**: 📷 button calls non-existent function.
- **Fix**: Wire to `window.chartScreenshot()` (already implemented). Save the resulting blob URL as a new entry in the active phase.

---

## Phase G6: Annotation Toolbar & Interaction (6 items)

> **Goal**: Full TradingView-style floating annotation toolbar with color picker, drag-to-move, and context menu.

### G6-1. Full color picker (SV canvas + hue + alpha)
- **File**: `src/components/charts/AnnotationToolbar/AnnotationToolbar.tsx`
- **Problem**: Original has a full color picker with SV canvas, hue slider, alpha slider, hex input, and swatches. React version only has basic buttons.
- **Fix**: Implement canvas-based color picker (saturation-value square + hue strip + alpha strip). When annotation is selected, show the current color. On color change, update `selectedAnn.color`.

### G6-2. Text color support
- **File**: `src/components/charts/AnnotationToolbar/AnnotationToolbar.tsx`
- **Problem**: Original shows a separate text color picker for text annotations. React doesn't.
- **Fix**: When `selectedAnn.type` is a text type, show a second color picker group for text color. Update `selectedAnn.textColor`.

### G6-3. Drag-to-reposition annotation toolbar
- **File**: `src/components/charts/AnnotationToolbar/AnnotationToolbar.tsx`
- **Problem**: Original has `ann-toolbar-handle` with `cursor:grab` for dragging the toolbar around. React positions it fixed but doesn't allow dragging.
- **Fix**: Add drag handlers on the handle div. Track mouse offset, update toolbar position via `style.top/left`.

### G6-4. More menu — Duplicate / Bring to Front / Send to Back / Edit Text
- **File**: `src/components/charts/AnnotationToolbar/AnnotationToolbar.tsx`
- **Problem**: Original has a "More" dropdown with Duplicate, Bring to Front, Send to Back, Edit Text, Delete All of Type. React only has Delete.
- **Fix**: Add a "..." button with dropdown. Implement each action: duplicate annotation, reorder z-index, edit text (prompt), delete all of same type.

### G6-5. Right-click context menu on annotations
- **File**: new `src/components/charts/Overlays/ContextMenu.tsx`
- **Problem**: Original has `#ctx-menu` that shows on right-click over an annotation with Edit, Delete, Duplicate, Lock, Hide options. React has no context menu.
- **Fix**: Create ContextMenu component. On right-click in canvas, if mouse is near an annotation, show context menu at cursor position. Wire each action to drawingStore.

### G6-6. Annotation lock/visibility per annotation
- **File**: `src/stores/charts/drawingStore.ts`
- **Problem**: Original has per-annotation `locked` and `visible` flags. Lock prevents dragging, hide makes invisible. React has `lockAll`/`hideAll` globals but not per-annotation.
- **Fix**: Add `locked: boolean` and `visible: boolean` to `Annotation` interface. In canvas mouse handlers, skip locked annotations for drag. Skip hidden annotations for rendering.

---

## Phase G7: Data & Engine Bridge (4 items)

> **Goal**: Tool params flow to the render loop, templates are complete, and all topbar buttons work.

### G7-1. Tool params bridge to indicator computation
- **File**: `src/lib/charts/render-panel.ts`, `src/stores/charts/toolStore.ts`
- **Problem**: Tool instances have `params` (period, fast, slow, etc.) and `colors`, but the render loop reads from hardcoded `C.ema20`, etc. Changing a tool's period in TabTools doesn't update the chart.
- **Fix**: In the render loop, when computing indicators, read tool params from the store instead of hardcoded values. For each active tool, compute its indicator with the tool's params. Example: if tool has `indKey: 'ema'` with `params.period = 50`, compute `calcEMA(data, 50)` instead of always 20.

### G7-2. Template update button
- **File**: `src/components/charts/TopBar/TopBar.tsx`, `src/lib/charts/templates.ts`
- **Problem**: Original shows "🔄 Update Current Template" when a template is active. React doesn't track the active template.
- **Fix**: Add `activeTemplateName` to uiStore. When a template is applied, set it. Show the update button conditionally. Wire it to overwrite the template with current tools/inds/style.

### G7-3. Tool color changes apply to chart
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: Changing a tool's color in TabTools updates the store but the render loop reads from `C` object, not tool.colors.
- **Fix**: In the render loop, when drawing indicator lines/fills, read colors from the tool instance's `colors` map instead of the global `C` theme. Fall back to `C` defaults if not overridden.

### G7-4. OHLCV tooltip follows mouse on right-click-hold
- **File**: `src/components/charts/ChartCanvas/ReactChartPanel.tsx`
- **Problem**: Original has `showOHLCVTip` that follows the mouse cursor when right-click-holding. React updates the `ohlc-{i}` span but doesn't show a floating tooltip at cursor position.
- **Fix**: On mousemove, if right button is held, show a floating tooltip div near the cursor with O/H/L/C/V values for the bar under the cursor. On mouseup or mouseleave, hide it.

---

## Summary Table

| Phase | Items | Scope | Est. Complexity |
|-------|-------|-------|-----------------|
| G1 | 5 | Layout & structure | Medium |
| G2 | 4 | Panel header controls | Low |
| G3 | 5 | Settings wiring | Low-Medium |
| G4 | 5 | Scan & BT tabs | High |
| G5 | 4 | Lab tab | Medium |
| G6 | 6 | Annotation toolbar | Medium-High |
| G7 | 4 | Data/engine bridge | Medium |
| **Total** | **33** | **ALL COMPLETE** | |

> Note: Some original 38 items were already implemented upon audit (TabLook color pickers, save/reset, font scale, presets, session shading, PDC line, etc.)

---

## Execution Order

Recommended implementation sequence:

1. **G1** (Layout) — fixes the most visible problems first
2. **G2** (Panel header) — completes the per-panel controls
3. **G7** (Engine bridge) — makes tools/indicators actually configurable
4. **G3** (Settings) — makes all sliders functional
5. **G6** (Annotation toolbar) — completes drawing interaction
6. **G4** (Scan/BT) — deeper feature work
7. **G5** (Lab) — newest feature, lowest priority

Each phase should be a separate commit with a checkpoint.
