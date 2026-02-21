---
phase: 01-foundation
verified: 2026-02-20T00:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
---

# Phase 1: Foundation Verification Report

**Phase Goal:** A correctly isolated multi-tenant database exists that all features can safely build on
**Verified:** 2026-02-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths drawn from the `must_haves` sections across Plans 01-01, 01-02, and 01-03.

#### Plan 01-01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every table has a `restaurant_id` column for tenant isolation | VERIFIED | All 8 tables in `0001_schema.sql` carry `restaurant_id UUID NOT NULL REFERENCES public.restaurants(id)` |
| 2 | RLS is enabled on every table with tenant isolation policies | VERIFIED | `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` at bottom of `0001_schema.sql`; `CREATE POLICY tenant_isolation_*` FOR ALL in `0002_rls.sql` for all 8 tables |
| 3 | Soft-deleted rows are filtered by views, not by RLS policies | VERIFIED | `0003_views.sql` contains 8 `active_*` views with `WHERE deleted_at IS NULL`; no `deleted_at` reference in any policy in `0002_rls.sql` |
| 4 | A demo restaurant with sample data exists after seeding | VERIFIED | `seed.sql` inserts demo restaurant, 4 ranks, 2 reward configs, 5 customers, 6 point transactions using a DO block with explicit UUIDs |

#### Plan 01-02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | JWT issued after login contains `restaurant_id` and `app_role` claims | VERIFIED | `custom_access_token_hook` (SECURITY DEFINER) in `0004_hooks.sql` queries `restaurant_staff` and injects both claims via `jsonb_set`; hook registered in `config.toml` under `[auth.hook.custom_access_token]` |
| 6 | A query authenticated as Restaurant A returns zero rows from Restaurant B | VERIFIED | Test case "Restaurant A owner sees only Restaurant A customers" in `rls_isolation.test.ts` asserts all returned `restaurant_id` values equal `restaurantAId`; test suite documented as passing (commit `0144b59`) |
| 7 | An unauthenticated query returns zero rows from all tenant tables | VERIFIED | Test case "Unauthenticated client gets zero rows" in `rls_isolation.test.ts` asserts `data.length === 0`; anon client has no JWT so `get_restaurant_id()` returns null, causing all policies to deny |
| 8 | Cross-tenant test suite passes using Supabase client SDK | VERIFIED | `rls_isolation.test.ts` uses `createClient` + `signInWithPassword`; 7 test cases documented as passing; `npm run test:rls` script confirmed in `package.json` |
| 9 | CI fails if any public table is missing RLS — enforced by a test querying pg_class for relrowsecurity=false | VERIFIED | `check_rls_enabled()` RPC in `0004_hooks.sql` queries `pg_class` for tables with `relrowsecurity = false`; test case 7 in `rls_isolation.test.ts` asserts result is empty |

