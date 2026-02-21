---
phase: 03-loyalty-engine-manager-pos
plan: "01"
subsystem: loyalty-engine
tags: [luhn, card-number, rpc, postgresql, migration, seed, vitest]
dependency_graph:
  requires: []
  provides:
    - register_sale RPC function (PostgreSQL)
    - register_redemption RPC function (PostgreSQL)
    - discount_pct column on ranks table
    - generateCardNumber / validateCardNumber / extractSequence utilities
    - src unit test infrastructure (vitest)
  affects:
    - supabase/seed.sql (card numbers updated to Luhn format)
    - vitest.config.ts (extended to cover src tests)
tech_stack:
  added: []
  patterns:
    - SECURITY DEFINER PostgreSQL function with SET search_path = ''
    - Luhn check-digit algorithm (hand-rolled, 10-line utility)
    - Integer-only points arithmetic with ROUND()::INTEGER
    - Visit-based rank promotion (min_visits threshold query)
key_files:
  created:
    - supabase/migrations/0007_loyalty_engine.sql
    - src/lib/utils/card-number.ts
    - src/lib/utils/card-number.test.ts
  modified:
    - supabase/seed.sql
    - vitest.config.ts
decisions:
  - "computeLuhnDigit() doubles every second digit from right (0-indexed) — i%2===1 path doubles d[length-2], d[length-4], matching standard Luhn spec"
  - "register_sale() uses ROUND(p_amount_cents::NUMERIC / 100 * earn_rate * multiplier)::INTEGER — NUMERIC avoids float representation errors before rounding"
  - "rank promotion uses min_visits <= v_new_visit ORDER BY min_visits DESC LIMIT 1 — selects highest qualifying rank, not current rank"
  - "GRANT EXECUTE to authenticated; REVOKE from anon — managers and owners can call RPCs, anonymous callers cannot"
  - "Seed card numbers changed from letter suffix (#0001-A) to Luhn numeric (#0001-9) — letters fail validateCardNumber() regex ^#(\\d{4})-(\\d)$"
metrics:
  duration: "3 min"
  completed: "2026-02-21"
  tasks_completed: 2
  files_created: 3
  files_modified: 2
---

# Phase 03 Plan 01: Loyalty Engine Foundation Summary

**One-liner:** Luhn check-digit card number utility + register_sale/register_redemption PostgreSQL RPCs with SECURITY DEFINER, discount_pct column on ranks, and Luhn-valid seed data.

## What Was Built

### Task 1: Card Number Utility with Luhn Check-Digit

Created `src/lib/utils/card-number.ts` with three exported functions:

- `generateCardNumber(sequence: number): string` — validates 1-9999, pads to 4 digits, computes Luhn check digit, returns `#XXXX-D` format
- `validateCardNumber(input: string): boolean` — regex matches `^#(\d{4})-(\d)$`, verifies check digit via `computeLuhnDigit()`
- `extractSequence(cardNumber: string): number` — parses 4-digit sequence as integer

The internal `computeLuhnDigit(digits: string): string` iterates right-to-left, doubling every second digit (0-indexed from right), subtracting 9 if >9, and returns `(10 - (sum % 10)) % 10`.

Created `src/lib/utils/card-number.test.ts` with 12 unit tests covering:
- Generation: sequences 1, 2, 5, 9999
- Validation: correct digit, wrong digit, letter suffix, missing #, empty string
- Extraction: sequence from valid card number
- Error cases: sequence 0 and 10000 throw

Updated `vitest.config.ts` to add `'src/**/*.test.ts'` to the include array alongside the existing Supabase integration tests. All 12 tests pass.

### Task 2: Loyalty Engine Migration and Seed Data Update

Created `supabase/migrations/0007_loyalty_engine.sql` with:

1. `ALTER TABLE public.ranks ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(4,1) NOT NULL DEFAULT 0` — enables progressive discount reward model

2. `register_sale(p_card_number TEXT, p_amount_cents INTEGER, p_staff_id UUID) RETURNS JSONB` — SECURITY DEFINER, SET search_path = ''. Performs: JWT tenant lookup, card format validation, customer lookup, earn rate + multiplier fetch, points calculation (integer ROUND), visit count increment, rank promotion query (min_visits DESC LIMIT 1), atomic INSERT sales + INSERT point_transactions + UPDATE customers. Returns success JSONB or error JSONB for not_authenticated, invalid_card_format, customer_not_found.

3. `register_redemption(p_card_number TEXT, p_reward_config_id UUID) RETURNS JSONB` — SECURITY DEFINER, SET search_path = ''. Performs: JWT tenant lookup, customer lookup, reward_config lookup (active + not deleted), points sufficiency check, atomic INSERT reward_redemptions + INSERT point_transactions (negative delta) + UPDATE customers. Returns success JSONB or error JSONB for not_authenticated, customer_not_found, reward_not_found, insufficient_points.

Updated `supabase/seed.sql`:
- Ranks INSERT now includes `min_visits`, `multiplier`, and `discount_pct` columns (Bronze: 0/1.0/0%, Prata: 5/1.5/5%, Gold: 15/2.0/10%, VIP: 30/3.0/15%)
- Customer card numbers changed from letter suffix (`#0001-A`) to valid Luhn format (`#0001-9`, `#0002-8`, `#0003-7`, `#0004-6`, `#0005-5`)

## Verification Results

1. `npx vitest run src/lib/utils/card-number.test.ts` — 12/12 tests passed
2. `npx supabase db reset` — applied cleanly through all 7 migrations, seed loaded without errors
3. Database verified: `register_sale` and `register_redemption` in `pg_proc`, all ranks have correct `discount_pct`, all customers have Luhn-valid card numbers

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- FOUND: supabase/migrations/0007_loyalty_engine.sql
- FOUND: src/lib/utils/card-number.ts
- FOUND: src/lib/utils/card-number.test.ts
- FOUND: supabase/seed.sql (modified)
- FOUND: vitest.config.ts (modified)

Commits verified:
- af46e3e: feat(03-01): card number utility with Luhn check-digit and unit tests
- 82d8c09: feat(03-01): loyalty engine migration and seed data update
