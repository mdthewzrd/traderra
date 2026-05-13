# Staging Changes — May 12, 2026

## URLs

| Environment | URL |
|---|---|
| **Staging (full app)** | https://traderra-lime.vercel.app |
| **Staging (charts only)** | https://traderra-charts-staging.vercel.app |
| **Production (charts only)** | https://traderra-charts.vercel.app |

## Big Picture

Two major changes in this release:

1. **Auth migrated from Clerk → Better Auth** (email/password + GitHub OAuth + Google OAuth)
2. **Database migrated from local SQLite → Neon Postgres** (persistent cloud DB)

---

## What Changed

### Authentication (Clerk → Better Auth)

| Before (Clerk) | After (Better Auth) |
|---|---|
| `@clerk/nextjs` package | `better-auth` package |
| Clerk hosted auth pages | Custom sign-in/sign-up pages |
| Email only | Email + GitHub OAuth + Google OAuth |
| Clerk user IDs | Better-auth user IDs (different format) |
| `auth()` from Clerk | `getAuthUserId(request)` from `@/lib/auth-helpers` |

**New/changed files:**
- `src/lib/auth.ts` — Better-auth server config (email, GitHub, Google providers)
- `src/lib/auth-client.ts` — React client with `useAuth()` hook (replaces Clerk's)
- `src/lib/auth-helpers.ts` — `getAuthUserId(request)` for API routes
- `src/components/auth/sign-in.tsx` — Custom sign-in page with GitHub/Google/Email
- `src/components/auth/sign-up.tsx` — Custom sign-up page with GitHub/Google/Email
- `src/components/auth/user-profile.tsx` — Shows name + avatar from OAuth
- All 20+ API routes under `src/app/api/` — Replaced `import { auth } from '@clerk/nextjs/server'` with `import { getAuthUserId } from '@/lib/auth-helpers'`

**Sign-in methods:**
1. Email + password
2. "Continue with GitHub" button
3. "Continue with Google" button

### Database (SQLite → Neon Postgres)

| Before | After |
|---|---|
| `prisma/dev.db` (local file) | Neon Postgres (cloud) |
| `provider = "sqlite"` | `provider = "postgresql"` |
| Lost on Vercel deploys | Persists across deploys |

**Changed files:**
- `prisma/schema.prisma` — `provider = "postgresql"`
- `src/lib/prisma.ts` — Standard PrismaClient (no adapter needed)
- `prisma/dev.db` — Deleted (no longer used)

### Charts Terminal Changes

| Change | Details |
|---|---|
| **Live mode default ON** | Charts start in live mode automatically |
| **Load/Watchlist keep live ON** | Switching symbols no longer disables live mode |
| **Historical views disable live** | Backtest, scanner, custom dates still turn live OFF |
| **No auto-login** | Removed `device@traderra.local` auto-creation. Uses real session if signed in, otherwise runs unauthenticated |
| **Screenshot fix** | 📷 button and "Attach Screenshot" now capture the actual chart canvas (was blank before) |

**Changed files:**
- `public/charts-terminal.html`

### Build & Deploy

- `vercel.json` — Build command now runs `prisma db push` before `next build`
- `src/app/trades/page.tsx` — Wrapped in Suspense boundary (fixes build error)
- Removed `@clerk/nextjs` dependency from `package.json`
- Added `@prisma/adapter-libsql`, `@libsql/client` (installed but not actively used — can be removed later)

---

## Environment Variables

Set in Vercel → Settings → Environment Variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Auth signing key |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | `https://traderra-lime.vercel.app` |
| `GITHUB_CLIENT_ID` | GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app |
| `GOOGLE_CLIENT_ID` | Google OAuth app |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app |
| `NEXT_PUBLIC_POLYGON_API_KEY` | Market data |

**Removed:**
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

---

## Testing

### Test account
- Email: `test@example.com`
- Password: `test123`

### What to test
1. **Sign up** — https://traderra-lime.vercel.app/sign-up
2. **Sign in with email** — https://traderra-lime.vercel.app/sign-in
3. **Sign in with GitHub** — Click "Continue with GitHub"
4. **Sign in with Google** — Click "Continue with Google"
5. **Charts terminal** — https://traderra-lime.vercel.app/charts-terminal.html → loads live by default, screenshot works
6. **Trades** — Sign in → navigate to Trades → add a trade
7. **Profile** — Sidebar shows your name + avatar (from GitHub/Google)

### Known issues
- The `device@traderra.local` user from previous sessions may still exist in the DB (harmless)
- Google OAuth consent screen shows "device@traderra.local" as test email — needs Google verification for production
- `@prisma/adapter-libsql` is installed but unused — can be removed in cleanup

---

## What's NOT changed
- All chart rendering logic (candles, indicators, annotations, tools)
- Scanner, backtest, strategy lab functionality
- Renata AI sidebar
- Trade upload/parsing
- Landing page design

---

## Rollback

If something breaks, the previous deploy is still available:
- Go to https://vercel.com/maikus-projects/traderra/deployments
- Find the last deploy from May 7 (before these changes)
- Click "Promote to Production"

Or rollback the git commit and redeploy.
