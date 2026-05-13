# What's New — May 2026

**Staging:** https://traderra-lime.vercel.app  
**Charts only:** https://traderra-charts-staging.vercel.app

---

## 🎨 Drawing Tools Overhaul (May 13)

The left sidebar drawing toolbar has been completely rebuilt with new tools, fixed rendering, and improved UX.

### New Tools
- **Horizontal Ray** — extends a horizontal line infinitely to the right
- **Cross Line** — vertical + horizontal line through a point
- **Parallel Channel** — 3-click: draw a line, then set the offset line
- **Disjoint Channel** — 3-click: two non-parallel lines
- **Circle** — drag to define bounding box
- **Ellipse** — drag to define bounding box
- **Triangle** — drag to define bounding box
- **Gann Box** — box with horizontal + vertical grid lines at 1/8 ratios
- **Polyline / Path** — multi-click to add points, double-click or Enter to finish
- **Brush** — freehand drawing with round caps
- **Highlight** (all 4 colors) — now freehand highlighter strokes instead of rectangles (thick, flat cap, semi-transparent)

### Improved Tools
- **Fibonacci Retracement** — configurable levels with enable/disable per level, add custom levels, reset to defaults. Click ⚙ on a fib annotation to edit
- **Gann Box** — toggle grid lines, labels, and grid color in settings (⚙)
- **Long/Short Positions** — separate entry/TP/stop colors, editable stop price in settings
- **All line tools** (ray, hray, xline) — proper rendering with configurable line style

### Removed (non-functional)
- **Patterns** category (ABCD, XABCD, Cypher, Head & Shoulders, Elliott Waves)
- **Pitchforks** category (Andrews, Schiff, Modified Schiff)
- **Dead fib tools** (Extension, Speed Fan, Time Zone, Wedge, Gann Fan)

### Features
- **Magnet Snap** — 🧲 button snaps drawing points to nearest OHLC value
- **Lock All** — 🔒 button prevents moving any annotation
- **Hide All** — 👁 button hides all annotations without deleting them
- **Fib Level Editor** — ⚙ settings on a fib shows each level with checkbox, editable %, computed price, Add/Reset buttons
- **Highlighter style** — all 4 highlight colors (cyan, magenta, green, white) now draw like a real highlighter: thick freehand stroke with flat cap

---

## 🔐 OAuth Redirect Fix (May 13)

GitHub and Google sign-in from the charts staging page now works correctly:
- Uses same-origin redirect via `/charts-login` page on the API domain
- Avoids `state_mismatch` errors from cross-origin cookie issues
- After sign-in, redirects back to whichever charts page you came from (staging or production)

---

## 🔐 Sign In with GitHub, Google, or Email

Brand new auth system with three ways to sign in:

- **Continue with GitHub** — one click
- **Continue with Google** — one click
- **Email + password** — create an account with any email

Your name and profile picture show up in the sidebar.

---

## 🧰 Tool Instance System

Indicators are no longer static on/off toggles — they're **tool instances** you can customize:

- **Multiple of the same indicator** — e.g. two EMA bands with different periods and colors
- **Custom colors per tool** — each tool instance has its own color
- **Custom names** — rename tools to whatever makes sense to you
- **Drag to reorder** — rearrange your active tools by dragging
- **Active / Inactive sections** — toggle tools on/off without losing their settings

Click the **＋** button to open the indicator catalog. Pick any indicator, configure its parameters, and add it.

---

## 🔥 Hot Buttons

Customizable quick-access buttons in the top toolbar:

- Each hot tool appears as a button for one-click toggle
- Shows the tool's custom name and color
- Dimmed at 50% opacity when off, full color when on

---

## 📋 Side Panel (7 Tabs)

The right side panel has been completely rebuilt with 7 tabs:

### LOOK
Customize the chart appearance:
- Candle colors (up/down), volume colors
- Chart background and axis colors
- Candle body/wick style (filled, hollow, etc.)
- Fake bar filter (removes suspicious prints)

### TOOLS
Tool instance manager:
- **＋ button** — opens the indicator catalog to add new tools
- Select any tool to see its settings (period, colors, line style)
- Changes apply immediately to the chart
- Click a tool name to rename it

### SET (Settings)
Chart behavior and display tuning:
- **Input** — zoom sensitivity, trackpad pan speed, mouse scroll speed, right padding
- **Display** — crosshair color/opacity, price label size, time label size
- **Font Scale** — S/M/L buttons in the toolbar resize all UI text
- Save button persists your settings

### VAULT
Indicator vault — all your tool instances in one place:
- Toggle any indicator on/off with a switch
- Syncs in real-time with the toolbar hot buttons and chart
- **Templates** — save your current tool setup as a reusable template
- **Presets** — built-in configs (Day Trader, Swing, Scalper, etc.) that set up a full indicator stack
- **🔄 Update Current Template** — update an existing template with your current setup
- **💾 Save Current as Template** — save a new template

### SCAN
Stock scanner:
- Create and save custom scans
- Run scans against date ranges (1M, 3M, 6M, 1Y, 2Y)
- View scan results as a sortable signal table
- Custom computed columns with formulas
- Column settings gear icon

### BT (Backtest)
Backtest saved scans:
- Select a saved scan from the SCAN tab
- Choose side (Long/Short), hold period, entry/exit rules
- See summary stats (win rate, avg P&L, total trades)

### LAB (Strategy Lab)
Strategy research workspace:
- Create strategy projects with phases (scan, setup, entry, exit, backtest)
- **📷 Capture** — screenshot the current chart and attach it to an entry
- Add notes, ideas, comments to each phase
- Link scans to strategies
- Threaded entries for organizing research

---

## 📊 Charts Start Live

Charts load in **live mode** by default. Real-time price data streams automatically.

- Switching symbols keeps live mode ON
- Backtest, scanner, and custom date ranges intentionally turn live OFF

---

## 📸 Screenshots Work

The 📷 button and "Attach Screenshot" in Strategy Lab notes now capture the actual chart — candles, indicators, annotations, everything visible.

---

## 💾 Cloud Database

All data (trades, settings, annotations, watchlists, chart layouts, templates) is stored in a cloud database. Persists across server restarts and deploys.

---

## Test It

1. Go to https://traderra-charts-staging.vercel.app
2. Sign in with GitHub or Google
3. Try the left sidebar drawing tools — trendline, fib, circle, brush, highlight
4. Click ⚙ on a fib or gann box to edit levels/grid settings
5. Try 🧲 magnet snap, 🔒 lock all, 👁 hide all
6. Click **＋** to add an indicator — customize its color, period, name
7. Open **📦 VAULT** to save a template
8. Hit **📷** to capture a screenshot
