---
phase: 03-loyalty-engine-manager-pos
plan: "03"
subsystem: reward-engine
tags: [rewards, cashback, free-product, progressive-discount, server-actions, rpc, ranks, discount]
dependency_graph:
  requires:
    - register_redemption RPC function (from 03-01)
    - active_reward_configs view
    - active_ranks view with discount_pct column (from 03-01)
    - active_customers view
    - active_restaurants view
  provides:
    - checkRewardAvailability Server Action (branches on reward_type)
    - registerRedemption Server Action (handles all three reward models)
    - RewardInfo type union
    - RedemptionState type
    - discount_pct field in RanksForm UI and RankSchema validation
  affects:
    - src/app/dashboard/owner/settings/RanksForm.tsx (added discount_pct column)
    - src/lib/actions/restaurant.ts (RankSchema + updateRanks)
    - src/app/dashboard/owner/settings/page.tsx (Rank interface updated)
tech_stack:
  added: []
  patterns:
    - reward_type branching (cashback / free_product / progressive_discount)
    - RPC call pattern (supabase.rpc) for atomic point deduction
    - Audit-only redemption insert for progressive discount (points_spent = 0, zero-delta point_transaction)
    - getAuthenticatedManager() helper (same JWT decode pattern as getAuthenticatedOwner)
key_files:
  created:
    - src/lib/actions/rewards.ts
  modified:
    - src/app/dashboard/owner/settings/RanksForm.tsx
    - src/lib/actions/restaurant.ts
    - src/app/dashboard/owner/settings/page.tsx
decisions:
  - "checkRewardAvailability exported as regular async function within 'use server' module — callable from POS server component or other server actions"
  - "cashback availableCredit = Math.floor(points_balance / earn_rate) — floor ensures no partial R$ credit is shown"
  - "free_product query uses ORDER BY points_required ASC + find first qualifying — gives customer smallest achievable reward first"
  - "progressive_discount uses zero-delta point_transaction for ledger auditability without balance change"
  - "reward_redemptions.reward_config_id is NOT NULL; progressive discount uses first active config as placeholder when none provided via formData"
  - "getAuthenticatedManager() accepts owner OR manager role — owners may test POS flow directly"
metrics:
  duration: "2 min"
  completed: "2026-02-21"
  tasks_completed: 2
  files_created: 1
  files_modified: 3
---

# Phase 03 Plan 03: Reward Server Actions Summary

**One-liner:** Reward availability check and redemption Server Actions branching on reward_type (cashback, free product, progressive discount), plus discount_pct field added to RanksForm and RankSchema.

## What Was Built

### Task 1: Reward Server Actions — checkRewardAvailability and registerRedemption

Created `src/lib/actions/rewards.ts` with `'use server'` directive.

**Types exported:**

- `RewardInfo` — discriminated union: `cashback | free_product | progressive_discount | none`
- `RedemptionState` — `success (with newBalance) | error | undefined`

**checkRewardAvailability(cardNumber, restaurantId): Promise<RewardInfo>**

Reads `active_restaurants` for `reward_type` and `earn_rate`, then `active_customers` for `points_balance` and `current_rank_id`, then branches:

- **cashback:** `availableCredit = Math.floor(points_balance / earn_rate)` — returns credit amount in R$
- **free_product:** queries `active_reward_configs` ordered by `points_required ASC`, finds first config where `points_balance >= points_required`. Returns `available: true/false` with reward name and ID.
- **progressive_discount:** queries `active_ranks` by `current_rank_id` for `discount_pct` and `name`. Defaults to 0% / "Sem nível" if no rank assigned.
- **default:** `{ type: 'none' }`

**registerRedemption(prevState, formData): Promise<RedemptionState>**

Server Action for `useActionState`. Extracts `card_number`, `reward_config_id`, `reward_type` from formData.

- **cashback / free_product:** calls `supabase.rpc('register_redemption', { p_card_number, p_reward_config_id })`. Maps Portuguese error messages for all known RPC error codes (`not_authenticated`, `customer_not_found`, `reward_not_found`, `insufficient_points`).
- **progressive_discount:** no RPC — inserts directly into `reward_redemptions` (`points_spent = 0`) and `point_transactions` (`points_delta = 0`, `balance_after = current_balance`, `transaction_type = 'redeem'`, `note = 'Desconto progressivo aplicado'`). Returns `newBalance = unchanged current balance`.

Both paths return `{ step: 'success', message, newBalance }` or `{ step: 'error', message }`.

Helper `getAuthenticatedManager()` duplicated inline (accepts `owner` or `manager` role) — follows established pattern from `restaurant.ts`.

### Task 2: Add discount_pct to RanksForm and RankSchema

**`src/lib/actions/restaurant.ts`:**
- `RankSchema`: added `discount_pct: z.number().min(0).max(100).default(0)`
- `ranksToInsert` map: added `discount_pct: rank.discount_pct`

**`src/app/dashboard/owner/settings/RanksForm.tsx`:**
- `Rank` interface: added `discount_pct: number`
- `RankRow` interface: added `discount_pct: number`
- Initial state mapping: `discount_pct: r.discount_pct ?? 0`
- Default new rank: `discount_pct: 0`
- `addRank()`: new row includes `discount_pct: 0`
- Grid updated from `1fr 140px 140px 80px` to `1fr 140px 140px 120px 80px`
- Header: added "Desconto (%)" column label
- Row: added `<input type="number" min={0} max={100} step={0.1} aria-label="Desconto (%)" />` input
- `discount_pct` flows into `rows_json` serialization naturally via existing `JSON.stringify(rows)` pattern

**`src/app/dashboard/owner/settings/page.tsx` (Rule 1 auto-fix):**
- `Rank` interface: added `discount_pct: number` — required because RanksForm now expects it; missing field caused TS2719 type incompatibility error
- `defaultRanks`: added `discount_pct: 0` to default rank object

## Verification Results

1. `npx tsc --noEmit` passes with zero errors (after Rule 1 fix to page.tsx)
2. `checkRewardAvailability` returns correct shape for all three reward_type values
3. `registerRedemption` handles cashback/free_product via RPC and progressive_discount via direct inserts
4. `RanksForm` shows "Desconto (%)" input per rank row; value persists via `ranks_json` JSON serialization

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Rank interface in page.tsx to include discount_pct**

- **Found during:** Task 2 — after adding discount_pct to RanksForm's Rank interface
- **Issue:** `page.tsx` defined its own `Rank` interface without `discount_pct`, causing TS2719 incompatibility when passing `ranksData` to `<RanksForm ranks={ranksData} />`
- **Fix:** Added `discount_pct: number` to `Rank` interface in page.tsx and `discount_pct: 0` to `defaultRanks`
- **Files modified:** `src/app/dashboard/owner/settings/page.tsx`
- **Commit:** bf5180b

## Self-Check: PASSED

Files verified:
- FOUND: src/lib/actions/rewards.ts
- FOUND: src/app/dashboard/owner/settings/RanksForm.tsx (modified)
- FOUND: src/lib/actions/restaurant.ts (modified)
- FOUND: src/app/dashboard/owner/settings/page.tsx (modified)

Commits verified:
- 1e498f7: feat(03-03): reward server actions — checkRewardAvailability and registerRedemption
- bf5180b: feat(03-03): add discount_pct field to RanksForm and RankSchema
