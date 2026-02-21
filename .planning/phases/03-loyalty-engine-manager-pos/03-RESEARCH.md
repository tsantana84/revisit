# Phase 3: Loyalty Engine + Manager POS - Research

**Researched:** 2026-02-21
**Domain:** Luhn check-digit algorithm, integer points arithmetic, visit-based rank promotion, reward model logic, Supabase RPC (PostgreSQL functions), two-step confirmation UI with `useActionState`
**Confidence:** HIGH (schema already exists, patterns from Phases 1+2 are established), MEDIUM (RPC atomicity approach, reward model branching logic)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-03 | Each customer gets a unique card number in `#XXXX-D` format with algorithmic check-digit validation | Luhn algorithm section; `generateCardNumber()` + `validateCardNumber()` TypeScript utilities; UNIQUE constraint on `customers.card_number` already in schema |
| PTS-01 | Points awarded per sale: `sale_value (R$) × points_per_R$ × rank_multiplier` | Integer math section; all values available from `restaurants.earn_rate` + `ranks.multiplier`; result rounded with `Math.round()` |
| PTS-02 | Owner can configure points-per-R$ earn rate (default: 2 pts per R$1) | `restaurants.earn_rate INTEGER NOT NULL DEFAULT 2` already added in 0005_branding.sql |
| PTS-03 | Points credited automatically after manager confirms a sale | RPC `register_sale()` function handles the full write atomically; called by Server Action on manager confirmation |
| PTS-05 | Owner can configure point expiry rules (not enforced in POC, but configurable) | `restaurants.point_expiry_days INTEGER` already added in 0005_branding.sql; no enforcement needed in Phase 3 |
| RANK-01 | Owner can configure rank names, visit thresholds, and point multipliers | Already built in Phase 2 (`updateRanks` Server Action, `ranks` table with `min_visits` + `multiplier`) |
| RANK-02 | Default ranks: Bronze (0+ visits, 1x), Prata (5+ visits, 1.5x), Gold (15+ visits, 2x), VIP (30+ visits, 3x) | Seed data needs to be updated to populate `min_visits`; `multiplier` column exists from 0005_branding.sql |
| RANK-03 | Customer rank determined by total number of visits, not points | `customers.visit_count` is the source of truth; `ranks.min_visits` is the threshold column |
| RANK-04 | When customer crosses a rank threshold, promoted automatically | RPC function queries `active_ranks` by `min_visits <= new_visit_count` ordered descending, picks top rank |
| RANK-05 | Wallet card color changes and push notification on rank promotion (push is Phase 4) | RPC returns `{ rank_promoted: boolean, new_rank_name: string }` so caller knows promotion occurred; color change is a display concern handled by Phase 4 |
| RWRD-01 | Owner chooses one reward model per restaurant: cashback, free product, progressive discount | `restaurants.reward_type` column already in schema; this phase reads it to determine which reward model to display |
| RWRD-02 | Cashback: points convert to R$ credit at register | Cashback model: display `points_balance / earn_rate` as R$ credit available; redemption debits `reward_configs.points_required` points |
| RWRD-03 | Free product: specific product unlocked at point threshold | Free product model: check `customers.points_balance >= reward_configs.points_required`; manager confirms redemption |
| RWRD-04 | Progressive discount: percentage discount grows with rank | Discount % stored per rank (needs `discount_pct` column on `ranks`, see Migration section) |
| RWRD-05 | Reward redemption always confirmed by manager at panel | Same two-step confirmation flow as sale registration; uses `register_redemption()` RPC or Server Action sequence |
| MGR-01 | Manager panel is a dedicated route with single-function UI | Route `/dashboard/manager` already exists as empty shell; Phase 3 fills this page and only this page |
| MGR-02 | Manager can look up customer by typing card number | `lookupCustomer` Server Action: validates format, queries `active_customers` where `card_number = input` |
| MGR-03 | System validates check digit and rejects invalid card numbers before lookup | `validateCardNumber(input)` runs client-side (immediate feedback) and server-side (defense-in-depth) before any DB query |
| MGR-04 | System shows customer name and rank for visual identity confirmation | `lookupCustomer` returns `{ name, current_rank_id, rank_name, points_balance }` from join with `active_ranks` |
| MGR-05 | Manager can enter sale value in R$ | Sale value input (decimal, R$); stored as `amount_cents INTEGER` (`Math.round(value * 100)`) in `sales` table |
| MGR-06 | System shows "This will credit X points to [Name]. Confirm?" before crediting | Two-step `useActionState` flow: step 1 = preview state with calculated points; step 2 = confirmation triggers Server Action |
| MGR-07 | Manager cannot access analytics, customer lists, configurations, or any other section | Manager layout already enforces role; manager page renders ONLY card lookup + sale registration UI with no navigation to other sections |
</phase_requirements>

---

## Summary

Phase 3 has five distinct work streams that compose into a single POS flow. The foundation is the card number service: a TypeScript utility that generates and validates `#XXXX-D` format numbers using the Luhn algorithm. The Luhn check digit is computed from the four XXXX digits and appended as the single D character (one of 0-9 or A-J representing 0-9). The entire lookup → preview → confirm flow is driven by a two-state `useActionState` pattern: the first action resolves the customer and calculates points; the second action triggers the atomic write.

The critical architectural decision is atomicity for sale registration. `supabase-js` does not support multi-statement transactions directly (it uses PostgREST which is stateless). The correct approach is a single `SECURITY DEFINER` PostgreSQL function (`register_sale`) called via `supabase.rpc()` that performs all writes in one transaction: insert `sales` row, insert `point_transactions` row, update `customers.points_balance` and `customers.visit_count`, and update `customers.current_rank_id` if a threshold is crossed. This is a well-established pattern for Supabase.

