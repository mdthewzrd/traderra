# Traderra Auth + Cloud Storage Spec

## Problem
All user data lives in localStorage — tools, annotations, settings, templates, watchlists. Clear your browser = lose everything. No cross-device sync. No sharing.

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────┐
│  Frontend    │────▶│  Vercel /api/*   │────▶│  Turso   │
│  (static)    │◀────│  (serverless)    │◀────│  (SQLite)│
└──────────────┘     └──────────────────┘     └──────────┘
       │                     │
       │              ┌──────┴──────┐
       │              ▼             ▼
       │        better-auth   libSQL client
       │        (sessions)    (data queries)
       │
       ▼
   localStorage (guest fallback)
```

## Stack

| Component | Choice | Why |
|-----------|--------|-----|
| **Auth** | [better-auth](https://www.better-auth.com/) | Open-source, self-hostable, Clerk-like DX. Google + GitHub + email/password. Session cookies, no JWT hassle. |
| **Database** | [Turso](https://turso.tech/) | libSQL (SQLite) on the edge. Free tier: 9GB storage, 1B reads/mo. Vercel serverless friendly. |
| **API** | Vercel Serverless Functions (`/api/*`) | Already deployed on Vercel. Just add `api/` directory. Zero infra work. |
| **ORM** | [drizzle-orm](https://orm.drizzle.team/) | Type-safe SQL, works with Turso/libSQL. Lightweight, no abstraction tax. |

## Data Model

```sql
-- Users (managed by better-auth, we extend it)
-- better-auth creates: user, session, account, verification tables automatically

-- All user data tables use userId FK from better-auth

CREATE TABLE layouts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id),
  name TEXT NOT NULL DEFAULT 'default',
  tools JSON NOT NULL,           -- array of tool instances
  preset TEXT,                    -- active preset name
  presetIndCustoms JSON,         -- per-preset custom params/colors
  chartSettings JSON,            -- font scale, chart style, theme
  chartStyle JSON,               -- bar color overrides etc
  isDefault BOOLEAN DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE annotations (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id),
  symbol TEXT NOT NULL,
  data JSON NOT NULL,            -- array of annotation objects
  createdAt INTEGER,
  updatedAt INTEGER,
  UNIQUE(userId, symbol)
);

CREATE TABLE watchlists (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id),
  name TEXT NOT NULL DEFAULT 'default',
  symbols JSON NOT NULL,         -- array of symbol strings
  columns JSON,                  -- column config
  isDefault BOOLEAN DEFAULT 0,
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE templates (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id),
  name TEXT NOT NULL,
  layoutId TEXT REFERENCES layouts(id),
  tools JSON,                    -- snapshot of tools at save time
  createdAt INTEGER,
  updatedAt INTEGER
);

CREATE TABLE user_settings (
  userId TEXT PRIMARY KEY REFERENCES user(id),
  drawDefaults JSON,             -- annotation tool defaults (color, weight, style)
  toolbarPosition JSON,          -- annotation toolbar position
  theme TEXT,                    -- 'dark' | 'light'
  themeColors JSON,              -- custom theme color overrides
  trackpadSettings JSON,         -- trackpad scroll config
  updatedAt INTEGER
);
```

## localStorage → DB Mapping

| localStorage Key | DB Table | Notes |
|------------------|----------|-------|
| `traderra-tools` | `layouts.tools` | Per layout |
| `traderra-annotations-{SYM}` | `annotations` | One row per symbol per user |
| `traderra-preset` | `layouts.preset` | Active preset name |
| `traderra-preset-ind` | `layouts.presetIndCustoms` | |
| `traderra-cfg` / `traderra-chart-settings` / `traderra-chart-style` | `layouts.chartSettings` + `chartStyle` | |
| `traderra-templates` | `templates` | |
| `traderra-watchlists` / `traderra-wl-cols` | `watchlists` | |
| `traderra-draw-defaults` | `user_settings.drawDefaults` | |
| `traderra-ann-tb-pos` | `user_settings.toolbarPosition` | |
| `traderra-theme` / `traderra-theme-colors` | `user_settings.theme` + `themeColors` | |
| `traderra-trackpad` | `user_settings.trackpadSettings` | |
| `traderra-ind-buttons` | `layouts.tools` (hot buttons derived) | |
| `traderra-symbol` | NOT persisted server-side | Last-viewed symbol stays local |

## API Endpoints

### Auth (handled by better-auth middleware)
```
POST /api/auth/sign-up        — email/password
POST /api/auth/sign-in        — email/password
GET  /api/auth/sign-in/google — OAuth redirect
GET  /api/auth/sign-in/github — OAuth redirect
POST /api/auth/sign-out
GET  /api/auth/session        — current session check
```

### Data (custom endpoints)
```
GET    /api/layouts            — list user layouts
GET    /api/layouts/:id        — get layout with tools
PUT    /api/layouts/:id        — save layout (upsert)
DELETE /api/layouts/:id        — delete layout

GET    /api/annotations/:symbol  — get annotations for symbol
PUT    /api/annotations/:symbol  — save annotations (upsert)

GET    /api/settings           — get user settings
PUT    /api/settings           — save user settings (upsert)

GET    /api/watchlists         — list watchlists
PUT    /api/watchlists/:id     — save watchlist
DELETE /api/watchlists/:id     — delete watchlist

GET    /api/templates          — list templates
PUT    /api/templates/:id      — save template
DELETE /api/templates/:id      — delete template
```

## Auth Flow

### Guest Mode (default, no changes)
- All data stays in localStorage (current behavior)
- Show subtle "Sign in to sync" banner in sidebar
- No feature gating — guests get full functionality

### Sign In
1. User clicks "Sign in" button (topbar or sidebar)
2. better-auth handles OAuth flow (Google/GitHub) or email/password
3. On success: session cookie set, redirect back to app
4. App detects session → migration prompt

### First-Time Sign-In Migration
1. Check if user has DB data already
2. If not: offer to "Upload your current setup" (reads localStorage → writes to DB)
3. If yes: offer to "Use cloud version" or "Keep local"
4. After migration: all saves go to DB + localStorage (dual write)

### Authenticated Mode
- Every save writes to DB AND localStorage (localStorage = offline cache)
- On load: fetch from DB, fall back to localStorage if offline
- Debounced saves (500ms) to avoid hammering API

## Frontend Changes

### New UI Elements
1. **Auth button** in topbar — shows user avatar or "Sign in" 
2. **Sign-in modal** — Google / GitHub / email tabs
3. **Migration banner** — "Upload your setup to the cloud?" after first sign-in
4. **Layout switcher** — dropdown for saved layouts (extension of current presets)

### Data Layer Abstraction
```javascript
// Replace direct localStorage calls with:
const Store = {
  async save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
    if (authState.isLoggedIn) {
      await fetch('/api/' + keyToEndpoint(key), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
  },
  async load(key) {
    if (authState.isLoggedIn) {
      try {
        const res = await fetch('/api/' + keyToEndpoint(key));
        if (res.ok) return await res.json();
      } catch(e) {} // offline fallback
    }
    return JSON.parse(localStorage.getItem(key) || 'null');
  }
};
```

## File Structure

```
traderra/
├── api/                          # Vercel Serverless Functions
│   ├── auth/
│   │   └── [...path].ts          # better-auth handler
│   ├── layouts.ts                # GET/PUT/DELETE layouts
│   ├── annotations/
│   │   └── [symbol].ts           # GET/PUT annotations
│   ├── settings.ts               # GET/PUT user settings
│   ├── watchlists/
│   │   └── [id].ts               # GET/PUT/DELETE watchlists
│   └── templates/
│       └── [id].ts               # GET/PUT/DELETE templates
├── lib/
│   ├── auth.ts                   # better-auth config
│   ├── db.ts                     # drizzle + Turso client
│   └── schema.ts                 # drizzle schema definitions
├── public/
│   └── charts-terminal.html      # (existing, modified for Store abstraction)
└── ...
```

## Implementation Phases

### Phase 1: Foundation (Session 1)
- [ ] Install better-auth + drizzle-orm + @libsql/client
- [ ] Set up Turso database + schema
- [ ] Create `lib/auth.ts`, `lib/db.ts`, `lib/schema.ts`
- [ ] Create `api/auth/[...path].ts` (better-auth handler)
- [ ] Create `api/layouts.ts` (CRUD)
- [ ] Frontend: auth button + sign-in modal
- [ ] Frontend: session detection

### Phase 2: Data Migration (Session 2)
- [ ] Create remaining API endpoints (annotations, settings, watchlists, templates)
- [ ] Frontend: `Store` abstraction layer
- [ ] Wire up `saveTools()` → `Store.save()`
- [ ] Wire up load path → `Store.load()`
- [ ] Migration flow: localStorage → DB on first sign-in

### Phase 3: Polish (Session 3)
- [ ] Dual-write with debounced API calls
- [ ] Offline fallback (read from localStorage when API fails)
- [ ] Layout switcher UI
- [ ] Cross-device sync verification
- [ ] Error handling + retry logic

## Environment Variables

```env
# Turso
TURSO_CONNECTION_URL=libsql://traderra-xxxx.turso.io
TURSO_AUTH_TOKEN=eyJxxxx

# better-auth
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=https://traderra-charts.vercel.app

# OAuth (optional, for social login)
GOOGLE_CLIENT_ID=xxxx
GOOGLE_CLIENT_SECRET=xxxx
GITHUB_CLIENT_ID=xxxx
GITHUB_CLIENT_SECRET=xxxx
```

## Cost Estimate
- **Turso**: Free tier (9GB storage, 1B row reads/mo) — more than enough
- **better-auth**: Free, self-hosted
- **Vercel**: Already paying, serverless functions included
- **Total new cost**: $0/month

## Security Notes
- All API endpoints validate session via better-auth middleware
- User can only read/write their own data (userId filter on all queries)
- No PII stored beyond email (from OAuth provider) — annotations/tools are chart data only
- Session cookies: httpOnly, secure, sameSite=lax
