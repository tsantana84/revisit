-- =============================================================================
-- Migration 0008: Analytics indexes, card number RPC, and total_spend column
-- Adds performance indexes for period filtering, atomic card number generation,
-- and a denormalized total_spend column for analytics display.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Analytics indexes for period-based filtering queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sales_restaurant_created
  ON public.sales(restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_point_transactions_restaurant_created
  ON public.point_transactions(restaurant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 2. generate_next_card_number RPC
-- SECURITY DEFINER function that atomically determines the next card number
-- for a restaurant. Prevents race conditions during concurrent registrations.
-- Format: #XXXX-D where XXXX is zero-padded sequence and D is Luhn check digit.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_next_card_number(p_restaurant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_seq INTEGER;
  v_next_seq INTEGER;
  v_digits TEXT;
  v_check TEXT;
  v_sum INTEGER;
  v_d INTEGER;
BEGIN
  -- Get current max sequence for this restaurant (including deleted customers)
  SELECT COALESCE(MAX(
    NULLIF(SUBSTRING(card_number FROM 2 FOR 4), '')::INTEGER
  ), 0)
  INTO v_max_seq
  FROM public.customers
  WHERE restaurant_id = p_restaurant_id;

  v_next_seq := v_max_seq + 1;

  IF v_next_seq > 9999 THEN
    RAISE EXCEPTION 'Card number sequence exhausted for restaurant %', p_restaurant_id;
  END IF;

  v_digits := LPAD(v_next_seq::TEXT, 4, '0');

  -- Compute Luhn check digit (same algorithm as card-number.ts)
  -- Iterates right-to-left, doubling every second digit from the right (0-indexed)
  v_sum := 0;
  FOR i IN 1..4 LOOP
    v_d := SUBSTRING(v_digits FROM (5 - i) FOR 1)::INTEGER;
    IF (i - 1) % 2 = 1 THEN
      v_d := v_d * 2;
      IF v_d > 9 THEN v_d := v_d - 9; END IF;
    END IF;
    v_sum := v_sum + v_d;
  END LOOP;
  v_check := ((10 - (v_sum % 10)) % 10)::TEXT;

  RETURN '#' || v_digits || '-' || v_check;
END;
$$;

-- Allow service role and authenticated users to call
-- Service role is used for customer registration (public route, no auth session)
GRANT EXECUTE ON FUNCTION public.generate_next_card_number TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_next_card_number TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Add total_spend column to customers (denormalized for analytics display)
-- Avoids expensive JOIN to sales table for the customer list view (DASH-02).
-- ---------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS total_spend INTEGER NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 4. Update register_sale to increment total_spend
-- This is a surgical update to the existing RPC from 0007_loyalty_engine.sql.
-- The function signature and return type are unchanged — only step 11 is updated.
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

  -- 11. Update customer: balance, visit count, rank, and total_spend
  UPDATE public.customers
     SET points_balance   = v_new_balance,
         visit_count      = v_new_visit,
         current_rank_id  = v_new_rank_id,
         total_spend      = total_spend + p_amount_cents
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
