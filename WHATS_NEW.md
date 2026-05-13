# What's New — May 2026

## Staging URL
**https://traderra-lime.vercel.app**

---

## 🔐 Sign In with GitHub, Google, or Email

We replaced the old auth system with a new one. You can now:

- **Sign in with GitHub** — one click, uses your GitHub account
- **Sign in with Google** — one click, uses your Gmail
- **Sign in with email/password** — create an account with any email

The sign-in and sign-up pages have all three options with clear buttons.

---

## 📊 Charts Start Live

Charts now load in **live mode by default**. When you pick a symbol or hit Load, the chart starts streaming real-time price data immediately.

- Switching symbols keeps live mode ON
- Backtest, scanner, and custom date ranges intentionally turn live OFF (historical views)

---

## 📸 Screenshots Actually Work

The 📷 capture button and "Attach Screenshot" in Strategy Lab notes now **capture the actual chart** — candles, indicators, annotations, everything visible on screen. Previously they were blank.

---

## 💾 Cloud Database

Everything is now stored in a cloud database (Postgres via Neon). This means:

- Your trades, chart settings, annotations, watchlists — all persist across deploys
- No more losing data when the server restarts
- Works the same on staging and localhost

---

## What's NOT Changed

- Chart rendering (candles, indicators, tools, annotations)
- Scanner
- Backtest
- Strategy Lab
- Renata AI sidebar
- Trade upload/parsing
- Landing page

---

## Test It

1. Go to https://traderra-lime.vercel.app/sign-in
2. Sign in with GitHub (or Google, or create an account)
3. You should see your name and avatar in the sidebar
4. Open the charts terminal — live data loads automatically
5. Take a screenshot with the 📷 button — should capture the chart
6. Go to Trades — add a trade, it persists

---

## Staging Charts (standalone)
**https://traderra-charts-staging.vercel.app** — just the chart terminal, same updates (live mode, screenshot fix)
