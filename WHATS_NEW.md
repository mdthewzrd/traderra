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

This is the biggest charts change. Indicators are no longer static on/off toggles — they're now **tool instances** you can customize:

- **Multiple of the same indicator** — e.g. two EMA bands with different periods and colors
- **Custom colors per tool** — each tool instance has its own color
- **Custom names** — rename tools to whatever makes sense to you
- **Drag to reorder** — rearrange your active tools by dragging
- **Active / Inactive sections** — toggle tools on/off without losing their settings

### Adding Tools

Click the **+** button in the toolbar to open the indicator catalog. Pick any indicator, configure its parameters, and add it as a tool instance.

### Tool Settings

Click any tool in the sidebar to open its settings panel. Change period, colors, line style, etc. Changes apply immediately to the chart.

---

## 🔥 Hot Buttons

Customizable quick-access buttons in the toolbar:

- **Hot tools** appear as buttons along the top bar for one-click toggle
- Each hot button shows the tool's custom name and color
- Dimmed (50% opacity) when toggled off, full color when on
- Right-click or use settings to customize

---

## 📦 Vault (Side Panel)

New right-side panel with tabs:

- **VAULT** — all your tool instances listed with toggle switches. Toggle any indicator on/off from here. Syncs in real-time with toolbar and chart.
- **Templates** — save your current tool setup as a reusable template. Load templates to instantly swap your entire indicator configuration.
- **Presets** — built-in indicator presets (Day Trader, Swing, Scalper, etc.) that configure a full set of tools at once.

---

## 🔤 Font Scale (S / M / L)

New S/M/L buttons in the toolbar to resize the UI:

- **S** — compact, fits more on screen
- **M** — default
- **L** — larger text for readability

Affects buttons, sidebar, labels, and prices.

---

## 📊 Charts Start Live

Charts now load in **live mode by default**. Real-time price data streams automatically.

- Switching symbols keeps live mode ON
- Backtest, scanner, and custom date ranges intentionally turn live OFF (historical views)

---

## 📸 Screenshots Work

The 📷 button and "Attach Screenshot" in Strategy Lab notes now capture the actual chart — candles, indicators, annotations, everything. Previously blank.

---

## 💾 Cloud Database

All data (trades, settings, annotations, watchlists, chart layouts) is stored in a cloud database. Persists across server restarts and deploys. Works the same on staging and localhost.

---

## What's NOT Changed

- Candle/price rendering
- Annotation drawing tools
- Scanner functionality
- Backtest engine
- Strategy Lab
- Renata AI sidebar
- Trade upload/parsing
- Landing page

---

## Test It

1. Go to https://traderra-lime.vercel.app/sign-in
2. Sign in with GitHub (or Google, or create an account)
3. Open the charts terminal — live data loads automatically
4. Click **+** to add a tool — customize its color, period, name
5. Drag tools to reorder them in the sidebar
6. Click **📦 VAULT** to see all tools, toggle them on/off
7. Save a template, then load it to swap your whole setup
8. Try **S / M / L** font scale buttons
9. Hit **📷** to capture a screenshot
10. Go to Trades — add a trade, it persists
