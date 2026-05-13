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
| 4 — Canvas | ⬜ Not Started | ~4,000 lines of render logic |
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

**Remaining `(window as any)` calls:**
- Annotation toolbar canvas interactions (annToggleDropdown, annSetWeight, etc.)
- Template save/load from dropdown
- Watchlist CRUD (wlAdd, wlToggleCollapse, etc.)
- Scan management (ScanManager)
- Render triggers (renderAll)
- Indicator settings popup
- Drawing tool canvas event handling

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

### Phase 4: Canvas Engine (hardest part)
- The 4 canvas panels are the core (~4,000 lines of render logic)
- **Recommend: Option A** — keep raw canvas in React refs, organize into modules

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
