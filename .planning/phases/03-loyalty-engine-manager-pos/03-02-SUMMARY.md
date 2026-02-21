---
phase: 03-loyalty-engine-manager-pos
plan: "02"
subsystem: api
tags: [server-actions, supabase, rpc, jwt, zod, luhn, portuguese, pos]

# Dependency graph
requires:
  - phase: 03-01
    provides: register_sale RPC, validateCardNumber utility, active_customers view

provides:
  - lookupCustomer Server Action (read-only preview with points calculation)
  - registerSale Server Action (atomic commit via register_sale RPC)
  - LookupState and SaleState discriminated union types
  - getAuthenticatedManager helper (owner + manager roles, staff ID from DB)

affects:
  - 03-03-PLAN.md (manager POS UI will consume lookupCustomer and registerSale)
  - 04-wallet-pass (SaleState.rankPromoted and SaleState.newRankName ready for card color change)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Action with discriminated union state (step: 'preview' | 'error' | 'success' | undefined)
    - getAuthenticatedManager helper accepting dual roles (owner + manager)
    - Staff ID resolved from active_restaurant_staff view (not from JWT sub)
    - Read-only preview action pattern (lookupCustomer writes nothing to DB)
    - RPC delegation for atomic writes (registerSale delegates all DB work to PostgreSQL RPC)
    - Zod refine with { message } syntax for custom validators

key-files:
  created:
    - src/lib/actions/pos.ts
  modified: []

key-decisions:
  - "getAuthenticatedManager accepts both owner and manager roles — owners need POS access for POC flexibility"
  - "Staff ID resolved via active_restaurant_staff.id filtered by user_id — not assumed from JWT sub to match RPC expectation"
  - "lookupCustomer is pure read — zero .insert/.update/.upsert/.delete calls, safe to call on card swipe without side effects"
  - "registerSale delegates entirely to register_sale RPC — no sequential DB calls, atomicity guaranteed by PostgreSQL"
  - "SaleState includes rankPromoted and newRankName — surfaces RPC promotion data for Phase 4 wallet card color change without implementing display logic here"
  - "Points preview formula: Math.round(amountCents / 100 * earnRate * multiplier) — integer result, matches register_sale RPC ROUND()::INTEGER calculation"

patterns-established:
  - "POS Server Actions pattern: lookupCustomer (preview) + registerSale (commit) as two-step flow"
  - "Dual-role auth helper: getAuthenticatedManager checks app_role in ['manager', 'owner']"
  - "Error messages in pt-BR with proper accents throughout all user-facing strings"

requirements-completed: [PTS-01, PTS-02, PTS-03, RANK-03, RANK-04, RANK-05]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 03 Plan 02: POS Server Actions Summary

**lookupCustomer (read-only preview with points calculation) and registerSale (atomic RPC delegation) Server Actions with dual-role auth and pt-BR error messages**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T12:58:07Z
- **Completed:** 2026-02-21T13:03:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `src/lib/actions/pos.ts` with `'use server'` directive and three exports: `lookupCustomer`, `registerSale`, `LookupState`, `SaleState`
- Implemented `getAuthenticatedManager` internal helper that accepts both owner and manager roles, resolves staff ID from `active_restaurant_staff` view (not JWT sub)
- `lookupCustomer` performs read-only preview: validates card + amount, queries `active_customers`, `active_ranks`, `active_restaurants` for points calculation, returns no DB writes
- `registerSale` delegates entirely to `register_sale` PostgreSQL RPC for atomic commit, maps application-level error codes to Portuguese messages
- `SaleState` surfaces `rankPromoted` and `newRankName` from RPC response for Phase 4 wallet card color consumption

## Task Commits

Each task was committed atomically:

1. **Task 1: POS Server Actions — lookupCustomer and registerSale** - `edcafff` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/actions/pos.ts` — POS Server Actions: getAuthenticatedManager helper, lookupCustomer (read-only preview), registerSale (RPC delegation), LookupState and SaleState types

## Decisions Made

- `getAuthenticatedManager` accepts both `owner` and `manager` roles — owners need POS access for POC flexibility
- Staff ID resolved via `active_restaurant_staff.id` filtered by `user_id` — not assumed from JWT `sub`, matching what the RPC expects
- `lookupCustomer` is pure read — zero write operations, safe to call on card scan without side effects
- `registerSale` delegates entirely to `register_sale` RPC — no sequential DB calls, atomicity guaranteed by PostgreSQL transaction
- `SaleState` includes `rankPromoted` and `newRankName` — surfaces RPC promotion data for Phase 4 wallet card color change without implementing display logic here
- Points preview formula: `Math.round(amountCents / 100 * earnRate * multiplier)` — integer result, matches RPC `ROUND()::INTEGER` calculation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `lookupCustomer` and `registerSale` are ready for consumption by the manager POS UI (Plan 03-03)
- `SaleState.rankPromoted` and `SaleState.newRankName` are available for Phase 4 wallet card color change logic
- TypeScript compiles cleanly with no errors

---
*Phase: 03-loyalty-engine-manager-pos*
*Completed: 2026-02-21*
