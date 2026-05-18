# React vs HTML — Differences

Compared original `charts-terminal.html` (1472 lines) against React components.

## ✅ MATCHING (no changes needed)
- LeftToolbar — exact match (categories, flyouts, SVGs, bottom buttons)
- TopBar button order and labels
- TopBar DRAW/TRADE dropdowns
- Sidebar tab order (LOOK, TOOLS, SET, VAULT, SCAN, BT, LAB)
- Watchlist section (picker, add/del/rename/col buttons, list, add input)
- CSS file (charts-terminal.css) — shared, identical
- Profile icon
- Overlays (fs-backdrop, draw-hint, toast)
- AnnotationToolbar structure

## 🔴 DIFFERENCES TO FIX

### TopBar
1. **`#ticker-info` missing data** — original shows `ti-sym`, `ti-price`, `ti-chg` populated by charts-engine. React has empty spans.
2. **`hot-btns-container` now empty div** — correct (matches original behavior where it's always cleared). ✅ Already fixed.

### Sidebar
3. **Tab content visibility** — original uses CSS `.tab-active` class toggling (all tabs rendered, only one visible). React renders ALL tab components simultaneously with CSS `display:none` on non-active ones. This WORKS but means all tabs mount on first render (wasteful, potential crash source from bad localStorage data).
4. **Scan tab** — original has run controls (SCAN button, LIVE/HIST toggle, date range, F1/F2/Both filters), scan-add modal (UPLOAD/BUILT-IN/CODE tabs), watchlist quick-load. React `TabScan.tsx` is simpler (CSV upload + results list + scans CRUD). Missing: scan engine execution, built-in strategies, code editor tab, filter radio buttons.
5. **BT tab** — original has "SAVED SCANS" header, references saved scan results, has REVIEW button, has entry/stop/target config grid matching original style. React `TabBt.tsx` uses inline styles vs original's CSS classes. Missing: `scan-bt-active` info box, trigger_break entry option.
6. **Lab tab** — original has `lab-projects-list` (compact list with max-height:120px) + `lab-project-detail` (with back button, status badge, capture btn, add note btn, phase tabs, entries). React version is similar but uses full-screen list/detail views instead of the compact layout.
7. **tab-tools** — original has `tools-body` div populated dynamically by charts-engine. React `TabTools.tsx` renders tool cards from `useToolStore`. This is already correct for the React implementation.
8. **tab-settings** — original uses CSS classes `.vs`, `.vst`, `.vr`, `.vrv`. React `TabSettings.tsx` uses inline styles. Visual should be similar but not pixel-perfect.

### Main Area
9. **`#grid` div missing** — original uses `<div id="grid"></div>` as panel container. React uses direct component rendering. Functionally equivalent but means `document.getElementById('grid')` returns null if any legacy code references it.
10. **BT sidebar** — original has full BT sidebar HTML rendered in MainArea with manual sim, review save/load, etc. React moved BT to sidebar tab (TabBt.tsx) instead. This is a **structural change** — original has BT sidebar in the main area (right side) alongside chart panels.
11. **Main area margin** — original starts at `margin-right:350px` (sidebar open). React matches this. ✅

### Panel Structure (per-panel in original charts-engine)
12. **Panel HTML** — original creates panels dynamically with `.panel`, `.ph`, `.ind-row`, `.pdr`, `.cwrap`, canvas, overlay, scrollbar, nav arrows. React `ReactChartPanel` creates the same structure. ✅ Match.
13. **`bars.length` counter + ⚛ icon in ind-row** — React has these but original doesn't. Minor extra.
14. **Nav arrows (◀▶)** — original has `<div style="position:absolute;bottom:22px;right:4px">` with arrows. React has a scrollbar bar at bottom. Different approach but functionally equivalent.

### Missing Modals
15. **`#scan-add-modal`** — original has a full modal for adding scans (upload/builtin/code tabs). React doesn't have this modal.
16. **`#pct-popup`** — position sizing popup (LONG/%RISK/STOP/PLACE). Not implemented in React.
17. **`#text-popup`** — text annotation input popup. Not implemented as a modal in React (uses prompt() or inline).
18. **`#modal-overlay` + `#modal-box`** — generic modal. React doesn't have this.

### Missing Global Functions
19. Original charts-engine.js registers many `window.*` functions (`loadChart`, `renderAll`, `sbOpen`, `sbTab`, `sbClose`, `setActiveTool`, `wlAdd`, etc.). React components wire most of these but some may be missing, causing issues if legacy code or keyboard shortcuts call them.

## Summary
The main structural differences are:
1. **BT sidebar moved from main-area to sidebar tab** — biggest visual difference
2. **Missing modals** (scan-add, pct-popup, text-popup)
3. **Scan tab simplified** (no engine execution)
4. **Ticker info empty** (no live price display)
5. **Minor styling mismatches** (inline styles vs CSS classes)
