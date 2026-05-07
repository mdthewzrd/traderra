# Traderra Auth Migration: Clerk → better-auth

## Why Switch
- Clerk test keys don't work on production domain
- Requires external SaaS dependency
- Framework preset issues on Vercel
- better-auth: self-hosted, works with SQLite, no external service

## Stack
| Component | Current | New |
|-----------|---------|-----|
| Auth | Clerk (SaaS) | better-auth (self-hosted) |
| DB | Prisma + SQLite (local file) | Same — just add better-auth tables |
| API | Next.js API routes | Same routes, better-auth middleware |
| Frontend | Clerk components | Custom sign-in modal (email + Google OAuth) |

## Migration Plan

### Phase 1: Install & Configure better-auth
1. `npm install better-auth`
2. Create `lib/auth.ts` — better-auth config with:
   - Email/password provider
   - Google OAuth (optional, can add later)
   - SQLite adapter (use existing Prisma connection or direct better-sqlite3)
   - Session cookie strategy
3. Add better-auth tables to Prisma schema (user, session, account, verification)
4. Run `prisma db push`
5. Create `api/auth/[...path]/route.ts` — catches all auth requests

### Phase 2: API Middleware
1. Replace Clerk `auth()` calls with better-auth session check
2. Update all `/api/chart-data/*` routes
3. Remove Clerk from middleware.ts
4. Remove `@clerk/nextjs` dependency

### Phase 3: Frontend Auth UI
1. Profile icon dropdown with:
   - **Not signed in**: Email/password sign-in form, Google button
   - **Signed in**: Profile info, Settings link, Sign out button
2. Sign-in modal overlay (not redirect to separate page)
3. Remove Clerk sign-in/sign-up pages

### Phase 4: Clean up
1. Remove `@clerk/nextjs` from package.json
2. Remove Clerk env vars
3. Remove Clerk middleware
4. Test full flow: sign up → sign in → data saves → sign out

## better-auth Config

```typescript
// lib/auth.ts
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "./prisma"

export const auth = betterAuth({
  database: prismaAdapter(prisma),
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }
  },
  session: {
    cookieCache: { enabled: true, maxAge: 5 * 60 }, // 5 min cache
  }
})
```

## Prisma Schema Additions

```prisma
// better-auth auto-creates these, but for reference:
model User {
  id String @id
  email String @unique
  name String?
  emailVerified Boolean @default(false)
  image String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  // relations...
}

model Session {
  id String @id
  userId String
  user User @relation(fields: [userId], references: [id])
  token String @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id String @id
  userId String
  user User @relation(fields: [userId], references: [id])
  accountId String
  providerId String
  accessToken String?
  refreshToken String?
  accessTokenExpiresAt DateTime?
  refreshTokenExpiresAt DateTime?
  scope String?
  idToken String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Verification {
  id String @id
  identifier String
  value String
  expiresAt DateTime
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

## Frontend Auth Modal (in charts-terminal.html)

The profile icon opens a dropdown/modal with:

**Guest state:**
```
┌─────────────────────┐
│  Sign In            │
│  ─────────────────  │
│  Email: [________]  │
│  Pass:  [________]  │
│  [Sign In]          │
│  ─────────────────  │
│  [Sign Up]          │
│  [Continue w/ Google]│
└─────────────────────┘
```

**Signed-in state:**
```
┌─────────────────────┐
│  👤 user@email.com   │
│  ─────────────────  │
│  ✓ Synced           │
│  ⚙ Settings         │
│  🚪 Sign Out        │
└─────────────────────┘
```

## Environment Variables (replacing Clerk)
```env
BETTER_AUTH_SECRET=<random-32-chars>
GOOGLE_CLIENT_ID=xxxx          # optional
GOOGLE_CLIENT_SECRET=xxxx      # optional
```

## Risk
- Need to remove existing Clerk user data (none exists yet — we're pre-launch)
- better-auth generates its own Prisma schema — may conflict with existing User model
- Solution: rename existing User model to AppUser, or let better-auth manage the user table
