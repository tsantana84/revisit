-- =============================================================================
-- Migration 0010: Admin Role + Cross-Tenant Indexes
-- Adds 'admin' to app_role enum, allows null restaurant_id for platform admins,
-- updates JWT hook to emit app_role even when restaurant_id is NULL.
-- =============================================================================

-- 1. Add 'admin' value to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Allow restaurant_id to be NULL (for admin users with no tenant affiliation)
ALTER TABLE public.restaurant_staff ALTER COLUMN restaurant_id DROP NOT NULL;

-- 3. Update the custom_access_token_hook to emit app_role even when restaurant_id is NULL.
--    Previously: IF v_restaurant_id IS NOT NULL → skipped admin users entirely.
--    Now: IF v_role IS NOT NULL → always injects app_role, and conditionally injects restaurant_id.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims          JSONB;
  v_restaurant_id UUID;
  v_role          TEXT;
BEGIN
  SELECT rs.restaurant_id, rs.role::TEXT
    INTO v_restaurant_id, v_role
    FROM public.restaurant_staff rs
   WHERE rs.user_id = (event->>'user_id')::UUID
     AND rs.deleted_at IS NULL
   LIMIT 1;

  claims := event->'claims';

  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(v_role));
    IF v_restaurant_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{restaurant_id}', to_jsonb(v_restaurant_id::TEXT));
    END IF;
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Re-assert grants (idempotent)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.restaurant_staff TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;

-- 4. Cross-tenant indexes for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_sales_created ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_restaurant_created ON public.customers(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type_created ON public.point_transactions(transaction_type, created_at DESC);
