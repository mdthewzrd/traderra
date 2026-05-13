# Handoff: Community Sharing for Traderra Charts

**Created:** 2026-05-13  
**Branch:** `feature/tool-instance-system`  
**Staging:** https://traderra-charts-staging.vercel.app  
**Main app:** https://traderra-lime.vercel.app

---

## Goal

Add community features so users can share scans, templates, and chart setups with each other. Phase 1 focuses on **shareable links** — the lowest-effort, highest-impact starting point.

---

## Current State

### Templates (already work, user-private)
- **Model:** `ChartTemplate` — `{ id, userId, name, tools (JSON) }`
- **API:** `GET/PUT /api/chart-data/templates` — CRUD, scoped to authenticated user
- **Client:** Vault tab has save/load/apply template UI. Templates serialize the full tool config (indicators + params + colors)
- **Serialization:** `tpl.tools = JSON.parse(JSON.stringify(p.tools))` in charts-terminal.html line ~13492

### Scans (already work, user-private)
- **Model:** `SavedScan` — `{ id, userId, name, type, strategy, code, dateRange, filterMode, results, tags, notes, isFavorite, signals, scannedDates }`
- **API:** `GET/POST /api/scans`, `GET/PUT/DELETE /api/scans/[id]`, `POST /api/scans/run`, `GET /api/scans/[id]/signals`
- **Client:** SCAN tab — create scans with JS code, run against date ranges, view signal table, save/load

### Chart Layout (already works, user-private)
- **Model:** `ChartLayout` — `{ id, userId, name, config (JSON) }`
- **API:** `GET/PUT /api/chart-data/layout`
- **Client:** Saves watchlist, zoom level, panel splits

### Auth
- **System:** better-auth v1.6.x — GitHub, Google, Email
- **Staging OAuth:** Fixed May 13 — uses `/charts-login` same-origin redirect on main app domain
- **DB:** PostgreSQL via Prisma, hosted on Vercel

---

## Phase 1: Shareable Templates & Scans via Link

### What to build

#### 1. DB: Add `SharedItem` model

```prisma
model SharedItem {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type        String   // "template" | "scan" | "layout"
  sourceId    String   // ID of the source template/scan/layout
  slug        String   @unique  // short URL-safe slug (6-8 chars, nanoid-style)
  name        String   // display name at time of sharing
  description String?  // optional user description
  data        String   @default("{}")  // JSON snapshot of the shared item
  viewCount   Int      @default(0)
  likeCount   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  likes       SharedItemLike[]

  @@index([slug])
  @@index([userId])
  @@index([type])
}

model SharedItemLike {
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  sharedItem  SharedItem @relation(fields: [sharedItemId], references: [id], onDelete: Cascade)
  sharedItemId String
  createdAt   DateTime   @default(now())

  @@unique([userId, sharedItemId])
}
```

#### 2. API routes

```
POST   /api/shared                    — create a shared link (takes type, sourceId, name, description)
GET    /api/shared/[slug]             — get shared item by slug (public, no auth required)
GET    /api/shared/mine               — list user's shared items (authenticated)
DELETE /api/shared/[slug]             — delete shared item (owner only)
POST   /api/shared/[slug]/like        — toggle like (authenticated)
GET    /api/shared/explore?type=&sort= — browse community (public feed, paginated)
```

**`POST /api/shared`** logic:
1. Auth required
2. Look up source item (template/scan/layout) by `sourceId`, verify ownership
3. Snapshot the data (deep clone JSON)
4. Generate unique slug (nanoid 8 chars, retry on collision)
5. Save to DB

**`GET /api/shared/[slug]`** logic:
1. No auth required (public)
2. Increment `viewCount`
3. Return `{ type, name, description, data, user: { name, image }, likeCount, viewCount, createdAt }`

