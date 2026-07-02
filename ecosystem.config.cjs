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
  ],
}
