# Drawing Tools Overhaul — Plan & Handoff

## Hard Lesson Learned

**Every tool option on the left sidebar was untested on staging.** The `isCallout` variable ordering bug crashed `renderPanel()` on every single chart render, meaning nothing visual worked — and it wasn't caught because testing was limited to API curl calls instead of actual browser testing of every user-facing feature.

**New rule going forward:** After ANY deploy, test EVERY user-visible feature on the actual staging URL in a browser. Not just the one thing you changed — click through every button, every dropdown, every tool, every tab. If a user can click it, it must be tested.

---

## Current State (What's Broken)

### Categories on Left Toolbar
| Category | Tools | Status |
|---|---|---|
| Trend Lines | Trend Line, H Line, V Line, Ray, H Ray, Cross Line, Parallel Channel, Disjoint Channel | ✅ Trend Line works. ❌ All others untested/likely broken |
| Fibonacci & Gann | Fib Retracement, Fib Extension, Fib Speed Fan, Fib Time Zone, Fib Wedge, Gann Fan, Gann Box | ✅ Fib Ret places. ❌ Renders full-width horizontal. ❌ All others don't work |
| Geometric Shapes | Rectangle, Circle, Ellipse, Triangle, Polyline, Highlight, Brush | ✅ Rectangle works. ❌ Circle/Ellipse don't render. ❌ Polyline doesn't exist. ❌ Highlight not a brush. ❌ Brush doesn't exist |
| Annotations | Text, Callout, Note, Price Label, Flag | Unknown — untested |
| Trade Positions | Long Entry, Long Exit, Short Entry, Cover, Stop Loss, Trail Stop, Long Position, Short Position, Forecast | Unknown — untested. Long/Short Position need multi-color editing |
| Patterns (REMOVE) | ABCD, XABCD, Cypher, Head & Shoulders, Triangle, Elliott Impulse, Elliott Correction | ❌ None work → REMOVE ENTIRELY |
| Pitchforks (REMOVE) | Andrews, Schiff, Modified Schiff | ❌ None work → REMOVE ENTIRELY |
| Measure | Measure, Zoom In | ✅ Measure works |

### Toolbar Edit/Delete
- Edit tool — untested
- Delete tool — untested
- Magnet snap — untested
- Stay in draw mode — untested
- Lock all — untested
- Hide all — untested

### Annotation Toolbar (floating toolbar when annotation selected)
- Color picker — partially works
- Weight — untested
- Line type — untested
- Opacity — untested
- More options — untested

---

## Phase 1: Cleanup & Foundation

**Goal:** Remove dead tools, fix all line tools, establish testing baseline.

### Tasks
1. **Remove Pattern category** (entire `fo-pattern` flyout + `lt-cat` button)
2. **Remove Pitchforks category** (entire `fo-fork` flyout + `lt-cat` button)
3. **Remove from Fibonacci flyout:** Fib Extension, Fib Speed Fan, Fib Time Zone, Fib Wedge, Gann Fan
4. **Keep in Fibonacci flyout:** Fib Retracement, Gann Box
5. **Fix all Line tools** — implement rendering in `renderPanel()` for:
   - `hline` — horizontal line at price level (full chart width)
   - `vline` — vertical line at time (full chart height)
   - `ray` — trendline that extends from start point to the right edge
   - `hray` — horizontal line from point extending right only
   - `xline` — cross (hline + vline combined)
   - `parallel` — two parallel trendlines (3 clicks: start, end, offset)
   - `disjoint` — two non-parallel trendlines (3 clicks: start1, end1, then start2, end2 — or simpler)
6. **Fix `handleAnnotationClick()`** to handle all line tool types (currently only checks for trendline/ray/box/hl/fib/hline/vline/measure/callout)
7. **Implement endpoint dragging** for all line types (trendline endpoint dragging exists — extend to others)
8. **Test on staging:** Click EVERY tool in Trend Lines, verify each places correctly, verify endpoint dragging, verify delete, verify edit color/weight

### Files Changed
- `public/charts-terminal.html` — left toolbar HTML, `handleAnnotationClick()`, `renderPanel()` annotation rendering section

---

## Phase 2: Shapes, Brush, Path, Fib Fix

**Goal:** All shapes render correctly, new freeform tools, Fib Retracement behaves like TradingView.

### Tasks
1. **Fix Circle rendering** — draw ellipse using `(x1,y1)` and `(x2,y2)` as bounding box. Use `ctx.ellipse()` or `ctx.arc()` with proper transform
2. **Fix Ellipse rendering** — same as circle but with different aspect ratio from bounding box
3. **Fix Triangle rendering** — draw using 3 points from bounding box (top-center, bottom-left, bottom-right)
4. **Implement Polyline/Path tool** — multi-click connected line segments:
   - Click to add points
   - Double-click or press Enter to finish
   - Each click adds a segment from previous point
   - Store as `type: 'path'` with `points: [{x,y}, {x,y}, ...]` array instead of x1/y1/x2/y2
