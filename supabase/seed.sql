-- =============================================================================
-- Seed: Demo Restaurant
-- REVISIT loyalty platform — demo data for development verification
-- =============================================================================
-- NOTE: No auth.users are inserted here — those are created at runtime via
-- Supabase Auth. This seed covers business data only.
-- =============================================================================

DO $$
DECLARE
  -- Restaurant
  v_restaurant_id UUID := '00000000-0000-0000-0000-000000000001';

  -- Ranks
  v_rank_bronze   UUID := '00000000-0000-0000-0001-000000000001';
  v_rank_prata    UUID := '00000000-0000-0000-0001-000000000002';
  v_rank_gold     UUID := '00000000-0000-0000-0001-000000000003';
  v_rank_vip      UUID := '00000000-0000-0000-0001-000000000004';

  -- Reward configs
  v_reward_cafe      UUID := '00000000-0000-0000-0002-000000000001';
  v_reward_sobremesa UUID := '00000000-0000-0000-0002-000000000002';

  -- Customers
  v_cust_ana     UUID := '00000000-0000-0000-0003-000000000001';
  v_cust_carlos  UUID := '00000000-0000-0000-0003-000000000002';
  v_cust_julia   UUID := '00000000-0000-0000-0003-000000000003';
  v_cust_pedro   UUID := '00000000-0000-0000-0003-000000000004';
  v_cust_mariana UUID := '00000000-0000-0000-0003-000000000005';

BEGIN

  -- -----------------------------------------------------------------------
  -- 1. Restaurant
  -- -----------------------------------------------------------------------
  INSERT INTO public.restaurants (id, name, slug)
  VALUES (v_restaurant_id, 'Demo Restaurant', 'demo-restaurant');

  -- -----------------------------------------------------------------------
  -- 2. Ranks (visit-based thresholds per RANK-02, with multipliers and
  --    progressive discount percentages per RWRD-04)
  --    Bronze:  0 visits, 1.0x, 0% discount   (sort 1)
  --    Prata:   5 visits, 1.5x, 5% discount   (sort 2)
  --    Gold:   15 visits, 2.0x, 10% discount  (sort 3)
  --    VIP:    30 visits, 3.0x, 15% discount  (sort 4)
  -- -----------------------------------------------------------------------
  INSERT INTO public.ranks (id, restaurant_id, name, min_points, sort_order, min_visits, multiplier, discount_pct)
  VALUES
    (v_rank_bronze, v_restaurant_id, 'Bronze', 0,    1, 0,  1.0, 0),
    (v_rank_prata,  v_restaurant_id, 'Prata',  500,  2, 5,  1.5, 5),
    (v_rank_gold,   v_restaurant_id, 'Gold',   1500, 3, 15, 2.0, 10),
    (v_rank_vip,    v_restaurant_id, 'VIP',    3000, 4, 30, 3.0, 15);

  -- -----------------------------------------------------------------------
  -- 3. Reward configs
  -- -----------------------------------------------------------------------
  INSERT INTO public.reward_configs (id, restaurant_id, name, description, points_required, is_active)
  VALUES
    (v_reward_cafe,      v_restaurant_id, 'Café Grátis',      'Um café espresso ou americano grátis', 100,  TRUE),
    (v_reward_sobremesa, v_restaurant_id, 'Sobremesa Grátis', 'Uma sobremesa do cardápio grátis',     250,  TRUE);

  -- -----------------------------------------------------------------------
  -- 4. Customers (varying points and visit counts, assigned appropriate ranks)
  --    Card numbers use valid Luhn check digits (#XXXX-D format):
  --    Ana:     #0001-9 (seq 1, check digit 9)
  --    Carlos:  #0002-8 (seq 2, check digit 8)
  --    Julia:   #0003-7 (seq 3, check digit 7)
  --    Pedro:   #0004-6 (seq 4, check digit 6)
  --    Mariana: #0005-5 (seq 5, check digit 5)
  --
  --    Ana:     3100 pts, 32 visits → VIP
  --    Carlos:  1600 pts, 16 visits → Gold
  --    Julia:    520 pts,  6 visits → Prata
  --    Pedro:    200 pts,  3 visits → Bronze
  --    Mariana:    0 pts,  0 visits → Bronze (new customer)
  -- -----------------------------------------------------------------------
  INSERT INTO public.customers (id, restaurant_id, name, phone, card_number, points_balance, visit_count, current_rank_id)
  VALUES
    (v_cust_ana,     v_restaurant_id, 'Ana Souza',       '11999990001', '#0001-9', 3100, 32, v_rank_vip),
    (v_cust_carlos,  v_restaurant_id, 'Carlos Lima',     '11999990002', '#0002-8', 1600, 16, v_rank_gold),
    (v_cust_julia,   v_restaurant_id, 'Julia Ferreira',  '11999990003', '#0003-7',  520,  6, v_rank_prata),
    (v_cust_pedro,   v_restaurant_id, 'Pedro Oliveira',  '11999990004', '#0004-6',  200,  3, v_rank_bronze),
    (v_cust_mariana, v_restaurant_id, 'Mariana Costa',   '11999990005', '#0005-5',    0,  0, v_rank_bronze);

  -- -----------------------------------------------------------------------
  -- 5. Point transactions (sample ledger entries for Ana and Carlos)
  -- -----------------------------------------------------------------------

  -- Ana: 3 earn transactions totaling 3100 pts
  INSERT INTO public.point_transactions
    (restaurant_id, customer_id, points_delta, balance_after, transaction_type, note)
  VALUES
    (v_restaurant_id, v_cust_ana, 1000, 1000, 'earn', 'Visita ao estabelecimento'),
    (v_restaurant_id, v_cust_ana, 1500, 2500, 'earn', 'Jantar especial'),
    (v_restaurant_id, v_cust_ana,  600, 3100, 'earn', 'Visita regular');

  -- Carlos: 2 earn transactions totaling 1600 pts
  INSERT INTO public.point_transactions
    (restaurant_id, customer_id, points_delta, balance_after, transaction_type, note)
  VALUES
    (v_restaurant_id, v_cust_carlos, 800,  800,  'earn', 'Primeira visita'),
    (v_restaurant_id, v_cust_carlos, 800,  1600, 'earn', 'Visita de retorno');

  -- Julia: 1 earn transaction
  INSERT INTO public.point_transactions
    (restaurant_id, customer_id, points_delta, balance_after, transaction_type, note)
  VALUES
    (v_restaurant_id, v_cust_julia, 520, 520, 'earn', 'Visitas acumuladas');

END $$;
