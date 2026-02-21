---
phase: 02-owner-setup
plan: 01
subsystem: auth
tags: [supabase, nextjs, server-actions, jwt, zod, slugify, storage, rls, migrations]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "JWT custom access token hook, RLS helper functions (get_restaurant_id, get_app_role), Next.js middleware with slug resolver, Supabase client factories"

provides:
  - "Branding/config schema columns on restaurants (program_name, primary_color, secondary_color, logo_url, earn_rate, reward_type, point_expiry_days)"
  - "min_visits and multiplier columns on ranks"
  - "restaurant-logos storage bucket with owner INSERT/DELETE RLS"
  - "createServiceClient() factory for Server Actions and Route Handlers"
  - "signup() Server Action — atomic auth user + restaurant + restaurant_staff with orphan cleanup"
  - "login() Server Action — JWT decode for role-based redirect to /dashboard/owner or /dashboard/manager"
  - "logout() Server Action"
  - "(auth) route group with signup and login pages (pt-BR, useActionState)"
  - "Middleware dashboard protection: /dashboard/** blocked without session, role mismatch redirects to /login"
  - "Owner dashboard layout with defense-in-depth role check and nav to /team and /settings"
  - "Manager dashboard layout with defense-in-depth role check"

affects:
  - 02-02-PLAN
  - 02-03-PLAN
  - 03-manager
  - 04-wallet

# Tech tracking
tech-stack:
  added:
    - zod@4.3.6 (server-side form validation with per-field error shapes for useActionState)
    - slugify@1.6.6 (URL-safe slug generation from restaurant name at signup)
    - jwt-decode@4.0.0 (lightweight JWT decode for reading custom claims in Server Actions and middleware)
  patterns:
    - Atomic signup: signUp() → service role insert restaurant → insert restaurant_staff → signOut() → redirect to login
    - Orphan cleanup: if any insert fails, delete all previously created records including auth user
    - Slug collision retry: catch Postgres 23505 on restaurants insert, append 4-char random suffix, retry once
    - JWT claims via jwt-decode on session.access_token (not app_metadata mirror — unreliable for custom hook claims)
    - Defense in depth: middleware does fast unauthenticated redirect; layout does authoritative role check
    - getSession() for routing/UI claim reading; getUser() for trust decisions (established pattern)

key-files:
  created:
    - supabase/migrations/0005_branding.sql
    - supabase/migrations/0006_storage.sql
    - src/lib/supabase/service.ts
    - src/lib/actions/auth.ts
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/dashboard/owner/layout.tsx
    - src/app/dashboard/owner/page.tsx
    - src/app/dashboard/manager/layout.tsx
    - src/app/dashboard/manager/page.tsx
  modified:
    - src/lib/supabase/middleware.ts (added dashboard route protection + /signup to NON_TENANT_PREFIXES)
    - package.json (added zod, slugify, jwt-decode)

key-decisions:
  - "jwt-decode used in both Server Actions (login) and middleware to read app_role from JWT access_token — app_metadata mirror is unreliable for custom hook-injected claims"
  - "signOut() + redirect('/login?signup=success') after signup instead of refreshSession() — proven pattern, avoids session cookie refresh timing uncertainty in Server Action response"
  - "string_to_array(name, '/') instead of storage.foldername() in RLS policies — safer for local Supabase CLI versions"
  - "Slug collision: catch 23505, append 4-char random suffix, retry once"
  - "/signup added to NON_TENANT_PREFIXES in middleware — prevents signup URL being treated as a tenant slug"
  - "Dashboard layouts contain nav links for /team and /settings so Plans 02-02 and 02-03 do not need to modify layout.tsx"

patterns-established:
  - "Atomic Server Action pattern: auth SDK call → service role inserts → cleanup on failure → signOut → redirect"
  - "Role-based routing: middleware (fast, JWT claim) + layout (authoritative, getUser) — both required"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - WL-03

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 2 Plan 1: Owner Setup — Auth, Schema, and Dashboard Routes Summary

**Supabase email/password owner signup with atomic restaurant creation, JWT role-based routing to /dashboard/owner or /dashboard/manager, and branding schema migration with restaurant-logos storage bucket**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T03:18:43Z
- **Completed:** 2026-02-21T03:23:23Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Schema migrations add all branding/config columns (restaurants) and min_visits/multiplier (ranks); storage bucket created with owner-scoped RLS
- Atomic signup flow: auth user + restaurant + restaurant_staff in one Server Action with rollback on partial failure, followed by signOut to force a fresh JWT with correct claims
- Login reads JWT access_token via jwt-decode, redirects owner to /dashboard/owner and manager to /dashboard/manager; middleware protects all /dashboard/** routes

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration for branding/config columns and storage bucket** - `6556f1d` (feat)
2. **Task 2: Service role client, auth Server Actions, auth pages, and middleware dashboard protection** - `583e35e` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/0005_branding.sql` - Adds program_name, primary_color, secondary_color, logo_url, earn_rate, reward_type, point_expiry_days to restaurants; multiplier, min_visits to ranks
- `supabase/migrations/0006_storage.sql` - Creates restaurant-logos public bucket with owner INSERT/DELETE RLS using string_to_array path check
- `src/lib/supabase/service.ts` - Service role client factory (no session persistence, server-only)
- `src/lib/actions/auth.ts` - signup(), login(), logout() Server Actions
- `src/app/(auth)/layout.tsx` - Minimal centered layout for auth pages
- `src/app/(auth)/signup/page.tsx` - Owner signup form with useActionState, per-field Zod errors (pt-BR)
- `src/app/(auth)/login/page.tsx` - Login form with useActionState, success banner (pt-BR)
- `src/lib/supabase/middleware.ts` - Extended with dashboard route protection and /signup in NON_TENANT_PREFIXES
- `src/app/dashboard/owner/layout.tsx` - Server Component with defense-in-depth role check; nav to Painel/Equipe/Configurações
- `src/app/dashboard/owner/page.tsx` - Placeholder "Painel do Proprietário"
- `src/app/dashboard/manager/layout.tsx` - Server Component with defense-in-depth role check
- `src/app/dashboard/manager/page.tsx` - Placeholder "Painel do Gerente"
- `package.json` - Added zod, slugify, jwt-decode

## Decisions Made

- Used `jwt-decode` on session `access_token` instead of `user.app_metadata` to read `app_role` — app_metadata mirror is not reliable for custom hook-injected claims
- Used `signOut() + redirect('/login?signup=success')` after signup instead of `refreshSession()` — avoids session cookie timing uncertainty in Server Action
- Used `string_to_array(name, '/')` instead of `storage.foldername()` in RLS policies for local Supabase CLI compatibility (Open Question 3 from research)
- Added `/signup` to `NON_TENANT_PREFIXES` in middleware — prevents the signup URL from being treated as a tenant slug lookup

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required beyond what was already in place from Phase 1.

## Next Phase Readiness

- Schema ready: all branding/config columns exist for the settings form in Plan 02-02
- Auth flow complete: signup → login → dashboard routing works for owners and managers
- Dashboard layouts include nav links to /team and /settings so Plans 02-02 and 02-03 can add pages without modifying layout.tsx
- Storage bucket ready: Plan 02-02 settings form can use the restaurant-logos bucket for logo uploads

## Self-Check: PASSED

All created files verified present. Both task commits (6556f1d, 583e35e) confirmed in git log.

---
*Phase: 02-owner-setup*
*Completed: 2026-02-21*
