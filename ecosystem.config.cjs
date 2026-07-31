// PM2 process config for Traderra.
//
// WHY THIS EXISTS:
// Traderra runs `next start` (production) reading .next/. When a `npm run build`
// runs WITHOUT stopping the server first, .next/ is rewritten mid-flight →
// `middleware-manifest.json` goes missing → the server crash-loops on startup.
// With PM2's DEFAULTS (min_uptime 1s, max_restarts 16) it fast-crashes ~16x,
// decides the process is "unstable", and GIVES UP → stays `stopped` forever,
// even after the build finishes and .next/ is perfectly intact again.
//
// This config makes it SELF-HEAL:
//   - max_restarts: 100    — don't give up during a build (an 80s build causes ~20 crashes)
//   - restart_delay: 3000  — don't thrash the CPU; space retries 3s apart
//   - exp_backoff_restart_delay: 1500 — if it keeps failing, back off progressively
//     so by the time the build finishes, the next retry finds .next/ intact and STAYS UP
//
// The correct way to rebuild is `npm run deploy` (scripts/deploy.sh) which stops
// BEFORE building, avoiding the race entirely. This config is the safety net for when
// a bare `npm run build` slips through.
module.exports = {
  apps: [
    {
      name: 'traderra',
      script: 'npx',
      args: 'next start -p 6565',
      cwd: '/home/mdwzrd/traderra',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      exp_backoff_restart_delay: 1500,
      min_uptime: '5s',
      watch: false,
      env: { NODE_ENV: 'production' },
    },
    // ── Live D1 premarket scanners (run_get_d1s.py) ──────────────────────────
    // Push via /api/scans/push → SSE → /live-scan. Active 7:00–10:00 ET, 30s poll.
    // Died 2026-07-01 and were never restored → no live d1-gap/d1-gap-wide data.
    // --live = strict/valid (d1-gap); --live --wide = d1-gap-wide;
    // --potential-live = relaxed candidates (d1-gap-potential).
    {
      name: 'd1-gap-live',
      script: 'run_get_d1s.py',
      interpreter: '/home/mdwzrd/edge.dev/.venv/bin/python',
      args: '--live',
      cwd: '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      watch: false,
      env: {
        PUSH_URL: 'http://127.0.0.1:6565/api/scans/push',
        SCANNER_URL: 'http://127.0.0.1:6565/api/scans',
      },
    },
    {
      name: 'd1-gap-wide-live',
      script: 'run_get_d1s.py',
      interpreter: '/home/mdwzrd/edge.dev/.venv/bin/python',
      args: '--live --wide',
      cwd: '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      watch: false,
      env: {
        PUSH_URL: 'http://127.0.0.1:6565/api/scans/push',
        SCANNER_URL: 'http://127.0.0.1:6565/api/scans',
      },
    },
    {
      name: 'd1-gap-potential-live',
      script: 'run_get_d1s.py',
      interpreter: '/home/mdwzrd/edge.dev/.venv/bin/python',
      args: '--potential-live',
      cwd: '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      watch: false,
      env: {
        PUSH_URL: 'http://127.0.0.1:6565/api/scans/push',
        SCANNER_URL: 'http://127.0.0.1:6565/api/scans',
      },
    },
    // D1 Gap WIDE potentials — relaxed candidates pushed as d1-gap-wide-potential.
    // Without this, d1-gap-wide valid names (e.g. BJDX, TDTH) had no matching
    // potential feed → appeared in Valid but not Potentials on /live-scan.
    {
      name: 'd1-gap-wide-potential-live',
      script: 'run_get_d1s.py',
      interpreter: '/home/mdwzrd/edge.dev/.venv/bin/python',
      args: '--potential-live --wide',
      cwd: '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      watch: false,
      env: {
        PUSH_URL: 'http://127.0.0.1:6565/api/scans/push',
        SCANNER_URL: 'http://127.0.0.1:6565/api/scans',
      },
    },
    // ── Live intraday scanner (live_spec_poller.py) ────────────────────────
    // Evaluates backside/frontside YAML specs (relaxed) against the forming
    // intraday bar 9:30–16:00 ET, 45s poll. STICKY: once a name hits a spec it
    // stays in that day's potential set. Pushed as <spec>-potential → /live-scan
    // backside/frontside boxes' Potentials tab. Universe = Polygon gainers funnel.
    // Also still runs the premarket pm-movers/max-scan specs 7–10am.
    {
      name: 'intraday-spec-live',
      script: 'live_spec_poller.py',
      interpreter: '/home/mdwzrd/edge.dev/.venv/bin/python',
      cwd: '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      watch: false,
      env: {
        // live_spec_poller treats PUSH_URL as the bare API origin and appends
        // /api/scans itself (unlike run_get_d1s.py which wants the full push path).
        PUSH_URL: 'http://127.0.0.1:6565',
        SCANNER_URL: 'http://127.0.0.1:6565/api/scans',
      },
    },
    // ── Live D1 PM G&C premarket poller (run_real_d1_pm_gc_live.py) ─────────
    // Mirrors d1-gap-live: snapshot gainers → per-ticker 1-min PM bars → G&C
    // trigger (pm_high/prev_close>=+50%, pm_high/prev_high>=+20%, pm_vol>=1M,
    // prev_close>=$0.75, D-1 move<=±20%). Sticky seen-dict (keep any name that
    // pings). push_full_state → SSE + one type:'live' SavedScan (upsert/strategy).
    // Active 7:00–10:00 ET, 30s poll. REQ-289.
    {
      name: 'real-d1-pm-gc-live',
      script: 'run_real_d1_pm_gc_live.py',
      interpreter: '/home/mdwzrd/edge.dev/.venv/bin/python',
      cwd: '/home/mdwzrd/.wzrd-pi-dev/projects/edge-dev/uploads',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 100,
      restart_delay: 3000,
      watch: false,
      env: {
        PUSH_URL: 'http://127.0.0.1:6565/api/scans/push',
        SCANNER_URL: 'http://127.0.0.1:6565/api/scans',
      },
    },

  ],
}
