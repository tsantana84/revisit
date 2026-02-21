---
phase: 03-loyalty-engine-manager-pos
plan: "04"
subsystem: ui
tags: [react, nextjs, useActionState, pos, loyalty, rewards, portuguese]

# Dependency graph
requires:
  - phase: 03-loyalty-engine-manager-pos
    provides: POS server actions (lookupCustomer, registerSale), reward server actions (checkRewardAvailability, registerRedemption)
provides:
  - Manager POS page with three-phase card lookup -> sale confirmation -> success flow
  - Client-side check-digit validation via validateCardNumber before any DB query
  - RewardSection component calling checkRewardForCurrentManager after sale success
  - Stripped-down manager layout (Painel + Sair only — no analytics/customer/settings nav)
affects: [04-wallet-pass-generation]

# Tech tracking
tech-stack:
  added: []
  patterns: [useActionState for multi-step form flow, three-phase conditional UI rendering, inline client-side validation before server action, server-action wrapper resolving restaurantId from JWT]

key-files:
  created: []
  modified:
    - src/app/dashboard/manager/page.tsx
    - src/lib/actions/rewards.ts

key-decisions:
  - "checkRewardForCurrentManager wrapper added to rewards.ts — resolves restaurantId from JWT so POS page doesn't need to pass it explicitly"
  - "RewardSection uses checkRewardForCurrentManager (not checkRewardAvailability) — avoids exposing restaurantId as client-side hidden input"
  - "Three-phase flow (lookup -> preview -> success) driven by useActionState return values — no local phase enum needed"
  - "resetTrigger local state resets Phase 1 without window.location.reload — preserves React hydration"

patterns-established:
  - "Multi-step POS flow: useActionState hooks chain phases via step field in return value"
  - "Inline validation pattern: client runs validateCardNumber before form submit, shows error without server round-trip"

requirements-completed: [MGR-01, MGR-02, MGR-03, MGR-04, MGR-05, MGR-06, MGR-07]

# Metrics
duration: 15min
completed: 2026-02-21
---

# Phase 3 Plan 04: Manager POS Summary

**Single-function Manager POS page with card lookup, two-step sale confirmation, points preview, rank promotion notice, and reward display — all in pt-BR using useActionState chains**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-21T09:50:00Z
- **Completed:** 2026-02-21T14:18:59Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 2

## Accomplishments

- Manager POS page replaced placeholder with full 562-line 'use client' component implementing the complete card lookup -> sale confirmation -> success flow
- Client-side validateCardNumber provides inline format feedback before any database query, preventing unnecessary lookups on invalid card numbers
- RewardSection component calls checkRewardForCurrentManager (new JWT-aware wrapper) to display cashback credit, free product redemption, or progressive discount info after sale success
- Manager layout verified as already compliant (Painel + Sair only) — no modification needed
- checkRewardForCurrentManager wrapper added to rewards.ts so POS page never needs restaurantId as a client-visible value

## Task Commits

Each task was committed atomically:

1. **Task 1: Manager POS page — card lookup, sale confirmation, reward flow** - `6b311a3` (feat)
2. **Task 2: Strip manager layout navigation** - no commit (layout already compliant, no changes needed)
3. **Task 3: Verify complete Manager POS flow end-to-end** - N/A (human-verify checkpoint, approved by user)

## Files Created/Modified

- `src/app/dashboard/manager/page.tsx` - Full POS interface: three-phase conditional UI, three useActionState hooks (lookup/sale/redemption), RewardSection component, inline validateCardNumber feedback
- `src/lib/actions/rewards.ts` - Added checkRewardForCurrentManager wrapper that resolves restaurantId from JWT to simplify POS page usage

## Decisions Made

- checkRewardForCurrentManager added to rewards.ts as a JWT-aware wrapper around checkRewardAvailability — avoids exposing restaurantId as a client-visible hidden input on the POS page
- Three-phase UI driven entirely by useActionState return values (step field): 'preview' shows confirmation, 'success' shows success screen — no additional local phase enum needed
- resetTrigger local state (boolean toggle) resets to Phase 1 on "Cancelar" or "Nova Venda" without window.location.reload — preserves React hydration and avoids full page reload

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added checkRewardForCurrentManager wrapper to rewards.ts**
- **Found during:** Task 1 (Manager POS page implementation)
- **Issue:** Plan specified calling checkRewardAvailability with card_number and restaurantId from POS page, but restaurantId would need to be a client-visible hidden input — exposing it unnecessarily
- **Fix:** Added checkRewardForCurrentManager to rewards.ts that extracts restaurantId from JWT server-side, keeping restaurantId server-only
- **Files modified:** src/lib/actions/rewards.ts
- **Verification:** RewardSection calls the wrapper with card_number only; restaurantId resolved from JWT in server action
- **Committed in:** 6b311a3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical, security/hygiene improvement)
**Impact on plan:** Auto-fix improves security posture by keeping restaurantId server-side. No scope creep.

## Issues Encountered

None — plan executed cleanly. Manager layout was already compliant (Painel + Sair only), so Task 2 required no changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Manager POS complete: card lookup, sale confirmation, points crediting, rank promotion detection, reward display all working end-to-end
- Phase 3 is now fully complete (all 4 plans done)
- Phase 4 (wallet pass generation) can begin — requires Apple Developer Program enrollment, Pass Type ID, WWDR G4 certificate, and .p8 APNs key (noted as prerequisite in STATE.md blockers)

---
*Phase: 03-loyalty-engine-manager-pos*
*Completed: 2026-02-21*
