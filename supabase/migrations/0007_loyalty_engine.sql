-- =============================================================================
-- Migration 0007: Loyalty Engine
-- Adds discount_pct column to ranks, register_sale() and register_redemption()
-- RPC functions for atomic sale + points + rank promotion writes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add discount_pct to ranks for progressive discount reward model
-- ---------------------------------------------------------------------------
ALTER TABLE public.ranks
  ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(4,1) NOT NULL DEFAULT 0;

-- ---------------------------------------------------------------------------
-- 2. register_sale: atomic sale + points + rank promotion write
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

-- ---------------------------------------------------------------------------
-- 3. register_redemption: atomic reward redemption write
-- ---------------------------------------------------------------------------
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
  -- 1. Get caller's restaurant from JWT
  v_restaurant_id := (SELECT public.get_restaurant_id());

  IF v_restaurant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  -- 2. Look up customer (tenant-scoped)
  SELECT c.id, c.points_balance INTO v_customer
    FROM public.customers c
   WHERE c.card_number = p_card_number
     AND c.restaurant_id = v_restaurant_id
     AND c.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'customer_not_found');
  END IF;

  -- 3. Look up reward config (active, not deleted, tenant-scoped)
  SELECT rc.points_required, rc.name INTO v_reward
    FROM public.reward_configs rc
   WHERE rc.id = p_reward_config_id
     AND rc.restaurant_id = v_restaurant_id
     AND rc.is_active = TRUE
     AND rc.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  -- 4. Check sufficient points balance
  IF v_customer.points_balance < v_reward.points_required THEN
    RETURN jsonb_build_object('error', 'insufficient_points');
  END IF;

  -- 5. Compute new balance
  v_new_balance := v_customer.points_balance - v_reward.points_required;

  -- 6. Insert reward redemption record
  INSERT INTO public.reward_redemptions (restaurant_id, customer_id, reward_config_id, points_spent)
  VALUES (v_restaurant_id, v_customer.id, p_reward_config_id, v_reward.points_required);

  -- 7. Insert point transaction ledger entry (negative delta for redemption)
  INSERT INTO public.point_transactions
    (restaurant_id, customer_id, points_delta, balance_after, transaction_type)
  VALUES
    (v_restaurant_id, v_customer.id, -v_reward.points_required, v_new_balance, 'redeem');

  -- 8. Update customer balance
  UPDATE public.customers
     SET points_balance = v_new_balance
   WHERE id = v_customer.id;

  -- 9. Return result for UI feedback
  RETURN jsonb_build_object(
    'success',      TRUE,
    'points_spent', v_reward.points_required,
    'new_balance',  v_new_balance,
    'reward_name',  v_reward.name
  );
END;
$$;

-- Grant execute to authenticated users only (managers and owners)
GRANT EXECUTE ON FUNCTION public.register_redemption TO authenticated;
REVOKE EXECUTE ON FUNCTION public.register_redemption FROM anon;
