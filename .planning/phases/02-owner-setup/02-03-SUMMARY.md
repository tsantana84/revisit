---
phase: 02-owner-setup
plan: 03
subsystem: ui
tags: [nextjs, server-actions, zod, supabase-storage, jwt, react, forms, pt-BR]

# Dependency graph
requires:
  - phase: 02-owner-setup
    plan: 01
    provides: "Branding/config schema columns on restaurants, min_visits/multiplier on ranks, restaurant-logos storage bucket with owner RLS, jwt-decode pattern for reading claims"

provides:
  - "updateBranding Server Action — persists program_name, primary_color, secondary_color, earn_rate, reward_type, point_expiry_days to restaurants table via authenticated client"
  - "uploadLogo Server Action — validates JPEG/PNG/WebP/SVG max 1MB, uploads to restaurant-logos bucket with upsert, saves public URL to restaurants.logo_url"
  - "updateRanks Server Action — delete+insert strategy replaces ranks config with sort_order assigned by array index"
  - "getAuthenticatedOwner() helper — JWT decode for restaurant_id + app_role verification shared by all three actions"
  - "Owner settings page at /dashboard/owner/settings — branding form, logo upload, program config, ranks management"
  - "BrandingForm client component — useActionState + updateBranding, all program config fields"
  - "LogoForm client component — useActionState + uploadLogo with current logo preview"
  - "RanksForm client component — dynamic add/remove rows, serializes to ranks_json hidden field"

affects:
  - 03-manager
  - 04-wallet
  - 05-customer

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getAuthenticatedOwner() helper: shared auth+JWT decode logic extracted to avoid repetition across Server Actions"
    - "delete+insert for ranks: clean replacement of full set, avoids partial update complexity at POC scale"
    - "ranks_json hidden field: client serializes array state to JSON string before submit, Server Action parses and validates"
    - "useActionState<State, FormData> with handleSubmit wrapper: allows programmatic formData mutation before dispatch"

key-files:
  created:
    - src/lib/actions/restaurant.ts
    - src/app/dashboard/owner/settings/page.tsx
    - src/app/dashboard/owner/settings/BrandingForm.tsx
    - src/app/dashboard/owner/settings/LogoForm.tsx
    - src/app/dashboard/owner/settings/RanksForm.tsx
  modified: []

key-decisions:
  - "getAuthenticatedOwner() helper shared by all three Server Actions — avoids repeating JWT decode + role check in each action"
  - "delete+insert strategy for ranks — simpler than upsert+reconcile at POC scale; no orphaned rows, no partial states"
  - "ranks_json hidden field pattern — client maintains dynamic row state, serializes to JSON on submit; Server Action owns validation and persistence"
  - "Zod v4 enum: use 'as const' array + { error: string } not { errorMap: fn } — API changed in v4"
  - "ZodError.issues not ZodError.errors in Zod v4 — fixed TypeScript error during Task 1 execution"

patterns-established:
  - "JSON hidden field pattern: complex client state (ranks array) serialized to JSON before form submit, validated server-side with Zod"
  - "useActionState with handleSubmit wrapper: intercepts native form submit to inject programmatic fields before dispatching to Server Action"

requirements-completed:
  - DASH-05
  - WL-01
  - WL-02
  - WL-04
  - WL-05

# Metrics
duration: 3min
completed: 2026-02-21
---

# Phase 2 Plan 3: Owner Settings — Branding, Program Config, and Ranks Summary

**Zod-validated Server Actions for restaurant branding/program/logo/ranks with owner settings page using useActionState and dynamic rank tier management**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-21T03:25:57Z
- **Completed:** 2026-02-21T03:28:49Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Three Server Actions (updateBranding, uploadLogo, updateRanks) with Zod validation and JWT-based owner authentication via shared helper
- Settings page loads current restaurant data and ranks from DB, passes to interactive client components
- RanksForm dynamically manages tier rows (add/remove/edit) and submits full array as JSON; page survives reload with persisted values

## Task Commits

Each task was committed atomically:

1. **Task 1: Restaurant configuration Server Actions** - `bc88f98` (feat)
2. **Task 2: Owner settings page with branding, program config, and ranks management** - `f173739` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/lib/actions/restaurant.ts` - Three Server Actions: updateBranding, uploadLogo, updateRanks; getAuthenticatedOwner helper
- `src/app/dashboard/owner/settings/page.tsx` - Server Component: loads restaurant + ranks via JWT, passes to client forms
- `src/app/dashboard/owner/settings/BrandingForm.tsx` - Client: program_name, colors, earn_rate, reward_type, point_expiry_days form with useActionState
- `src/app/dashboard/owner/settings/LogoForm.tsx` - Client: file upload with logo preview, useActionState + uploadLogo
- `src/app/dashboard/owner/settings/RanksForm.tsx` - Client: dynamic rank rows, add/remove, JSON serialization, useActionState + updateRanks

## Decisions Made

- `getAuthenticatedOwner()` helper shared by all three Server Actions — avoids repeating JWT decode + role check in each action
- Delete+insert strategy for ranks — simpler than upsert+reconcile at POC scale; no orphaned rows, no partial states
- `ranks_json` hidden field pattern — client maintains dynamic row state in React, serializes to JSON on submit; Server Action owns all validation
- Zod v4 enum requires `as const` array syntax + `{ error: string }` not `{ errorMap: fn }` — discovered and fixed during Task 1 type checking
- `ZodError.issues` not `ZodError.errors` in Zod v4 — same Zod v4 API change, auto-fixed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 enum API mismatch**
- **Found during:** Task 1 (Restaurant configuration Server Actions)
- **Issue:** `z.enum(['a','b'], { errorMap: () => ... })` throws TS2769 in Zod v4 — `errorMap` was renamed; also `ZodError.errors` → `ZodError.issues`
- **Fix:** Changed to `z.enum([...] as const, { error: '...' })` and `.issues.map(...)`
- **Files modified:** `src/lib/actions/restaurant.ts`
- **Verification:** `npx tsc --noEmit` passed with zero errors
- **Committed in:** `bc88f98` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Zod v4 API)
**Impact on plan:** Minor — Zod v4 API differences from v3; fixed inline during Task 1. No scope creep.

## Issues Encountered

None beyond the Zod v4 API fix above.

## User Setup Required

None — storage bucket and schema were created in Plan 02-01.

## Next Phase Readiness

- All branding/program/logo/ranks persistence is functional — Phase 3 (manager flow) and Phase 4 (wallet generation) can read restaurant config
- earn_rate, reward_type, point_expiry_days ready for Phase 3 points engine
- ranks with min_visits and multiplier ready for Phase 3 rank assignment logic
- logo_url and primary/secondary colors ready for Phase 4 wallet pass generation

## Self-Check: PASSED

All created files verified present. Both task commits (bc88f98, f173739) confirmed in git log.

---
*Phase: 02-owner-setup*
*Completed: 2026-02-21*