The reward system branches on `restaurants.reward_type`. All three models (cashback, free product, progressive discount) use the same `reward_configs` table for threshold configuration. Progressive discount requires a `discount_pct` column on the `ranks` table (a new migration). Reward redemption uses a separate `register_redemption()` RPC or a simplified Server Action sequence.

**Primary recommendation:** One atomic `register_sale()` PostgreSQL function handles the complete sale + points + rank promotion write. The manager POS page uses a two-phase `useActionState` pattern: phase 1 returns a preview (no DB write), phase 2 calls the RPC. No new npm packages are required — everything builds on the established stack.

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.8.0 | Server-side Supabase client for Server Actions | Established in Phase 1 |
| `@supabase/supabase-js` | 2.97.0 | `supabase.rpc()` to call PostgreSQL functions | Established in Phase 1; `rpc()` is the transaction mechanism |
| `react` | 19.2.4 | `useActionState` for two-step confirmation flow | Established in Phase 2 |
| `zod` | 4.3.6 | Validate card number format string, sale amount | Established in Phase 2; `as const` + `{ error: string }` pattern already in use |
| `jwt-decode` | 4.0.0 | Read `restaurant_id` + `app_role` from JWT | Established in Phase 2; same `getAuthenticatedOwner()` helper pattern |

### No New Packages Required

Phase 3 does not require any new npm dependencies. The Luhn algorithm is a 10-line utility function that should be hand-written in the codebase (it is trivially simple and there is no advantage to a library dependency for 10 lines). All libraries are already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PostgreSQL RPC function for atomic write | Multiple sequential Server Action DB calls | Sequential calls are NOT atomic — if points credit succeeds but rank update fails, data is inconsistent. RPC is required. |
| Luhn algorithm written in-house | `luhn-ts` npm package | `luhn-ts` (github.com/tolbon/luhn-ts) works but adds a dependency for 10 lines. The algorithm is deterministic and well-documented; hand-rolling is appropriate here. |
| `useActionState` two-phase pattern | React state with separate fetch | `useActionState` is the established Next.js 19 App Router pattern; no additional state management layer needed |

---

## Architecture Patterns

### Recommended Project Structure (Phase 3 additions)

```
src/
├── app/
│   └── dashboard/
│       └── manager/
│           ├── layout.tsx           # Already exists — no change needed
│           └── page.tsx             # Replace placeholder with POS UI (MGR-01)
├── lib/
│   ├── actions/
│   │   └── pos.ts                   # NEW: lookupCustomer(), registerSale(), registerRedemption()
│   └── utils/
│       └── card-number.ts           # NEW: generateCardNumber(), validateCardNumber(), parseCardFormat()
supabase/
└── migrations/
    └── 0007_loyalty_engine.sql      # NEW: register_sale() RPC, register_redemption() RPC,
                                     #      discount_pct column on ranks, seed min_visits update
```

### Pattern 1: Card Number Format — `#XXXX-D`

**What:** Card numbers follow the format `#XXXX-D` where:
- `#` is a literal prefix
- `XXXX` is a zero-padded 4-digit sequence number (0001 to 9999)
- `-` is a literal separator
- `D` is a single Luhn check digit (0-9)

The check digit is computed from the digits of `XXXX` only (4 digits), using standard Luhn algorithm. This keeps the format short and visually distinctive.

**Check digit calculation for `XXXX`:**

```typescript
// Source: Luhn algorithm (30secondsofcode.org/js/s/luhn-check + Wikipedia)
// src/lib/utils/card-number.ts

/**
 * Computes the Luhn check digit for a 4-digit string.
 * Input: "1234" → returns "0" (single digit)
 */
function computeLuhnDigit(digits: string): string {
  // Work right-to-left, doubling every second digit from the right
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = parseInt(digits[digits.length - 1 - i], 10)
    if (i % 2 === 1) {         // double every second digit (0-indexed from right)
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  // Check digit is whatever makes (sum + checkDigit) % 10 === 0
  return String((10 - (sum % 10)) % 10)
}

/**
 * Generates a card number in #XXXX-D format.
 * @param sequence - integer 1-9999
 */
export function generateCardNumber(sequence: number): string {
  if (sequence < 1 || sequence > 9999) throw new Error('Sequence must be 1-9999')
  const xxxx = String(sequence).padStart(4, '0')
  const d = computeLuhnDigit(xxxx)
  return `#${xxxx}-${d}`
}

/**
 * Validates a card number string in #XXXX-D format.
 * Returns true only if format is correct AND check digit matches.
 */