**`GET /api/shared/explore`** logic:
1. No auth required
2. Filter by `type` if provided
3. Sort by `likeCount` (popular) or `createdAt` (newest)
4. Paginate (20 per page)
5. Return list with `{ slug, type, name, description, user, likeCount, viewCount }`

#### 3. Client UI: Share buttons

**In Vault tab (templates):**
- Each saved template row gets a **🔗 Share** button
- Clicking it:
  1. `POST /api/shared` with `{ type: "template", sourceId: tpl.id, name: tpl.name }`
  2. Shows toast with the share link: `https://traderra-lime.vercel.app/shared/{slug}`
  3. Copy to clipboard

**In SCAN tab (scans):**
- Each saved scan row gets a **🔗 Share** button
- Same flow, `type: "scan"`

**Import flow (when someone opens a shared link):**
1. User visits `https://traderra-lime.vercel.app/shared/{slug}`
2. Page loads the shared item data
3. If not logged in → show preview + "Sign in to import" CTA
4. If logged in → show "Import this {type}" button
5. Import creates a copy in user's own templates/scans
6. Redirect to charts with the imported item active

#### 4. Community Explore page (optional, nice-to-have)

`/explore` route — browse shared templates and scans:
- Filter by type (templates / scans)
- Sort by popular / newest
- Search by name
- Each card shows: name, author, like count, import button
- One-click import into your own vault

---

## File Locations

| File | Purpose |
|------|---------|
| `/home/mdwzrd/traderra/public/charts-terminal.html` | Charts app (~13,800 lines) |
| `/home/mdwzrd/traderra-charts/public/index.html` | Deploy copy → staging |
| `/home/mdwzrd/traderra/prisma/schema.prisma` | DB schema |
| `/home/mdwzrd/traderra/src/app/api/chart-data/templates/route.ts` | Templates API |
| `/home/mdwzrd/traderra/src/app/api/scans/route.ts` | Scans API |
| `/home/mdwzrd/traderra/src/app/api/scans/[id]/route.ts` | Single scan API |

## Key Code References

### Template serialization (client-side)
```
charts-terminal.html:13492  — tpl.tools = JSON.parse(JSON.stringify(p.tools))
charts-terminal.html:13500  — applyTemplate(idx) — restores tools from template
charts-terminal.html:13459  — save template to server via PUT /api/chart-data/templates
```

### Scan serialization (client-side)
```
charts-terminal.html:8352  — runScan() — runs scan code
charts-terminal.html:8600s — saveScan() — POST /api/scans
```

### Share button placement
```
charts-terminal.html — Vault tab template list (search for "template" in sidebar)
charts-terminal.html — SCAN tab saved scans list
```

## Design Decisions to Make

1. **Slug format**: nanoid 8 chars (`abc123XY`) vs human-readable (`my-ema-setup`)? Recommend nanoid — simpler, no uniqueness headaches
2. **Snapshot vs live reference**: Share a snapshot (frozen at share time) or live reference (always shows latest version)? Recommend snapshot — predictable, no surprises
3. **Explore page**: Build now or later? Recommend later — share links alone are high value, explore can follow
4. **Rate limits**: Consider limiting shares per user (e.g. 50 max) to prevent spam

## Deploy Notes

- **NEVER deploy to production** (traderra-charts.vercel.app) without explicit user confirmation
- After touching staging: `cp public/charts-terminal.html /home/mdwzrd/traderra-charts/public/index.html && cd traderra-charts && npx vercel --prod --yes`
- After any `vercel link` operation, re-link: `npx vercel link --yes -p traderra-charts-staging`
- Staging has `no-store` cache headers in `traderra-charts/vercel.json`
- Source of truth is always `/home/mdwzrd/traderra/public/charts-terminal.html`

## Future Vision (post-agent-framework)

- **Share agent workflows** — strategy agents as shareable "bots"
- **Copy-trade alerts** — opt-in sharing of entries/exits
- **Community leaderboard** — which scans/templates produce best results
- **Comments/discussions** on shared items
