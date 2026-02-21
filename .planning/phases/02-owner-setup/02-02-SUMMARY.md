---
phase: 02-owner-setup
plan: 02
subsystem: api
tags: [supabase, nextjs, route-handler, jwt, zod, admin-api, rbac]

# Dependency graph
requires:
  - phase: 02-owner-setup
    plan: 01
    provides: "Service role client factory, JWT decode pattern for reading app_role/restaurant_id from access_token, owner dashboard layout with /team nav link, restaurant_staff schema"

provides:
  - "POST /api/staff Route Handler: owner-authenticated manager creation via auth.admin.createUser with atomic restaurant_staff insert and orphan cleanup"
  - "GET /api/staff Route Handler: list managers for owner's restaurant (role=manager, deleted_at IS NULL)"
  - "Owner team management page at /dashboard/owner/team with manager creation form and manager list"

affects:
  - 02-03-PLAN
  - 03-manager

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route Handler auth guard: getUser() for trust decision, getSession() to decode JWT claims, return 401/403 before any mutation"
    - "Atomic staff creation: auth.admin.createUser → insert restaurant_staff → deleteUser on failure"
    - "Client component data pattern: fetchManagers() on mount via GET /api/staff, POST on form submit, refresh list on success"

key-files:
  created:
    - src/app/api/staff/route.ts
    - src/app/dashboard/owner/team/page.tsx
  modified: []

key-decisions:
  - "verifyOwner() helper reused in both POST and GET — extracts the JWT claim check into a shared function, avoiding code duplication in the same file"
  - "email_confirm: true on auth.admin.createUser — owner sets password directly, no email verification needed for a staff account"
  - "POST response includes email from local variable so team page can annotate newly created manager rows without a separate lookup (restaurant_staff has no email column)"

patterns-established:
  - "Route Handler owner guard: getUser() → getSession() → jwtDecode → check app_role and restaurant_id — same shape as Server Actions in auth.ts"
  - "Atomic creation with cleanup: create auth user → insert related row → deleteUser on insert failure — same pattern as atomic signup in auth.ts"

requirements-completed:
  - AUTH-03
  - AUTH-04

# Metrics
duration: 8min
completed: 2026-02-21
---

# Phase 2 Plan 2: Manager Account Creation Route Handler and Owner Team Page Summary

**Supabase admin API Route Handler for atomic manager creation (auth user + restaurant_staff with orphan cleanup) and owner team management page with creation form and manager list**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-21T03:26:07Z
- **Completed:** 2026-02-21T03:34:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- POST /api/staff creates a manager auth user via admin API with email_confirm: true, then inserts restaurant_staff atomically — deleteUser on staff insert failure prevents orphaned accounts
- GET /api/staff returns the manager list for the authenticated owner's restaurant, filtered by role=manager and deleted_at IS NULL
- Owner team page at /dashboard/owner/team: form with email/password fields, loading state, pt-BR success/error feedback, and manager list showing email (for newly created) or user_id prefix (for existing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Manager creation Route Handler** - `d777f32` (feat)
2. **Task 2: Owner team management page** - `dc7aa87` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/app/api/staff/route.ts` - POST (create manager) + GET (list managers) Route Handler with owner auth guard
- `src/app/dashboard/owner/team/page.tsx` - Client component for manager creation form and manager list

## Decisions Made

- `verifyOwner()` helper extracted into the route file to reuse the auth guard logic across POST and GET without duplication
- `email_confirm: true` passed to `auth.admin.createUser` — owner sets the password directly, email verification is unnecessary and would block the manager from logging in
- POST response includes the manager email so the team page can annotate newly created rows (restaurant_staff has no email column — a join to auth.users requires the admin API which is impractical client-side)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript errors in `src/app/dashboard/owner/settings/page.tsx` (missing `./BrandingForm`, `./LogoForm`, `./RanksForm` imports) were discovered during final TSC verification. These errors exist before this plan's changes and are caused by an untracked file that belongs to Plan 02-03. Documented in `deferred-items.md` — Plan 02-03 will create these components and resolve the errors.

## User Setup Required

None — no external service configuration required beyond what was already in place.

## Next Phase Readiness

- Manager creation flow is complete end-to-end: owner creates manager from /dashboard/owner/team → manager logs in at /login → lands on /dashboard/manager
- Manager cannot access /dashboard/owner (middleware + layout defense-in-depth from Plan 02-01 already in place)
- Plan 02-03 (settings page) can proceed: BrandingForm, LogoForm, RanksForm components need to be created to resolve pre-existing TSC errors

## Self-Check: PASSED

- `src/app/api/staff/route.ts` exists — FOUND
- `src/app/dashboard/owner/team/page.tsx` exists — FOUND
- Commit d777f32 (Task 1) — FOUND in git log
- Commit dc7aa87 (Task 2) — FOUND in git log

---
*Phase: 02-owner-setup*
*Completed: 2026-02-21*