export function validateCardNumber(input: string): boolean {
  const match = input.match(/^#(\d{4})-(\d)$/)
  if (!match) return false
  const [, xxxx, d] = match
  return computeLuhnDigit(xxxx) === d
}

/**
 * Extracts the sequence from a valid card number string.
 * Call only after validateCardNumber() returns true.
 */
export function extractSequence(cardNumber: string): number {
  return parseInt(cardNumber.slice(1, 5), 10)
}
```

**Check digit examples (pre-computed for seed data validation):**
- `#0001-D`: digits `0001` → sum = 0+0+0+2 = 2 → check = (10-2)%10 = 8 → wait, seed has `-A` format. The seed data uses `#0001-A` through `#0001-E` which are NOT Luhn-valid (they use letters). The seed data will need to be updated to use valid Luhn format card numbers.

**CRITICAL SEED DATA CONFLICT:** The existing `seed.sql` assigns card numbers `#0001-A`, `#0001-B` etc. — these use letter suffixes. The format requirement (CARD-03) specifies a single Luhn check digit (0-9). The seed data must be regenerated with valid `#XXXX-D` numeric check digits. This is a migration/seed update, not a schema change.

**Correct seed card numbers (computed):**
- Sequence 1: `#0001-?` → digits `0001` → Luhn sum: d[3]=1 (pos 0, not doubled), d[2]=0 (pos 1, doubled→0), d[1]=0 (pos 2, not doubled), d[0]=0 (pos 3, doubled→0) → sum=1 → check=(10-1)%10=9 → `#0001-9`
- Sequence 2: `0002` → sum: 2+0+0+0=2 → check=8 → `#0002-8`
- Sequence 3: `0003` → sum=3 → check=7 → `#0003-7`
- Sequence 4: `0004` → sum=4 → check=6 → `#0004-6`
- Sequence 5: `0005` → sum=5 → check=5 → `#0005-5`

### Pattern 2: Points Calculation — Integer-Only Arithmetic

**What:** Points calculation must never use floating point. The formula is:

```
points = Math.round(amount_cents / 100 * earn_rate * multiplier)
```

where:
- `amount_cents` is the stored integer (cents)
- `earn_rate` is `restaurants.earn_rate INTEGER` (points per whole R$1)
- `multiplier` is `ranks.multiplier NUMERIC(4,2)` (e.g. 1.5, 2.0)

**Why integer math matters:** `earn_rate * multiplier` can produce a float (e.g. 2 × 1.5 = 3.0), but the multiplication of that by `(amount_cents / 100)` for non-round amounts can accumulate float errors. Using `Math.round()` at the final step ensures the result is always an integer before storage.

**In the PostgreSQL RPC function**, use:
```sql
ROUND(p_amount_cents::NUMERIC / 100 * v_earn_rate * v_multiplier)::INTEGER
```

The `NUMERIC` type avoids float representation errors in the database. `ROUND()` returns a `NUMERIC` — cast to `INTEGER` for storage.

### Pattern 3: Atomic Sale Registration — PostgreSQL RPC

**What:** A `SECURITY DEFINER` PostgreSQL function that performs the complete sale write atomically. Called via `supabase.rpc('register_sale', {...})` from the Server Action.

**Why RPC (not sequential Server Action calls):** `supabase-js` uses PostgREST — each `.from().update()` call is a separate HTTP request. There is no multi-statement transaction API. The only way to guarantee atomicity (all-or-nothing) is a PostgreSQL function called via `rpc()`. This is the documented Supabase approach for multi-table operations.

**Critical detail — SECURITY DEFINER + RLS interaction:** The function must run as a role that can write to `sales`, `point_transactions`, and `customers`. Using `SECURITY DEFINER` makes the function run as the `postgres` role (which bypasses RLS). This is correct and intentional — the function enforces its own authorization by verifying that the caller's `restaurant_id` (from `auth.jwt()`) matches the customer's `restaurant_id`. Do not add RLS checks inside the function body; the function IS the security boundary.

```sql
-- supabase/migrations/0007_loyalty_engine.sql

-- ---------------------------------------------------------------------------
-- register_sale: atomic sale + points + rank promotion write
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_sale(
  p_card_number  TEXT,       -- e.g. '#0001-9'
  p_amount_cents INTEGER,    -- sale amount in cents (e.g. 5000 = R$50,00)
  p_staff_id     UUID        -- restaurant_staff.id of the manager performing the sale
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_id  UUID;
  v_customer       RECORD;
  v_earn_rate      INTEGER;
  v_multiplier     NUMERIC(4,2);
  v_points_earned  INTEGER;
  v_new_balance    INTEGER;
  v_new_visit      INTEGER;
  v_new_rank_id    UUID;
  v_new_rank_name  TEXT;
  v_rank_promoted  BOOLEAN := FALSE;
  v_sale_id        UUID;
BEGIN
  -- 1. Get caller's restaurant from JWT
  v_restaurant_id := (SELECT public.get_restaurant_id());

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- 2. Validate card number format + check digit (server-side re-validation)
  --    Format: #DDDD-D where D is digit
  IF p_card_number !~ '^#\d{4}-\d$' THEN
    RETURN jsonb_build_object('error', 'invalid_card_format');
  END IF;

  -- 3. Look up customer (tenant-scoped)
  SELECT c.id, c.name, c.points_balance, c.visit_count, c.current_rank_id, c.restaurant_id
    INTO v_customer
    FROM public.customers c
   WHERE c.card_number = p_card_number
     AND c.restaurant_id = v_restaurant_id
     AND c.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'customer_not_found');
  END IF;

  -- 4. Get restaurant earn rate
  SELECT r.earn_rate INTO v_earn_rate
    FROM public.restaurants r
   WHERE r.id = v_restaurant_id;

  -- 5. Get current rank multiplier
  SELECT rk.multiplier INTO v_multiplier
    FROM public.ranks rk
   WHERE rk.id = v_customer.current_rank_id;

  IF v_multiplier IS NULL THEN
    v_multiplier := 1.0;  -- fallback if rank not set
  END IF;

  -- 6. Calculate points (integer, rounded)
  v_points_earned := ROUND(p_amount_cents::NUMERIC / 100 * v_earn_rate * v_multiplier)::INTEGER;

  -- 7. New balance and visit count
  v_new_balance := v_customer.points_balance + v_points_earned;
  v_new_visit   := v_customer.visit_count + 1;

  -- 8. Determine new rank (highest rank where min_visits <= new visit count)
  SELECT rk.id, rk.name INTO v_new_rank_id, v_new_rank_name
    FROM public.ranks rk
   WHERE rk.restaurant_id = v_restaurant_id
     AND rk.min_visits <= v_new_visit
     AND rk.deleted_at IS NULL
   ORDER BY rk.min_visits DESC
   LIMIT 1;

  IF v_new_rank_id IS DISTINCT FROM v_customer.current_rank_id THEN
    v_rank_promoted := TRUE;
  END IF;

  -- 9. Insert sale record
  INSERT INTO public.sales (restaurant_id, customer_id, staff_id, amount_cents, points_earned)
  VALUES (v_restaurant_id, v_customer.id, p_staff_id, p_amount_cents, v_points_earned)
  RETURNING id INTO v_sale_id;

  -- 10. Insert point transaction ledger entry
  INSERT INTO public.point_transactions
    (restaurant_id, customer_id, points_delta, balance_after, transaction_type, reference_id)
  VALUES
    (v_restaurant_id, v_customer.id, v_points_earned, v_new_balance, 'earn', v_sale_id);

  -- 11. Update customer: balance, visit count, rank
  UPDATE public.customers
     SET points_balance   = v_new_balance,
         visit_count      = v_new_visit,
         current_rank_id  = v_new_rank_id
   WHERE id = v_customer.id;

  -- 12. Return result for UI feedback
  RETURN jsonb_build_object(
    'success',          TRUE,
    'sale_id',          v_sale_id,
    'points_earned',    v_points_earned,
    'new_balance',      v_new_balance,
    'new_visit_count',  v_new_visit,
    'rank_promoted',    v_rank_promoted,
    'new_rank_name',    COALESCE(v_new_rank_name, ''),
    'customer_name',    v_customer.name
  );
END;
$$;

-- Grant execute to authenticated users only (managers and owners)
GRANT EXECUTE ON FUNCTION public.register_sale TO authenticated;
REVOKE EXECUTE ON FUNCTION public.register_sale FROM anon;
```

**Calling from Server Action:**

```typescript
// src/lib/actions/pos.ts — registerSale() Server Action
'use server'

import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import { z } from 'zod'
import { validateCardNumber } from '@/lib/utils/card-number'

const RegisterSaleSchema = z.object({
  card_number: z.string().refine(validateCardNumber, { error: 'Número de cartão inválido' }),
  amount_cents: z.coerce.number().int().min(1, 'Valor deve ser positivo'),
  staff_id: z.string().uuid(),
})

export type SaleState =
  | { step: 'preview'; customerName: string; pointsPreview: number; cardNumber: string; amountCents: number; staffId: string }
  | { step: 'success'; pointsEarned: number; customerName: string; rankPromoted: boolean; newRankName?: string }
  | { step: 'error'; message: string }
  | undefined

export async function registerSale(prevState: SaleState, formData: FormData): Promise<SaleState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { step: 'error', message: 'Não autenticado' }

  // ... validate, call rpc, return result
  const { data, error } = await supabase.rpc('register_sale', {
    p_card_number: formData.get('card_number') as string,
    p_amount_cents: Math.round(parseFloat(formData.get('amount') as string) * 100),
    p_staff_id: formData.get('staff_id') as string,
  })

  if (error || data?.error) {
    return { step: 'error', message: data?.error ?? error?.message ?? 'Erro ao registrar venda' }
  }

  return {
    step: 'success',
    pointsEarned: data.points_earned,
    customerName: data.customer_name,
    rankPromoted: data.rank_promoted,
    newRankName: data.new_rank_name,
  }
}
```

### Pattern 4: Two-Step Confirmation Flow with `useActionState`

**What:** The manager POS page uses a two-phase approach implemented as two distinct Server Actions bound to the same `useActionState` state shape:

1. **Phase 1 — Lookup + Preview:** `lookupCustomer(cardNumber)` — validates format, fetches customer, calculates points preview. Returns `{ step: 'preview', customerName, pointsPreview, earnRate, multiplier }`. No DB write.

2. **Phase 2 — Confirm:** `registerSale(formData)` — called only after manager clicks "Confirmar". Invokes the RPC. Returns `{ step: 'success', ... }`.

The UI renders different forms based on `state.step`:
- No state / `step: 'error'`: Card lookup form
- `step: 'preview'`: Confirmation form showing "This will credit X points to [Name]. Confirm?"
- `step: 'success'`: Success message with rank promotion notice if applicable

```typescript
// Pattern: discriminated union state drives UI rendering
// src/app/dashboard/manager/page.tsx (Client Component)
'use client'
import { useActionState } from 'react'
import { lookupCustomer, registerSale } from '@/lib/actions/pos'

export default function ManagerPOSPage() {
  const [lookupState, lookupAction, lookupPending] = useActionState(lookupCustomer, undefined)
  const [saleState, saleAction, salePending] = useActionState(registerSale, undefined)

  // Step 1: show lookup form (no state, or error, or after success reset)
  if (!lookupState || lookupState.step === 'error' || saleState?.step === 'success') {
    return <CardLookupForm action={lookupAction} pending={lookupPending} error={lookupState} />
  }

  // Step 2: show confirmation
  if (lookupState.step === 'preview') {
    return (
      <SaleConfirmForm
        preview={lookupState}
        action={saleAction}
        pending={salePending}
        error={saleState?.step === 'error' ? saleState : undefined}
      />
    )
  }

  return null
}
```

**Alternative considered:** A single Server Action with a hidden `step` field in the form. This is simpler but harder to type correctly. Two separate actions with a discriminated union state is cleaner for testing and is what the Next.js docs recommend for multi-step flows.

### Pattern 5: Reward System — Branching by `reward_type`

**What:** Phase 3 implements reward availability display and redemption confirmation. The logic branches based on `restaurants.reward_type`.

**Cashback (reward_type = 'cashback'):**
- Available credit = `customer.points_balance / earn_rate` (R$ value)
- No `reward_configs` row needed — uses `earn_rate` as conversion rate
- Redemption: debit points from customer, record `reward_redemptions` row with `points_spent`

**Free product (reward_type = 'free_product'):**
- Reward available when `customer.points_balance >= reward_config.points_required`
- Query `active_reward_configs WHERE is_active = TRUE ORDER BY points_required ASC`
- The first reward the customer can afford is displayed
- Redemption: debit `points_required` from customer balance

**Progressive discount (reward_type = 'progressive_discount'):**
- Discount percentage is stored in `ranks.discount_pct NUMERIC(4,1)` (new column in Phase 3 migration)
- Current discount = `customer's current rank's discount_pct`
- No point deduction on redemption — discount is automatic per visit
- Manager panel shows: "This customer gets X% discount (Gold rank)"
- Redemption just records the `reward_redemptions` row for audit; no points spent

**New migration column needed:**
```sql
-- In 0007_loyalty_engine.sql
ALTER TABLE public.ranks
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(4,1) NOT NULL DEFAULT 0;
```

Default values: Bronze=0%, Prata=5%, Gold=10%, VIP=15% (configurable via Phase 2 owner settings — the RanksForm needs a `discount_pct` field added).

### Pattern 6: Manager Context — `getAuthenticatedManager()` Helper

**What:** A helper parallel to Phase 2's `getAuthenticatedOwner()`, but for manager role. Reads JWT claims to get `restaurant_id` and `staff_id`.

```typescript
// src/lib/actions/pos.ts
interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string   // user_id
  exp: number
}

async function getAuthenticatedManager() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'Não autenticado' as const }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Sessão inválida' as const }

  const claims = jwtDecode<RevisitClaims>(session.access_token)
  if (!claims.restaurant_id) return { error: 'Restaurante não encontrado' as const }

  // app_role check: owners can also use the POS if needed (POC flexibility)
  // If strictly manager-only: check claims.app_role === 'manager'

  // Get staff_id for the sales.staff_id FK
  const { data: staff } = await supabase
    .from('active_restaurant_staff')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!staff) return { error: 'Acesso negado' as const }

  return { supabase, restaurantId: claims.restaurant_id, staffId: staff.id, userId: user.id }
}
```

### Anti-Patterns to Avoid

- **Sequential DB calls for sale registration:** Never do `supabase.from('sales').insert()` then `supabase.from('customers').update()` in sequence from a Server Action — these are NOT atomic. One can succeed and the other fail. Use the RPC.
- **Float arithmetic for points:** `R$50.00 × 2 × 1.5 = 150` seems fine, but `R$33.33 × 2 × 1.5 = 99.99` rounds incorrectly to 99 in some float implementations. Always `Math.round()` the final result or use PostgreSQL `ROUND()` with `NUMERIC`.
- **Client-side-only check digit validation:** Validate check digit on the server too (inside the RPC or Server Action). Client validation is UX only; server validation is security.
- **Checking `ranks.min_points` for rank promotion:** The `min_points` column is a legacy artifact. Phase 3 uses `ranks.min_visits` exclusively for rank threshold comparisons.
- **SECURITY DEFINER without `SET search_path = ''`:** A SECURITY DEFINER function without a pinned search_path is a privilege escalation vector. Always include `SET search_path = ''` and use fully-qualified names (`public.customers`, `public.ranks`, etc.).
- **Returning raw Postgres errors to the client:** The RPC returns structured JSONB errors (`{ error: 'customer_not_found' }`). The Server Action maps these to user-facing Portuguese strings. Never surface raw Postgres error messages to the manager panel.
- **Sales table `amount_cents` vs `amount`:** The schema stores `amount_cents INTEGER` (not a decimal `amount`). Convert in the Server Action: `Math.round(parseFloat(formValue) * 100)`. Never store floating point currency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-table atomic writes | Sequential Server Action DB calls | PostgreSQL function via `supabase.rpc()` | PostgREST has no transaction API; only PostgreSQL functions guarantee atomicity |
| Currency arithmetic | Float math | Integer cents + `Math.round()` | Float representation errors accumulate; `1.1 + 2.2 !== 3.3` in IEEE 754 |
| Role enforcement in RPC | Trust the caller | `auth.jwt()` inside SECURITY DEFINER function | The function is called by anyone with a valid Supabase session; it must self-verify tenant ownership |
| Reward availability calculation | Custom complex logic | Branch on `restaurants.reward_type` + query `reward_configs` | Three discrete models; one branch per model; no generalization needed at POC scale |

**Key insight:** The RPC pattern (PostgreSQL function + `supabase.rpc()`) is the standard Supabase pattern for any operation that must be atomic across multiple tables. There is no alternative that provides the same guarantee using the supabase-js client library.

---

## Common Pitfalls

### Pitfall 1: Luhn Check Digit Confusion — Letter vs Digit Suffix
**What goes wrong:** Existing seed data uses `#0001-A` through `#0001-E` (letters as check digit suffix). The format spec says check digit is a single digit (0-9). Letters are not valid.
**Why it happens:** The seed data was written before the check digit algorithm was specified. The letter convention looks natural but is incompatible with Luhn (which produces 0-9).
**How to avoid:** Update `seed.sql` to use computed Luhn digits. The migration plan should include a note to regenerate seed card numbers. Existing customers in the seed table should get new card numbers (`#0001-9`, `#0002-8`, etc.).
**Warning signs:** `validateCardNumber('#0001-A')` returns false even though the card exists in DB.

### Pitfall 2: RPC Function Called Without Valid JWT → Empty `restaurant_id`
**What goes wrong:** `register_sale()` is called when the manager's session is expired. `auth.jwt()` returns null. The function returns `{ error: 'not_authenticated' }` instead of crediting points.
**Why it happens:** JWT tokens expire. If the manager leaves the POS page open, the Supabase `@supabase/ssr` client may not have had a chance to refresh the token.
**How to avoid:** Call `supabase.auth.getUser()` at the start of every Server Action (which also refreshes the token). The `@supabase/ssr` middleware already handles token refresh on each request, but Server Actions that run without a preceding page load may miss the refresh.
**Warning signs:** RPC returns `not_authenticated` but the manager is visually logged in.

### Pitfall 3: `ranks` Table Has No Rows for New Restaurant
**What goes wrong:** A new restaurant (created in production after the Phase 2 flows) has no ranks configured yet. `register_sale()` finds `v_multiplier IS NULL` (no rank for the customer). The fallback `v_multiplier := 1.0` handles this, but `v_new_rank_id` will also be NULL, so the customer has no rank after the sale.
**Why it happens:** Phase 2's `updateRanks` Server Action uses delete-then-insert. If the owner never visits the ranks settings page, no ranks exist.
**How to avoid:** The `register_sale()` function already handles NULL multiplier with a fallback. Additionally, the Phase 2 owner signup flow should seed default Bronze rank on restaurant creation. This is a Phase 2 concern but Phase 3 must defensively handle the NULL case.
**Warning signs:** `customers.current_rank_id` is NULL after a sale for a new restaurant.

### Pitfall 4: `min_points` Column Used Instead of `min_visits` for Rank Lookup
**What goes wrong:** The rank promotion query uses `min_points <= v_new_balance` instead of `min_visits <= v_new_visit`. Points and visits produce wildly different rank assignments.
**Why it happens:** The `min_points` column exists from Phase 1 schema. It's easy to accidentally query the wrong column.
**How to avoid:** The RPC function explicitly uses `min_visits <= v_new_visit` (line 8 of the SELECT in the RPC above). Code review should verify this. Unit tests should cover a customer who has high points but few visits and confirm they get the visit-based rank.
**Warning signs:** A customer with 3000 points but 3 visits gets VIP rank.

### Pitfall 5: `amount_cents` Overflow for Large Sales
**What goes wrong:** A sale of R$99,999.99 requires `amount_cents = 9_999_999`. PostgreSQL `INTEGER` max is 2,147,483,647 (~R$21 million). Fine for a restaurant POS.
**Why it happens:** Not a practical risk at POC scale but worth documenting.
**How to avoid:** Zod validation on the Server Action: `z.coerce.number().int().min(1).max(99_999_99)` (R$99,999.99 maximum). The RPC accepts the validated value.
**Warning signs:** Zod rejects sale values above the maximum (desired behavior).

### Pitfall 6: Two-Step Confirmation State Leak
**What goes wrong:** Manager looks up Customer A, navigates away or the page refreshes, comes back — the React state from the `useActionState` call is gone. On page reload, the form resets to card lookup. This is correct behavior.
**Why it happens:** `useActionState` is in-memory React state. It does not persist across page reloads.
**How to avoid:** This is the desired behavior (no stale confirmations). Document it explicitly so the planner knows NOT to add `localStorage` or URL state persistence for the preview step.
**Warning signs:** None — this is intentional. If a manager's confirmation is interrupted, they simply look up the card again.

### Pitfall 7: Progressive Discount `discount_pct` Missing from Seed/Config
**What goes wrong:** `reward_type = 'progressive_discount'` but `ranks.discount_pct` is 0 for all ranks (default). The reward UI shows "0% discount" for all customers.
**Why it happens:** The `discount_pct` column is new in Phase 3. Existing seed data and the RanksForm (Phase 2) don't populate it.
**How to avoid:** The Phase 3 migration adds `discount_pct` with a DEFAULT 0. The seed data update in 0007 should set sensible defaults (Bronze=0, Prata=5, Gold=10, VIP=15). The `RanksForm.tsx` (Phase 2 component) needs a `discount_pct` input field added in Phase 3.
**Warning signs:** All progressive discount customers show 0% in the POS panel.

---

## Code Examples

Verified patterns from the existing codebase + official sources:

### Calling RPC from a Server Action

```typescript
// Source: supabase.com/docs/reference/javascript/rpc (official docs)
// src/lib/actions/pos.ts

const { data, error } = await supabase.rpc('register_sale', {
  p_card_number: cardNumber,    // '#0001-9'
  p_amount_cents: amountCents,  // 5000 (= R$50,00)
  p_staff_id: staffId,          // UUID from restaurant_staff
})

if (error) {
  // PostgREST-level error (e.g., function not found, wrong arg types)
  return { step: 'error', message: 'Erro interno' }
}

if (data?.error) {
  // Application-level error returned by the function
  const messages: Record<string, string> = {
    'not_authenticated': 'Sessão expirada. Faça login novamente.',
    'invalid_card_format': 'Formato de cartão inválido.',
    'customer_not_found': 'Cartão não encontrado.',
  }
  return { step: 'error', message: messages[data.error] ?? 'Erro desconhecido' }
}

// data.success === true
return {
  step: 'success',
  pointsEarned: data.points_earned,
  customerName: data.customer_name,
  rankPromoted: data.rank_promoted,
  newRankName: data.new_rank_name,
}
```

### Customer Lookup Server Action

```typescript
// src/lib/actions/pos.ts — lookupCustomer()
// Returns preview data without writing to DB

export type LookupState =
  | { step: 'preview'; customerName: string; currentRank: string; pointsBalance: number;
      pointsPreview: number; cardNumber: string; amountCents: number; staffId: string }
  | { step: 'error'; message: string }
  | undefined

export async function lookupCustomer(
  prevState: LookupState,
  formData: FormData
): Promise<LookupState> {
  const cardNumber = (formData.get('card_number') as string)?.trim()
  const amountStr = formData.get('amount') as string

  // 1. Validate card format + check digit
  if (!validateCardNumber(cardNumber)) {
    return { step: 'error', message: 'Número de cartão inválido' }
  }

  // 2. Validate sale amount
  const amount = parseFloat(amountStr)
  if (isNaN(amount) || amount <= 0) {
    return { step: 'error', message: 'Valor de venda inválido' }
  }
  const amountCents = Math.round(amount * 100)

  // 3. Get authenticated manager context
  const auth = await getAuthenticatedManager()
  if ('error' in auth) return { step: 'error', message: auth.error }

  // 4. Look up customer (READ ONLY — no write)
  const { data: customer, error } = await auth.supabase
    .from('active_customers')
    .select('id, name, points_balance, visit_count, current_rank_id, active_ranks(name, multiplier)')
    .eq('card_number', cardNumber)
    .single()

  if (error || !customer) {
    return { step: 'error', message: 'Cartão não encontrado' }
  }

  // 5. Get earn rate
  const { data: restaurant } = await auth.supabase
    .from('active_restaurants')
    .select('earn_rate')
    .eq('id', auth.restaurantId)
    .single()

  const earnRate = restaurant?.earn_rate ?? 2
  const multiplier = (customer.active_ranks as { multiplier: number } | null)?.multiplier ?? 1
  const pointsPreview = Math.round(amountCents / 100 * earnRate * multiplier)

  return {
    step: 'preview',
    customerName: customer.name,
    currentRank: (customer.active_ranks as { name: string } | null)?.name ?? 'Bronze',
    pointsBalance: customer.points_balance,
    pointsPreview,
    cardNumber,
    amountCents,
    staffId: auth.staffId,
  }
}
```

### Rank Promotion Query (PostgreSQL)

```sql
-- Source: PostgreSQL docs — finds the highest rank the customer qualifies for
SELECT rk.id, rk.name
  FROM public.ranks rk
 WHERE rk.restaurant_id = v_restaurant_id
   AND rk.min_visits <= v_new_visit
   AND rk.deleted_at IS NULL
 ORDER BY rk.min_visits DESC
 LIMIT 1;
```

### Migration: Phase 3 Schema Changes

```sql
-- supabase/migrations/0007_loyalty_engine.sql

-- Add discount_pct to ranks for progressive discount model
ALTER TABLE public.ranks
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(4,1) NOT NULL DEFAULT 0;

-- Update seed ranks with sensible defaults (done in seed.sql update, not migration)
-- Bronze: 0%, Prata: 5%, Gold: 10%, VIP: 15%

-- register_sale() function — see Pattern 3 above

-- register_redemption() function — minimal version
CREATE OR REPLACE FUNCTION public.register_redemption(
  p_card_number         TEXT,
  p_reward_config_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_restaurant_id UUID;
  v_customer      RECORD;
  v_reward        RECORD;
  v_new_balance   INTEGER;
BEGIN
  v_restaurant_id := (SELECT public.get_restaurant_id());
  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT c.id, c.points_balance INTO v_customer
    FROM public.customers c
   WHERE c.card_number = p_card_number
     AND c.restaurant_id = v_restaurant_id
     AND c.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'customer_not_found');
  END IF;

  SELECT rc.points_required, rc.name INTO v_reward
    FROM public.reward_configs rc
   WHERE rc.id = p_reward_config_id
     AND rc.restaurant_id = v_restaurant_id
     AND rc.is_active = TRUE
     AND rc.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  IF v_customer.points_balance < v_reward.points_required THEN
    RETURN jsonb_build_object('error', 'insufficient_points');
  END IF;

  v_new_balance := v_customer.points_balance - v_reward.points_required;

  INSERT INTO public.reward_redemptions (restaurant_id, customer_id, reward_config_id, points_spent)
  VALUES (v_restaurant_id, v_customer.id, p_reward_config_id, v_reward.points_required);

  INSERT INTO public.point_transactions (restaurant_id, customer_id, points_delta, balance_after, transaction_type)
  VALUES (v_restaurant_id, v_customer.id, -v_reward.points_required, v_new_balance, 'redeem');

  UPDATE public.customers SET points_balance = v_new_balance WHERE id = v_customer.id;

  RETURN jsonb_build_object('success', TRUE, 'points_spent', v_reward.points_required,
                             'new_balance', v_new_balance, 'reward_name', v_reward.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_redemption TO authenticated;
REVOKE EXECUTE ON FUNCTION public.register_redemption FROM anon;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple PostgREST calls for atomic operations | `supabase.rpc()` with SECURITY DEFINER PostgreSQL function | Always the correct approach; confirmed 2025 | PostgREST has no transaction API; RPC is the only atomic option |
| `useFormStatus` from react-dom | `useActionState` from react | React 19 (in use) | Already using correct approach from Phase 2 |
| `z.enum(['a','b'])` (Zod v3) | `z.enum(['a','b'] as const, { error: 'msg' })` (Zod v4) | Zod v4 (in use) | Already documented in prior decisions; must use `as const` |
| Storing currency as DECIMAL/FLOAT | INTEGER cents + application-layer rounding | Always best practice | IEEE 754 float errors eliminated; already using `amount_cents INTEGER` in schema |

**Deprecated/outdated:**
- `min_points` on `ranks` for rank promotion: use `min_visits` (Phase 2 migration added the correct column)
- Card number format with letter suffix (`#0001-A`): update seed data to use numeric Luhn digits

---

## Open Questions

1. **`register_sale()` — should managers' `staff_id` come from the JWT or a DB lookup?**
   - What we know: The JWT contains `sub` (user_id). `restaurant_staff.id` is a different UUID from `auth.users.id`. The `sales` table FK is to `restaurant_staff.id`, not `auth.users.id`.
   - What's unclear: Whether to do the lookup in the RPC function (one more DB query inside the transaction) or in the Server Action before calling RPC (cleaner separation, two calls but simpler function).
   - Recommendation: Do the lookup in the Server Action (`getAuthenticatedManager()` helper returns `staffId`), then pass `p_staff_id` to the RPC. Keeps the function focused on the atomic write and avoids embedding auth logic in multiple places.

2. **Card number sequence generation — where is the counter maintained?**
   - What we know: Card numbers are sequential (`#0001-D`, `#0002-D`, etc.). The sequence must be unique per restaurant (not global). `customers.card_number` has a global UNIQUE constraint.
   - What's unclear: Whether to use a PostgreSQL sequence per restaurant, a MAX+1 approach inside `register_customer()` (Phase to be determined), or a global counter table.
   - Recommendation: Use PostgreSQL `MAX(CAST(SUBSTRING(card_number FROM 2 FOR 4) AS INTEGER)) + 1` inside a transaction for Phase 3 POC. A formal sequence is Phase 4+.
   - Note: Card number generation is part of customer registration (which may be a later phase). Phase 3's `CARD-03` requirement is validation only — the card number already exists on the customer when the manager looks them up. Confirm with requirements: does Phase 3 include creating new customers, or only looking up existing ones?

3. **Progressive discount — does the manager "apply" the discount or just show it?**
   - What we know: RWRD-04 says "percentage discount grows with rank (e.g. Bronze 5%, Gold 15%)." RWRD-05 says redemption is confirmed by the manager.
   - What's unclear: For progressive discount model, is there a "redemption" at all, or is the discount always active? If always active, the `register_redemption()` flow may not apply.
   - Recommendation: For POC, the manager panel shows the customer's discount percentage. Redemption records an entry in `reward_redemptions` for audit purposes only (no points deducted). The planner should define this as: "display discount % to manager; redemption button records audit row; no point deduction."

4. **Vitest config — does it need extension to cover `src/lib/utils/` unit tests?**
   - What we know: Current `vitest.config.ts` only includes `supabase/tests/**/*.test.ts`.
   - What's unclear: The phase plan (03-02) explicitly calls for "golden-path unit tests" for the points engine. These would naturally live in `src/lib/utils/card-number.test.ts` and `src/lib/utils/points.test.ts`.
   - Recommendation: Update `vitest.config.ts` to add `src/**/*.test.ts` to the `include` array. This enables unit tests for pure utility functions (no DB required) separately from the Supabase integration tests.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/supabase/migrations/0001_schema.sql` through `0005_branding.sql` — exact schema, column names, types, constraints
- Existing codebase: `/src/lib/actions/restaurant.ts` — `getAuthenticatedOwner()` pattern, Zod v4 usage, `jwtDecode` usage
- Existing codebase: `/supabase/migrations/0002_rls.sql` — `get_restaurant_id()` function, `auth.jwt()`, SECURITY DEFINER pattern
- Existing codebase: `/src/lib/supabase/middleware.ts` — JWT decode pattern, role-based routing already implemented
- [Supabase RPC reference](https://supabase.com/docs/reference/javascript/rpc) — `.rpc(fnName, params)` syntax, error shape
- [Supabase PostgreSQL Functions guide](https://supabase.com/docs/guides/database/functions) — SECURITY DEFINER, `search_path = ''`, GRANT/REVOKE pattern
- [30 Seconds of Code — Luhn Check](https://www.30secondsofcode.org/js/s/luhn-check/) — canonical 10-line Luhn implementation, check digit generation

### Secondary (MEDIUM confidence)
- [Supabase GitHub Discussion #526 — Client-side transactions](https://github.com/orgs/supabase/discussions/526) — confirms PostgREST has no transaction API; RPC is the solution
- [marmelab.com — Transactions and RLS in Supabase Edge Functions](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html) — confirms RPC/PostgreSQL function is the standard atomic write pattern
- [Supabase GitHub Discussion #3563 — Bypass RLS in PostgreSQL function](https://github.com/orgs/supabase/discussions/3563) — SECURITY DEFINER bypasses RLS; function must self-enforce tenant scoping via JWT

### Tertiary (LOW confidence — flag for validation)
- Luhn check digit values for seed data card numbers (#0001-9 etc.) — computed manually from the algorithm. Should be verified by running `computeLuhnDigit('0001')` etc. in the actual implementation before updating seed data.
- `active_customers` view join syntax with `active_ranks` in `.select()` — Supabase PostgREST supports embedded relationship syntax for views, but this should be verified against the actual view definitions (views don't declare FK relationships explicitly; PostgREST may require a direct table join).

---

## Metadata

**Confidence breakdown:**
- Card number format + Luhn algorithm: HIGH — algorithm is deterministic, well-documented, implemented in 10 lines
- Points calculation math: HIGH — integer arithmetic with `Math.round()`, no external dependency
- RPC atomicity pattern: HIGH — official Supabase position is confirmed (no transaction API in PostgREST; RPC is the answer)
- Two-step useActionState flow: HIGH — follows exact Phase 2 established patterns
- Reward model branching: MEDIUM — the three models are described in requirements but their exact UI/UX details (especially progressive discount "redemption") need planner clarification
- Vitest extension for unit tests: MEDIUM — config change is trivial; the decision to add src tests depends on plan scope

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days — Supabase and Next.js APIs are stable at these versions)
