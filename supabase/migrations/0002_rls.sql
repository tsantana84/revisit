-- =============================================================================
-- Migration 0002: RLS Helper Functions and Policies
-- REVISIT loyalty platform — tenant isolation via JWT claims
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER + search_path = '' for security)
-- ---------------------------------------------------------------------------

-- Extracts restaurant_id from the JWT once per statement (cached via SELECT subquery)
CREATE OR REPLACE FUNCTION public.get_restaurant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() ->> 'restaurant_id')::UUID;
$$;

-- Extracts app_role from the JWT
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.jwt() ->> 'app_role';
$$;

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook
-- Runs before JWT is issued — injects restaurant_id and app_role into claims
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims          JSONB;
  v_restaurant_id UUID;
  v_role          TEXT;
BEGIN
  -- Look up restaurant association for this user
  SELECT restaurant_id, role::TEXT
    INTO v_restaurant_id, v_role
    FROM public.restaurant_staff
   WHERE user_id = (event->>'user_id')::UUID
     AND deleted_at IS NULL
   LIMIT 1;

  claims := event->'claims';

  IF v_restaurant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{restaurant_id}', to_jsonb(v_restaurant_id::TEXT));
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant the auth system access to execute the hook and read the lookup table
GRANT USAGE  ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.restaurant_staff TO supabase_auth_admin;

-- Revoke from public to prevent direct calls
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS Policies
--
-- CRITICAL RULES:
-- 1. Use (SELECT public.get_restaurant_id()) wrapper — query plan caching
-- 2. Do NOT include deleted_at IS NULL — causes UPDATE/soft-delete conflict
--    (UPDATE re-validates SELECT policy; row becomes invisible mid-UPDATE)
-- 3. Soft-delete filtering happens at the view layer (0003_views.sql)
-- ---------------------------------------------------------------------------

-- restaurants: owner/manager can only see their own restaurant
CREATE POLICY tenant_isolation_restaurants
  ON public.restaurants
  FOR ALL
  TO authenticated
  USING      (id = (SELECT public.get_restaurant_id()))
  WITH CHECK (id = (SELECT public.get_restaurant_id()));

-- restaurant_staff: staff can see other staff in their restaurant
CREATE POLICY tenant_isolation_restaurant_staff
  ON public.restaurant_staff
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));

-- customers: full tenant isolation
CREATE POLICY tenant_isolation_customers
  ON public.customers
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));

-- ranks: full tenant isolation
CREATE POLICY tenant_isolation_ranks
  ON public.ranks
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));

-- reward_configs: full tenant isolation
CREATE POLICY tenant_isolation_reward_configs
  ON public.reward_configs
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));

-- point_transactions: full tenant isolation
CREATE POLICY tenant_isolation_point_transactions
  ON public.point_transactions
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));

-- reward_redemptions: full tenant isolation
CREATE POLICY tenant_isolation_reward_redemptions
  ON public.reward_redemptions
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));

-- sales: full tenant isolation
CREATE POLICY tenant_isolation_sales
  ON public.sales
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));
