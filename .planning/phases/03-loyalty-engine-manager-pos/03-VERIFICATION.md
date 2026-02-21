---
phase: 03-loyalty-engine-manager-pos
verified: 2026-02-21T15:00:00Z
status: gaps_found
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "Wallet card color changes and customer receives a push notification on rank promotion (RANK-05 full requirement)"
    status: partial
    reason: "Phase 3 detects rank promotion and surfaces it in SaleState (rankPromoted, newRankName) and displays a UI notice — but the wallet card color change and push notification components of RANK-05 are deferred to Phase 4. REQUIREMENTS.md marks RANK-05 as [x] Complete for Phase 3, which overstates coverage. The detection data exists; the delivery mechanism does not."
    artifacts:
      - path: "src/lib/actions/pos.ts"
        issue: "SaleState includes rankPromoted and newRankName — promotion is DETECTED, not fully delivered per RANK-05 text"
      - path: "src/app/dashboard/manager/page.tsx"
        issue: "UI shows rank promotion notice, but wallet card color change and push notification are not implemented here"
    missing:
      - "Wallet card color change on rank promotion (explicit Phase 4 deliverable — CARD-05/PUSH-03)"
      - "Push notification to customer on rank promotion (explicit Phase 4 deliverable — PUSH-03)"
      - "REQUIREMENTS.md RANK-05 status should read 'Partial' not 'Complete' until Phase 4 ships — traceability table overstates Phase 3 scope"
human_verification:
  - test: "End-to-end manager POS flow"
    expected: "Card lookup returns customer name and rank; confirmation screen shows correct point calculation (value x earn_rate x multiplier); sale credits points; rank promotion banner shows when threshold crossed; reward section appears after success"
    why_human: "Cannot run Next.js dev server + Supabase in this environment; visual rendering and interaction require browser"
  - test: "Invalid card number inline validation"
    expected: "Typing '#0001-0' shows inline red error 'Formato invalido' before any DB query is triggered; submit button is disabled"
    why_human: "Client-side React state behavior requires browser execution"
  - test: "Reward availability display for each reward_type"
    expected: "After a sale, clicking 'Verificar Recompensa' shows correct UI for cashback (R$ credit), free_product (Resgatar button), or progressive_discount (% info) based on restaurant configuration"
    why_human: "Requires live Supabase + browser interaction to verify branching render paths"
---

# Phase 3: Loyalty Engine + Manager POS Verification Report

**Phase Goal:** A manager can look up a customer by card number and register a sale in under 30 seconds, with points, rank promotion, and reward unlocking calculated automatically
**Verified:** 2026-02-21T15:00:00Z
**Status:** gaps_found (1 partial gap — RANK-05 scope overstatement in traceability)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Manager can look up customer by card number with check-digit validation — invalid numbers rejected before DB query | VERIFIED | `validateCardNumber` called in `lookupCustomer` before any Supabase query (pos.ts:130); client-side inline validation in page.tsx:195 before form submit |
| 2 | Preview shows "This will credit X points to [Name]. Confirm?" with correct formula: value x earn_rate x rank_multiplier, rounded | VERIFIED | `lookupCustomer` returns `pointsPreview = Math.round(amountCents / 100 * earnRate * multiplier)` (pos.ts:189); confirmation screen renders "Isso creditará {pointsPreview} pontos para {customerName}" (page.tsx:366-371) |
| 3 | Points credited to ledger after confirmation, visit count increments, rank updates automatically when threshold crossed | VERIFIED | `register_sale` RPC performs atomic INSERT sales + INSERT point_transactions + UPDATE customers including `current_rank_id = v_new_rank_id` (migration 0007:99-114); rank determined by `min_visits <= v_new_visit ORDER BY min_visits DESC LIMIT 1` |
| 4 | Reward becomes available when customer meets threshold; manager can confirm redemption at panel | VERIFIED | `checkRewardAvailability` branches on `reward_type` for cashback/free_product/progressive_discount (rewards.ts:87-183); `registerRedemption` handles all three models (rewards.ts:189-313); RewardSection in page.tsx renders redemption UI |
| 5 | Manager panel shows only card lookup and sale registration — no analytics, customer list, config, or navigation to other sections | VERIFIED | layout.tsx nav contains only "Painel" link and "Sair" button (layout.tsx:61-68); page.tsx contains only lookup/confirmation/success flow — no links to other routes |

