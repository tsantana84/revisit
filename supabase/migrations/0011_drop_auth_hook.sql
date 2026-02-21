-- Drop the custom access token hook since Clerk now handles JWT claims.
-- The hook was used to inject app_role and restaurant_id into Supabase JWTs.
-- With Clerk, these claims come from the JWT Template instead.

DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

-- Remove the hook from Supabase config (must be done via Dashboard or CLI)
-- ALTER DATABASE postgres RESET pgrst.db_extra_search_path;
-- Note: The actual hook removal from auth.hooks must be done via the Supabase Dashboard.
