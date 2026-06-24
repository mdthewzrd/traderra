# Plan: Lingua Cycle — Configurable Working Timeframe

## Summary
Make Lingua's MTF (primary cycle) and HTF (confirmation) timeframes configurable via a `mtfTf` param instead of hardcoded 1H/4H. HTF auto-derives as `mtfTf × 4`.

## Scope
### In
- Add `mtfTf` param (select: 5/15/30/60/120/240, default '60')
- HTF auto-derived: `htfOf(mtfTf)` = mtfTf × 4 minutes (60→240, 30→120, 15→60)
- Generalize `setLinguaMtfBars` to role-based (`'mtf'|'htf'`) so cache assignment isn't hardcoded to '60'
- ReactChartPanel fetches the chosen MTF/HTF pair and feeds the cache

### Out
- Auto-adapting MTF to the displayed panel TF (Option B) — explicit param only
- Changing what the chart *displays* (Lingua still overlays on whatever panel you view)

## Architecture Decisions
- **Param over auto-adapt** — explicit, tunable per-template, keeps the MTF→HTF hierarchy intact
- **HTF = 4× MTF** — preserves the fractal relationship (1H→4H becomes 30m→2H, etc.)
- **Role-based cache** — `setLinguaMtfBars('mtf'|'htf', tf, bars)` decouples cache slot from a magic TF string

## Tasks
- [ ] ADD `htfOf(tf)` export + change `setLinguaMtfBars` to role-based — `render-lingua.ts`
- [ ] READ `mtfTf` param, derive `htfTf`, fetch + feed both TFs — `ReactChartPanel.tsx`
- [ ] ADD `mtfTf` select param — `toolStore.ts`
- [ ] ADD `mtfTf: '60'` to preset — `templates.ts`

## Validation
- `npx next build` exits 0
- pm2 restart + HTTP 200
- SPY 1H renders unchanged (default mtfTf='60' → same as before)

## Risks
- Polygon may lack clean data for unusual HTF multiples (e.g. 4H MTF → 16H HTF) — mitigated by restricting options to standard TFs