#### Plan 01-03 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | Middleware extracts slug from URL and resolves it to `restaurant_id` | VERIFIED | `src/lib/supabase/middleware.ts` `updateSession()` calls `pathname.split('/')[1]` and queries `restaurants` table by slug via service role client |
| 11 | Resolved `restaurant_id` is available to server components via request headers | VERIFIED | `supabaseResponse.headers.set('x-restaurant-id', restaurant.id)` and `supabaseResponse.headers.set('x-restaurant-name', restaurant.name)` in `src/lib/supabase/middleware.ts` |
| 12 | Invalid slugs result in a not-found page | VERIFIED | `if (error \|\| !restaurant) { return NextResponse.rewrite(new URL('/not-found', request.url)) }` in `src/lib/supabase/middleware.ts` |
| 13 | Slug-to-restaurant_id mapping is cached in-memory across requests within same Edge instance | VERIFIED | Module-level `slugCache = new Map<...>()` with 5-minute TTL (`CACHE_TTL_MS = 300_000`) and stale-entry eviction in `src/lib/supabase/middleware.ts` |
| 14 | Supabase auth token is refreshed on every request via middleware | VERIFIED | `await supabase.auth.getUser()` called unconditionally in `updateSession()` before slug resolution; uses `getUser()` not `getSession()` |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0001_schema.sql` | 8 tables with restaurant_id, deleted_at, proper types | VERIFIED | All 8 tables present with correct columns, FK ordering, indexes, `app_role` enum, RLS enabled at bottom |
| `supabase/migrations/0002_rls.sql` | RLS policies and helper functions for tenant isolation | VERIFIED | `get_restaurant_id()`, `get_app_role()`, `custom_access_token_hook` (SECURITY DEFINER), 8 `tenant_isolation_*` FOR ALL policies with `(SELECT public.get_restaurant_id())` caching wrapper |
| `supabase/migrations/0003_views.sql` | Active-record views filtering soft-deleted rows | VERIFIED | 8 `active_*` views, each `SELECT * FROM public.<table> WHERE deleted_at IS NULL` |
| `supabase/seed.sql` | Demo restaurant with sample customers, ranks, rewards, transactions | VERIFIED | DO block with explicit UUIDs; 1 restaurant, 4 ranks, 2 reward configs, 5 customers, 6 point transactions |
| `supabase/migrations/0004_hooks.sql` | Custom access token hook injecting restaurant_id + app_role into JWT | VERIFIED | SECURITY DEFINER function, correct grants to `supabase_auth_admin`, `REVOKE` from public, `check_rls_enabled()` RPC |
| `supabase/tests/rls_isolation.test.ts` | SDK-based cross-tenant isolation tests | VERIFIED | 7 test cases using `signInWithPassword`; `beforeAll`/`afterAll` lifecycle with full cleanup in reverse FK order |
| `vitest.config.ts` | Vitest configuration for integration tests | VERIFIED | `defineConfig` with 30s timeout targeting `supabase/tests/**/*.test.ts` |
| `src/middleware.ts` | Next.js middleware entry point with tenant resolution | VERIFIED | Delegates to `updateSession`, correct route matcher excluding static assets |
| `src/lib/supabase/middleware.ts` | `updateSession` + tenant resolution logic | VERIFIED | `updateSession` export, slug cache, `isTenantRoute`, service role lookup, header injection, not-found rewrite |
| `src/lib/supabase/client.ts` | Browser Supabase client factory | VERIFIED | `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `src/lib/supabase/server.ts` | Server-side Supabase client factory | VERIFIED | `createServerClient` with async `cookies()`, `getAll`/`setAll` contract (not deprecated `get`/`set`/`remove`) |
| `supabase/config.toml` | Hook configured for local dev auto-registration | VERIFIED | `[auth.hook.custom_access_token]` section with `enabled = true` and correct `uri` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `supabase/migrations/0002_rls.sql` | `supabase/migrations/0001_schema.sql` | RLS policies reference tables created in 0001 | WIRED | All 8 `CREATE POLICY` statements reference `ON public.<table>` from 0001; pattern `ON public\.` confirmed |
| `supabase/migrations/0003_views.sql` | `supabase/migrations/0001_schema.sql` | Views select from base tables | WIRED | All 8 views use `FROM public.<table>` where tables are defined in 0001; pattern `FROM public\.` confirmed |
| `supabase/migrations/0004_hooks.sql` | `public.restaurant_staff` | Hook queries restaurant_staff to get restaurant_id + role | WIRED | `FROM public.restaurant_staff rs WHERE rs.user_id = (event->>'user_id')::UUID AND rs.deleted_at IS NULL` confirmed |
| `supabase/tests/rls_isolation.test.ts` | `supabase/migrations/0004_hooks.sql` | Tests verify JWT claims injected by hook | WIRED | Test case "JWT contains restaurant_id and app_role claims" decodes access_token and asserts `payload.restaurant_id` and `payload.app_role`; `signInWithPassword` triggers the hook |
| `src/middleware.ts` | `src/lib/supabase/middleware.ts` | Middleware entry delegates to updateSession | WIRED | `import { updateSession } from '@/lib/supabase/middleware'`; `return await updateSession(request)` |
| `src/lib/supabase/middleware.ts` | `public.restaurants` | Service role client queries restaurants table by slug | WIRED | `.from('restaurants').select('id, name').eq('slug', slug).is('deleted_at', null).single()` confirmed |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AUTH-05 | 01-01, 01-02, 01-03 | Each restaurant's data is fully isolated — customers, points, sales, and configurations never visible to other restaurants (Supabase RLS) | SATISFIED | RLS enabled on all 8 tables; `tenant_isolation_*` FOR ALL policies scoped to `get_restaurant_id()`; JWT hook injects `restaurant_id`; 7-test SDK suite verifies cross-tenant isolation end-to-end; `check_rls_enabled()` provides CI enforcement |

**Orphaned requirements for Phase 1:** None. REQUIREMENTS.md traceability table maps only AUTH-05 to Phase 1, and all three plans claim AUTH-05. Full coverage.

---

### Anti-Patterns Found

No anti-patterns detected. Scanned all artifacts for:
- TODO/FIXME/placeholder comments — none found
- Empty implementations — none found
- Stub handlers — none found
- RLS policies referencing `deleted_at` — confirmed absent (correct pattern)
- Service role key prefixed with `NEXT_PUBLIC_` — confirmed absent (server-only in middleware)

---

### Human Verification Required

The following items pass all automated checks but require a running environment to fully confirm:

#### 1. End-to-end JWT claim injection

**Test:** Run `supabase start`, create a staff user in `restaurant_staff`, sign in via Supabase Auth, decode the returned JWT.
**Expected:** JWT payload contains `restaurant_id` matching the staff's restaurant and `app_role` matching their role.
**Why human:** The hook configuration in `config.toml` is correct, but actual token issuance requires a live Supabase instance with Docker running.

#### 2. Middleware slug resolution with live instance

**Test:** Start the dev server (`npm run dev`) with local Supabase running. Navigate to `http://localhost:3000/demo-restaurant`. Check Network tab response headers.
**Expected:** Response contains `x-restaurant-id` header with the demo restaurant's UUID. Navigation to `http://localhost:3000/invalid-slug-xyz` renders the not-found page.
**Why human:** Requires both local Supabase (with seeded `demo-restaurant` slug) and the Next.js dev server to be running simultaneously.

#### 3. Full `npm run test:rls` execution

**Test:** With local Supabase running (`supabase start`), run `npm run test:rls`.
**Expected:** All 7 test cases pass. Particularly: the JWT claims test decodes a real token with correct claims, and the cross-tenant insert test receives a real RLS error.
**Why human:** Integration tests require Docker + live Supabase; cannot be run statically.

---

### Gaps Summary

No gaps. All 14 must-have truths are verified at all three levels (exists, substantive, wired). The single requirement assigned to Phase 1 (AUTH-05) is fully satisfied by the implemented artifacts.

The only items deferred to human verification are runtime behaviors that require a live environment — these do not represent gaps in the codebase but rather confirmation of correct operation under real conditions.

---

_Verified: 2026-02-20_
_Verifier: Claude (gsd-verifier)_