5. **Implement Brush tool** — freeform drawing:
   - Mousedown starts, mousemove records points, mouseup ends
   - Store as `type: 'brush'` with `points: [{x,y}, ...]` dense array
   - Render as connected line segments with round lineCap/lineJoin
6. **Convert Highlight to a brush variant** — same as brush but with wide stroke (15-30px) and low opacity fill
7. **Fix Fib Retracement rendering:**
   - Horizontal lines should only span between x1 and x2 (the two click points), NOT full chart width
   - Price labels on the right end of each fib level
   - Percentage labels on the left end
   - Default levels: 0%, 23.6%, 38.2%, 50%, 61.8%, 78.6%, 100%
8. **Add Fib Retracement settings panel** (when selected):
   - Color picker for the main trendline
   - Color picker for horizontal level lines
   - Toggle individual levels on/off
   - Editable percentage values (text inputs)
   - Line style (solid/dashed/dotted)
9. **Implement Gann Box:**
   - Two clicks define the box
   - Renders horizontal and vertical grid lines at Gann ratios (1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8)
   - Labels at intersections
   - Color settings for grid lines and border
10. **Test on staging:** Draw every shape, verify brush strokes, verify fib levels are bounded, verify gann box, verify all can be deleted/edited

### Files Changed
- `public/charts-terminal.html` — rendering code for shapes, new tool types, fib rendering, gann box rendering

---

## Phase 3: Trade Positions & Polish

**Goal:** Multi-color trade position tools, entry/exit wedge arrows, full annotation toolbar.

### Tasks
1. **Long Position tool — multi-color editing:**
   - Entry line color (default green)
   - Take profit line color (default bright green)
   - Stop loss line color (default red)
   - Fill shade color (default green, low opacity)
   - When annotation selected, toolbar shows all 4 color pickers
2. **Short Position tool — multi-color editing:**
   - Same as Long but default colors are red shades
3. **New: Green wedge arrow** — simple green filled triangle pointing up (entry signal)
4. **New: Red wedge arrow** — simple red filled triangle pointing down (exit signal)
5. **Add wedge arrows to their own section** on the left sidebar (between shapes and annotations, or at top with positions)
6. **Test all entry/exit arrows:** Long Entry, Long Exit, Short Entry, Cover, Stop Loss, Trail Stop — verify rendering, colors, endpoint dragging
7. **Verify annotation floating toolbar:** color, weight, line type, opacity all work for every annotation type
8. **Verify edit/delete tools** work on every annotation type
9. **Verify magnet snap** — snaps to nearest OHLC value when placing
10. **Verify stay-in-draw mode** — tool stays active after placing
11. **Verify lock/hide all** — locks positions, hides visibility
12. **Full regression test on staging:** Click every tool, place it, edit it, delete it. Test with live data, with historical data, with multiple panels

### Files Changed
- `public/charts-terminal.html` — trade position rendering, annotation toolbar, new wedge tools, left sidebar HTML

---

## Testing Protocol (MANDATORY for every deploy)

After each phase deploy, test on **https://traderra-charts-staging.vercel.app**:

### Per-Tool Test
For EVERY tool in the left sidebar:
1. Click the tool button
2. Click on chart to place (1-click tools) or click twice (2-click tools)
3. Verify the drawing appears correctly
4. Click the drawing → verify annotation toolbar appears
5. Change color → verify it updates
6. Change weight → verify it updates
7. Click delete (×) → verify it's removed
8. Test endpoint dragging if applicable

### Full App Test
1. Chart loads with live data
2. Switching symbols works
3. All sidebar tabs work (LOOK, TOOLS, SET, VAULT, SCAN, BT, LAB)
4. Screenshot capture works
5. Sign-in/sign-up work
6. No console errors

---

## Key Code Locations in `charts-terminal.html`

| What | Line Range (approx) |
|---|---|
| Left toolbar HTML | 740-144 |
| `setActiveTool()` | ~6840 |
| `handleAnnotationClick()` | ~5753 |
| `renderPanel()` annotation section | ~3800-4300 |
| `applyDrawDefaults()` | ~4790 |
| Annotation toolbar HTML | ~887-1010 |
| Tool step/anchor logic | ~5760-5830 |
| Drawing undo/redo | ~12745 |

---

## Session Start Checklist

When starting a fresh session to implement:
1. `cd ~/traderra`
2. `DATABASE_URL="file:./prisma/dev.db" npx next dev --port 3199` (local dev)
3. Open http://localhost:3199/charts-terminal.html
4. Confirm charts load, live data streams
5. Begin Phase 1
6. After each phase: deploy to staging, run full testing protocol above
7. Fix any issues found during testing before moving to next phase
