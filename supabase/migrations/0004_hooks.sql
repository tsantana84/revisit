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
AS $$
DECLARE
  claims          JSONB;
  v_restaurant_id UUID;
  v_role          TEXT;
BEGIN
  -- Look up restaurant association for this user
  -- Queries as supabase_auth_admin which has SELECT grant on restaurant_staff
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

-- ---------------------------------------------------------------------------
-- Grants — supabase_auth_admin must be able to execute the hook and read the
-- lookup table. Without the SELECT grant on restaurant_staff, the hook runs
-- but silently returns null claims (Pitfall 5 from research).
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.restaurant_staff TO supabase_auth_admin;

-- Prevent direct calls from application roles
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;
