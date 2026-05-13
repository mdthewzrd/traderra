# What's New — May 2026

**Staging:** https://traderra-lime.vercel.app  
**Charts only:** https://traderra-charts-staging.vercel.app

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

Charts load in **live mode by default**. Real-time price data streams automatically.

- Switching symbols keeps live mode ON
- Backtest, scanner, and custom date ranges intentionally turn live OFF

---

## 📸 Screenshots Work

The 📷 button and "Attach Screenshot" in Strategy Lab notes now capture the actual chart — candles, indicators, annotations, everything visible. Previously returned blank images.

---

## 💾 Cloud Database

All data (trades, settings, annotations, watchlists, chart layouts, templates) is stored in a cloud database. Persists across server restarts and deploys. Works the same on staging and localhost.

---

## What's NOT Changed

- Candle/price rendering engine
- Annotation drawing tools (lines, rectangles, text, arrows)
- Watchlist functionality
- Trade upload/parsing
- Renata AI sidebar
- Landing page

---

## Test It

1. Go to https://traderra-lime.vercel.app/sign-in
2. Sign in with GitHub (or Google, or create an account)
3. Open the charts terminal — live data loads automatically
4. Click **＋** to add a tool — customize its color, period, name
5. Drag tools to reorder them
6. Click **📦 VAULT** to see all tools, save a template
7. Try **S / M / L** font scale buttons in the toolbar
8. Open **LOOK** tab — change candle colors, background
9. Open **SET** tab — adjust zoom sensitivity, crosshair
10. Hit **📷** to capture a screenshot
11. Open **LAB** — create a strategy project, capture a screenshot into it
12. Go to Trades — add a trade, it persists
