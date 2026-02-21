---
phase: 01-foundation
plan: 02
subsystem: testing
tags: [supabase, jwt, rls, vitest, multi-tenant, custom-access-token-hook, security-definer]

# Dependency graph
requires:
  - phase: 01-01
    provides: PostgreSQL schema with 8 tables, RLS policies, custom_access_token_hook in 0002_rls.sql
provides:
  - Custom Access Token Hook registered in config.toml (local dev auto-registration)
  - SECURITY DEFINER on hook so RLS on restaurant_staff is bypassed during JWT lookup
  - SDK-based cross-tenant isolation test suite (7 test cases, all passing)
  - check_rls_enabled() RPC function for CI enforcement of RLS across all public tables
  - vitest integration test infrastructure
affects: [02-auth, 03-manager-panel, 04-wallet, 05-owner-portal]

# Tech tracking
tech-stack:
  added: [vitest-v4.0.18]
  patterns:
    - "Custom Access Token Hook must be SECURITY DEFINER to bypass RLS when querying restaurant_staff"
    - "Each test creates its own Supabase client with signInWithPassword — JWT is baked in per client"
    - "check_rls_enabled() RPC asserts all public tables have relrowsecurity=true — CI enforcement pattern"

key-files:
  created:
    - supabase/migrations/0004_hooks.sql
    - supabase/tests/rls_isolation.test.ts
    - vitest.config.ts
  modified:
    - supabase/config.toml
    - supabase/migrations/0002_rls.sql
    - package.json

key-decisions:
  - "custom_access_token_hook must be SECURITY DEFINER — supabase_auth_admin does not bypass RLS and has no RLS policy on restaurant_staff, so the lookup silently returns null without SECURITY DEFINER"
  - "Hook configured in config.toml [auth.hook.custom_access_token] for local dev — no Dashboard step required locally"
  - "check_rls_enabled() uses SECURITY DEFINER + SET search_path='' to safely query pg_class from any role"
  - "Test cleanup in afterAll deletes in reverse FK order to avoid constraint violations"

patterns-established:
  - "Pattern: Each test case creates its own authenticated Supabase client via signInAs() helper — avoids JWT contamination across tests"
  - "Pattern: Service role client used only in beforeAll/afterAll setup/cleanup — never for business logic assertions"
  - "Pattern: check_rls_enabled() RPC is the CI enforcement mechanism — any unprotected table fails the build"

requirements-completed: [AUTH-05]

# Metrics
duration: 9min
completed: 2026-02-21
---

# Phase 1 Plan 02: JWT Hook and RLS Isolation Test Suite Summary

**Custom Access Token Hook (SECURITY DEFINER) registered in config.toml + 7-test SDK cross-tenant isolation suite that verifies JWT claims, tenant data isolation, and CI RLS enforcement**

## Performance

- **Duration:** 9 min
- **Started:** 2026-02-21T02:35:13Z
- **Completed:** 2026-02-21T02:44:40Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created `0004_hooks.sql` migration with SECURITY DEFINER hook function and `check_rls_enabled()` RPC for CI enforcement
- Registered the hook in `config.toml` under `[auth.hook.custom_access_token]` so it auto-loads on local `supabase start` — no Dashboard step required for local dev
- Fixed a critical bug: the hook function in `0002_rls.sql` was missing `SECURITY DEFINER`, causing the `restaurant_staff` lookup to silently return null because `supabase_auth_admin` has no RLS policy on that table
- Built the SDK-based cross-tenant isolation test suite with 7 test cases — all pass: tenant isolation, anon denial, cross-tenant write rejection, JWT claim injection, and RLS-enabled CI check

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Custom Access Token Hook migration and config.toml** - `31cf395` (feat)
2. **Task 2: Create SDK-based cross-tenant isolation test suite** - `0144b59` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `supabase/migrations/0004_hooks.sql` - Hook function (SECURITY DEFINER), grants, and check_rls_enabled() RPC
- `supabase/migrations/0002_rls.sql` - Added SECURITY DEFINER + SET search_path to existing hook function
- `supabase/config.toml` - Enabled [auth.hook.custom_access_token] pointing to public.custom_access_token_hook
- `supabase/tests/rls_isolation.test.ts` - 7 cross-tenant SDK test cases with beforeAll/afterAll lifecycle
- `vitest.config.ts` - Vitest config for supabase/tests/ with 30s timeout for SDK calls
- `package.json` - Added test:rls script

## Decisions Made
- **SECURITY DEFINER on hook**: The hook must be SECURITY DEFINER. `supabase_auth_admin` has SELECT GRANT on `restaurant_staff`, but RLS is enabled on that table with no policy for `supabase_auth_admin`. Without SECURITY DEFINER, the function runs as the caller role and gets 0 rows, injecting null claims silently.
- **Hook in config.toml**: The `[auth.hook.custom_access_token]` section in config.toml auto-registers the hook when `supabase start` or `supabase db reset` runs. This eliminates the Dashboard-registration requirement for local dev.
- **check_rls_enabled() as CI gate**: Rather than hardcoding a table list, the function queries `pg_class` for all public tables with `relrowsecurity = false`. Any new table added without RLS will break the build.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added SECURITY DEFINER to custom_access_token_hook**
- **Found during:** Task 2 (running tests — JWT claims were undefined)
- **Issue:** The hook ran successfully (no error logged) but `restaurant_id` and `app_role` were absent from the JWT. Root cause: `supabase_auth_admin` does not bypass RLS (`rolbypassrls = false`), and the RLS policy on `restaurant_staff` is scoped to `TO authenticated`. So the hook's lookup returned 0 rows regardless of the GRANT SELECT.
- **Fix:** Added `SECURITY DEFINER SET search_path = ''` to the function in both `0002_rls.sql` and `0004_hooks.sql`. This makes the function execute as its owner (postgres superuser) which bypasses RLS.
- **Files modified:** `supabase/migrations/0002_rls.sql`, `supabase/migrations/0004_hooks.sql`
- **Verification:** `SELECT prosecdef FROM pg_proc WHERE proname = 'custom_access_token_hook'` returns `t`. All 7 tests pass, including the JWT claims test.
- **Committed in:** `0144b59` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Critical fix — without SECURITY DEFINER, the entire JWT claim injection fails silently. Every RLS policy returns empty results for authenticated users. The fix is correct and the pattern is now documented.

## Issues Encountered
- None beyond the SECURITY DEFINER bug documented above.

## User Setup Required
None — the hook is now configured in `config.toml` and loads automatically. For cloud/production Supabase deployments, register via Dashboard → Authentication → Hooks → Custom Access Token → select `public.custom_access_token_hook`.

## Next Phase Readiness
- JWT claim injection verified end-to-end: login → hook → JWT with restaurant_id + app_role → RLS isolation confirmed
- Cross-tenant test suite is repeatable and wired for CI via `npm run test:rls`
- RLS enforcement check (`check_rls_enabled()`) will catch any unprotected tables added in future phases
- Phase 1 Plan 03 (Next.js middleware for tenant slug resolution) can proceed — the JWT claims are now correct and RLS is verified

---
*Phase: 01-foundation*
*Completed: 2026-02-21*
