---
phase: 01-foundation
plan: 03
subsystem: middleware
tags: [nextjs, supabase, middleware, multi-tenant, slug-resolution, auth, edge-runtime, caching]

# Dependency graph
requires:
  - 01-01  # database schema (restaurants table with slug column)
provides:
  - Next.js App Router project scaffolded with TypeScript, React 19, Next.js 16
  - Browser Supabase client factory (createBrowserClient via @supabase/ssr)
  - Server Supabase client factory (async, createServerClient with getAll/setAll cookies)
  - Middleware Supabase client for auth refresh + service role client for tenant lookup
  - Tenant slug resolution: URL slug → restaurant_id with 5-minute in-memory cache
  - x-restaurant-id and x-restaurant-name headers injected on every tenant request
  - Not-found rewrite for invalid slugs
  - SUPABASE_SERVICE_ROLE_KEY server-only enforcement (no NEXT_PUBLIC_ prefix)
affects: [02-auth, 03-manager-panel, 04-wallet, 05-owner-portal]

# Tech tracking
tech-stack:
  added:
    - next@16.1.6
    - react@19.2.4
    - "@supabase/ssr@0.8.0"
    - "@supabase/supabase-js@2.97.0"
  patterns:
    - "Three-client pattern: browser client (ANON), server client (ANON + cookies), service role client (SERVICE_ROLE, no cookies)"
    - "Module-level Map cache for slug resolution with TTL eviction (Edge Runtime compatible)"
    - "isTenantRoute() guard: excludes /dashboard, /login, /api, /_next, /not-found, static files"
    - "auth.getUser() over getSession() — getUser() verifies JWT signature server-side"
    - "getAll/setAll cookie contract (not deprecated get/set/remove)"

key-files:
  created:
    - src/middleware.ts
    - src/lib/supabase/middleware.ts
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/not-found.tsx
    - .env.local.example
    - package.json
    - tsconfig.json
    - next.config.ts
  modified: []

key-decisions:
  - "Manual Next.js setup (npm init + npm install) instead of create-next-app — directory was non-empty (supabase/ and .planning/ existed)"
  - "auth.getUser() used for session refresh (not getSession()) — verifies JWT signature, prevents tampered token replay"
  - "Service role client uses empty cookie handlers — no cookie state needed for server-to-server tenant lookups"
  - "SUPABASE_SERVICE_ROLE_KEY never prefixed NEXT_PUBLIC_ — middleware runs server-side only; exposing it in client bundle would bypass RLS for any user"

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 1 Plan 03: Next.js Middleware and Supabase Client Factories Summary

**Next.js App Router project with three-client Supabase pattern and slug-to-restaurant_id middleware resolver with in-memory TTL cache**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T02:35:03Z
- **Completed:** 2026-02-21T02:37:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Initialized Next.js 16 App Router project manually (create-next-app blocked by existing supabase/ and .planning/ dirs) with TypeScript, React 19, @supabase/ssr
- Created browser client factory (src/lib/supabase/client.ts) using createBrowserClient with NEXT_PUBLIC_ env vars
- Created async server client factory (src/lib/supabase/server.ts) using createServerClient with getAll/setAll cookie contract (not deprecated get/set/remove)
- Created middleware helper (src/lib/supabase/middleware.ts) with updateSession: auth refresh via auth.getUser() + slug resolution via service role client
- Created thin middleware entry (src/middleware.ts) delegating to updateSession with appropriate route matcher
- Slug cache: module-level Map with 5-minute TTL, stale entries evicted on access
- isTenantRoute(): correctly excludes system paths and static files, returns true for /{slug}/... patterns
- Service role key used without NEXT_PUBLIC_ prefix — server-only, never in client bundle
- TypeScript compiles without errors (npx tsc --noEmit passes)

## Task Commits

Each task was committed atomically:

1. **Task 1: Set up Next.js project and Supabase client factories** - `2eea218` (feat)
2. **Task 2: Create Next.js middleware with tenant slug resolution and caching** - `c37a4fd` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `package.json` - Next.js 16, React 19, @supabase/ssr, @supabase/supabase-js; dev scripts (dev/build/start/lint)
- `tsconfig.json` - Next.js App Router TypeScript config with bundler module resolution and @/* paths
- `next.config.ts` - Minimal Next.js configuration
- `src/lib/supabase/client.ts` - Browser client: createBrowserClient(URL, ANON_KEY)
- `src/lib/supabase/server.ts` - Server client: async createClient() with getAll/setAll cookies
- `src/lib/supabase/middleware.ts` - updateSession(): auth refresh + tenant slug resolution + caching
- `src/middleware.ts` - Next.js middleware entry: delegates to updateSession, matcher excludes static assets
- `src/app/layout.tsx` - Root App Router layout
- `src/app/page.tsx` - Root page component
- `src/app/not-found.tsx` - 404 page (rewrite target for invalid slugs)
- `.env.local.example` - Env var template: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

## Decisions Made

- Manual Next.js initialization used (create-next-app blocked by non-empty directory with supabase/ and .planning/) — all required config created manually to match what create-next-app would produce
- auth.getUser() used instead of getSession() — getSession() does not verify JWT signature server-side, making it vulnerable to tampered tokens in the cookie
- Service role client in middleware uses empty cookie handlers (getAll: []  / setAll: no-op) since it's making direct DB queries, not handling user sessions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] create-next-app refused to run in non-empty directory**
- **Found during:** Task 1
- **Issue:** `npx create-next-app@latest .` exits with "directory contains files that could conflict" when supabase/ and .planning/ exist
- **Fix:** Used `npm init -y && npm install next react react-dom @supabase/ssr @supabase/supabase-js` and manually created tsconfig.json, next.config.ts, and App Router scaffold
- **Files modified:** package.json, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx, src/app/not-found.tsx
- **Commit:** 2eea218

## Verification Notes

- `npx tsc --noEmit` passes with zero errors after both tasks
- SUPABASE_SERVICE_ROLE_KEY confirmed without NEXT_PUBLIC_ prefix in middleware.ts and .env.local.example
- All must_haves verified: createBrowserClient in client.ts, createServerClient in server.ts, updateSession in middleware.ts, middleware entry imports updateSession, restaurants table queried by slug
- Dev server verification (npm run dev + /demo-restaurant header check) deferred — requires running Supabase instance with seeded demo-restaurant slug and configured env vars

## Self-Check: PASSED

All created files confirmed present:
- FOUND: src/lib/supabase/client.ts
- FOUND: src/lib/supabase/server.ts
- FOUND: src/lib/supabase/middleware.ts
- FOUND: src/middleware.ts
- FOUND: .env.local.example
- FOUND: package.json
- FOUND: tsconfig.json

Commits verified:
- FOUND: 2eea218 (Task 1)
- FOUND: c37a4fd (Task 2)

---
*Phase: 01-foundation*
*Completed: 2026-02-21*
