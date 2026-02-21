-- =============================================================================
-- Migration 0004: Custom Access Token Hook — Explicit Registration
-- REVISIT loyalty platform — JWT claim injection for RLS tenant isolation
-- =============================================================================
--
-- NOTE: The custom_access_token_hook function was first created in 0002_rls.sql.
-- This migration uses CREATE OR REPLACE to ensure the function is canonical here
-- as the hook-specific migration, and re-asserts all required grants explicitly.
--
-- CRITICAL: This hook must also be registered in supabase/config.toml under
-- [auth.hook.custom_access_token] for local dev. For cloud deployments, register
-- in the Supabase Dashboard under Authentication → Hooks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Custom Access Token Hook function
-- Runs before every JWT is issued — injects restaurant_id and app_role claims
-- ---------------------------------------------------------------------------
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
  -- Look up restaurant association for this user
  -- SECURITY DEFINER ensures this runs as the function owner (postgres), which
  -- bypasses RLS on restaurant_staff. The GRANT SELECT on restaurant_staff to
  -- supabase_auth_admin is kept for defense-in-depth, but SECURITY DEFINER is
  -- what actually makes the lookup work when RLS is enabled on the table.
  SELECT rs.restaurant_id, rs.role::TEXT
    INTO v_restaurant_id, v_role
    FROM public.restaurant_staff rs
   WHERE rs.user_id = (event->>'user_id')::UUID
     AND rs.deleted_at IS NULL
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

-- ---------------------------------------------------------------------------
-- Grants — supabase_auth_admin must be able to execute the hook.
-- The SECURITY DEFINER on the function makes the restaurant_staff lookup
-- run as the function owner (postgres superuser), bypassing RLS on the table.
-- The SELECT grant on restaurant_staff is kept as defense-in-depth.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.restaurant_staff TO supabase_auth_admin;

-- Prevent direct calls from application roles
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;

-- ---------------------------------------------------------------------------
-- RLS enforcement check — used by the CI test suite to assert that every
-- public table has RLS enabled. Returns a row for each table WITHOUT RLS.
-- Test asserts the result is empty (zero tables without RLS).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_rls_enabled()
RETURNS TABLE(relname TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.relname::TEXT
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relrowsecurity = false
     AND c.relname NOT LIKE 'schema_%'
   ORDER BY c.relname;
$$;

-- Allow service role and authenticated users to call this check
GRANT EXECUTE ON FUNCTION public.check_rls_enabled TO authenticated, service_role;