**Score:** 4/5 success criteria fully verified (criterion 3 includes rank promotion detection — wallet color/push notification are Phase 4, not Phase 3 success criteria)

Note: RANK-05 (wallet card color + push notification) is properly a Phase 4 deliverable per ROADMAP.md Phase 4 requirements (CARD-05, PUSH-03). The Phase 3 success criteria do not mention wallet color or push. The gap is in the REQUIREMENTS.md traceability table marking RANK-05 as Complete for Phase 3 — the detection + UI notice portion is done, but the delivery mechanism is Phase 4.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0007_loyalty_engine.sql` | register_sale RPC, register_redemption RPC, discount_pct column | VERIFIED | 218 lines; `CREATE OR REPLACE FUNCTION public.register_sale` at line 16; `register_redemption` at line 137; `ALTER TABLE public.ranks ADD COLUMN IF NOT EXISTS discount_pct` at line 10 |
| `src/lib/utils/card-number.ts` | generateCardNumber, validateCardNumber, extractSequence exports | VERIFIED | 58 lines; all three functions exported with correct Luhn algorithm implementation |
| `src/lib/utils/card-number.test.ts` | Unit tests for Luhn check-digit | VERIFIED | 12 tests covering generation, validation, extraction, and error cases |
| `vitest.config.ts` | Extended to include src/**/*.test.ts | VERIFIED | `include: ['supabase/tests/**/*.test.ts', 'src/**/*.test.ts']` |
| `src/lib/actions/pos.ts` | lookupCustomer, registerSale Server Actions with auth | VERIFIED | 269 lines; exports lookupCustomer, registerSale, LookupState, SaleState; getAuthenticatedManager helper accepts owner+manager roles; staff ID resolved from active_restaurant_staff |
| `src/lib/actions/rewards.ts` | checkRewardAvailability, registerRedemption Server Actions | VERIFIED | 327 lines; exports all required functions; branches correctly on reward_type; progressive discount handled with audit record |
| `src/app/dashboard/manager/page.tsx` | Manager POS page with card lookup, sale confirmation, reward display | VERIFIED | 564 lines; 'use client'; three-phase conditional UI; three useActionState hooks; RewardSection component |
| `src/app/dashboard/manager/layout.tsx` | Stripped-down manager layout — Painel + Sair only | VERIFIED | Nav contains only /dashboard/manager link and logout form; no other navigation |
| `src/app/dashboard/owner/settings/RanksForm.tsx` | Updated with discount_pct field | VERIFIED | discount_pct in Rank interface, RankRow interface, initial state mapping, addRank(), and rendered input with aria-label="Desconto (%)" |
| `src/lib/actions/restaurant.ts` | RankSchema with discount_pct, updateRanks maps it | VERIFIED | `discount_pct: z.number().min(0).max(100).default(0)` in RankSchema; `discount_pct: rank.discount_pct` in ranksToInsert map |
| `supabase/seed.sql` | Valid Luhn card numbers (#0001-9 through #0005-5) | VERIFIED | All five seed customers use Luhn-valid card numbers: #0001-9, #0002-8, #0003-7, #0004-6, #0005-5 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/actions/pos.ts` | supabase RPC `register_sale` | `supabase.rpc('register_sale', { p_card_number, p_amount_cents, p_staff_id })` | WIRED | pos.ts:236 — explicit rpc call with correct parameter names |
| `src/lib/actions/pos.ts` | `src/lib/utils/card-number.ts` | `import validateCardNumber` | WIRED | pos.ts:6 — `import { validateCardNumber } from '@/lib/utils/card-number'`; called at pos.ts:130 and in RegisterSaleSchema.refine at pos.ts:112 |
| `src/lib/actions/pos.ts` | `active_customers` view | `supabase.from('active_customers').select()` | WIRED | pos.ts:152-154 — select with card_number filter and .single() |
| `src/lib/actions/rewards.ts` | supabase RPC `register_redemption` | `supabase.rpc('register_redemption', { p_card_number, p_reward_config_id })` | WIRED | rewards.ts:214 — called for cashback and free_product models |
| `src/lib/actions/rewards.ts` | `active_restaurants` view | reads `reward_type` to branch logic | WIRED | rewards.ts:94-98 — `.from('active_restaurants').select('reward_type, earn_rate')` |
| `src/app/dashboard/manager/page.tsx` | `src/lib/actions/pos.ts` | `import lookupCustomer, registerSale` | WIRED | page.tsx:4 — `import { lookupCustomer, registerSale } from '@/lib/actions/pos'`; both bound to useActionState |
| `src/app/dashboard/manager/page.tsx` | `src/lib/actions/rewards.ts` | `import registerRedemption, checkRewardForCurrentManager` | WIRED | page.tsx:5 — both imported and used in RewardSection component |
| `src/app/dashboard/manager/page.tsx` | `src/lib/utils/card-number.ts` | `import validateCardNumber` for client-side inline feedback | WIRED | page.tsx:6 — used at page.tsx:195 for `cardInputHasError` state |
| Seed card numbers | `validateCardNumber()` | Card numbers in seed must pass check-digit validation | WIRED | All five seed numbers (#0001-9, #0002-8, #0003-7, #0004-6, #0005-5) pass the Luhn algorithm — confirmed by matching test expectations |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CARD-03 | 03-01 | Unique card number in #XXXX-D format with algorithmic check-digit validation | SATISFIED | card-number.ts with Luhn algorithm; validateCardNumber used in lookup and sale actions |
| PTS-01 | 03-02 | Points = sale value x points per R$ x rank multiplier | SATISFIED | lookupCustomer preview formula + register_sale RPC formula both implement this |
| PTS-02 | 03-02 | Owner can configure earn rate | SATISFIED | earn_rate in RestaurantSchema/updateBranding (restaurant.ts); read in lookupCustomer and checkRewardAvailability |
| PTS-03 | 03-02 | Points credited automatically after manager confirms sale | SATISFIED | registerSale delegates to register_sale RPC which atomically inserts sale + point_transaction + updates customer |
| PTS-05 | 03-01 | Owner can configure point expiry rules | SATISFIED | point_expiry_days in RestaurantSchema (restaurant.ts:69); configurable in settings UI — not enforced at POC per requirement text |
| RANK-01 | 03-03 | Owner can configure rank names, visit thresholds, multipliers | SATISFIED | RanksForm with discount_pct added; RankSchema validates all fields; updateRanks persists them |
| RANK-02 | 03-01 | Default ranks: Bronze/Prata/Gold/VIP with correct thresholds | SATISFIED | seed.sql populates ranks with min_visits=0/5/15/30, multiplier=1.0/1.5/2.0/3.0 |
| RANK-03 | 03-02 | Rank determined by total visits, not points | SATISFIED | register_sale RPC uses `min_visits <= v_new_visit` for rank determination |
| RANK-04 | 03-02 | Customer promoted automatically when crossing threshold | SATISFIED | register_sale RPC sets `current_rank_id = v_new_rank_id` atomically |
| RANK-05 | 03-02 | Wallet card color changes + push notification on rank promotion | PARTIAL | Promotion DETECTED (rank_promoted in SaleState, UI notice in page.tsx) — wallet color change and push notification are deferred to Phase 4 (CARD-05, PUSH-03). REQUIREMENTS.md marks this Complete which overstates Phase 3 scope. |
| RWRD-01 | 03-03 | Owner chooses one reward model: cashback, free product, or progressive discount | SATISFIED | checkRewardAvailability branches on restaurant.reward_type; all three models implemented |
| RWRD-02 | 03-03 | Cashback: points convert to R$ credit | SATISFIED | `availableCredit = Math.floor(points_balance / earn_rate)` in checkRewardAvailability |
| RWRD-03 | 03-03 | Free product unlocked at point threshold | SATISFIED | free_product branch queries active_reward_configs, finds first qualifying config |
| RWRD-04 | 03-03 | Progressive discount grows with rank | SATISFIED | progressive_discount branch reads rank.discount_pct; RanksForm allows configuration |
| RWRD-05 | 03-03 | Reward redemption confirmed by manager at panel | SATISFIED | RewardSection in page.tsx requires manager to click "Resgatar" or "Verificar Recompensa" — not automatic |
| MGR-01 | 03-04 | Manager panel is a dedicated route with single-function UI | SATISFIED | /dashboard/manager with layout that shows only Painel + Sair |
| MGR-02 | 03-04 | Manager can look up customer by card number | SATISFIED | Phase 1 (card lookup form) in page.tsx |
| MGR-03 | 03-04 | System validates check digit and rejects invalid numbers before lookup | SATISFIED | Client-side validateCardNumber before submit AND server-side validation in lookupCustomer |
| MGR-04 | 03-04 | System shows customer name and rank for identity confirmation | SATISFIED | Phase 2 (confirmation screen) shows customerName and currentRank badge |
| MGR-05 | 03-04 | Manager can enter sale value in R$ | SATISFIED | Amount input in Phase 1 form |
| MGR-06 | 03-04 | "This will credit X points to [Name]. Confirm?" before crediting | SATISFIED | page.tsx:366-371 renders this exact message with actual values |
| MGR-07 | 03-04 | Manager cannot access analytics, customer lists, config, or other sections | SATISFIED | layout.tsx has only Painel + Sair; page.tsx contains no links to other routes; middleware blocks /dashboard/owner |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/dashboard/manager/page.tsx` | 183 | `window.location.reload()` in handleNewSale | Info | Forces full page reload on "Nova Venda" instead of state reset — functional but non-optimal UX; resetTrigger pattern was planned but window.reload used instead |

No blocker or warning-level anti-patterns found. The `window.location.reload()` is a minor UX issue (brief reload flash), not a correctness problem.

---

### Human Verification Required

#### 1. End-to-End Manager POS Flow

**Test:** Log in as manager, navigate to /dashboard/manager. Enter card number #0001-9 (Ana Souza) and amount R$50.00. Click "Buscar Cliente". Click "Confirmar Venda".
**Expected:** Preview shows ~100 points (50 x 2 earn_rate x 1.0 Bronze multiplier for Ana who is VIP = 50 x 2 x 3 = 300 points if VIP; verify actual calculation). Success screen shows points credited, current balance, and rank promotion notice if applicable.
**Why human:** Cannot run Next.js dev server + Supabase locally in this verification environment.

#### 2. Client-Side Invalid Card Validation

**Test:** Type "#0001-0" (wrong check digit) in the card number input field.
**Expected:** Inline red error message "Formato inválido — use #XXXX-D (ex: #0001-9)" appears; "Buscar Cliente" button is disabled/dimmed.
**Why human:** React client-side state behavior triggered on `onChange` requires browser execution.

#### 3. Reward Section Display

**Test:** After a successful sale, click "Verificar Recompensa".
**Expected:** For cashback restaurant — shows "Crédito disponível: R$ X.XX". For free_product — shows reward name with "Resgatar" button if eligible. For progressive_discount — shows "Desconto de X% (RankName)".
**Why human:** Requires live Supabase data and browser interaction to verify all three reward_type branches render correctly.

---

## Gaps Summary

**Primary gap:** RANK-05 is marked as "Complete" in REQUIREMENTS.md for Phase 3, but the full requirement text is "Wallet card color changes and customer receives a push notification on rank promotion." Phase 3 implements rank promotion DETECTION (the RPC returns rank_promoted/new_rank_name, and the POS UI shows a notice). It does not implement the wallet card color change or push notification — these are explicitly deferred to Phase 4 (CARD-05, PUSH-03 in the Phase 4 requirements list).

This is a traceability documentation issue, not a broken implementation. The Phase 3 success criteria (from ROADMAP.md) do not mention wallet color or push notifications — those are correctly in Phase 4. The gap is that REQUIREMENTS.md RANK-05 row was marked `[x]` Complete prematurely.

**Impact on Phase 3 goal:** Low. The Phase 3 goal ("A manager can look up a customer by card number and register a sale in under 30 seconds, with points, rank promotion, and reward unlocking calculated automatically") is achieved. Rank promotion is detected and surfaced. The wallet card visual update is a Phase 4 concern.

**Recommendation:** Update REQUIREMENTS.md RANK-05 status from `[x]` (Complete) to partial, with note "Detection complete in Phase 3; wallet color + push notification in Phase 4." This is a documentation fix, not a code fix.

---

_Verified: 2026-02-21T15:00:00Z_
_Verifier: Claude (gsd-verifier)_
