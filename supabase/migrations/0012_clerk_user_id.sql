-- Migration: Change restaurant_staff.user_id from UUID (Supabase Auth) to TEXT (Clerk IDs)
-- Clerk user IDs are strings like "user_2xYz..." — not UUIDs.

-- 1. Drop the view that depends on the column
DROP VIEW IF EXISTS public.active_restaurant_staff;

-- 2. Drop the FK constraint to auth.users
ALTER TABLE public.restaurant_staff
  DROP CONSTRAINT restaurant_staff_user_id_fkey;

-- 3. Change column type from UUID to TEXT
ALTER TABLE public.restaurant_staff
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 4. Recreate the view
CREATE VIEW public.active_restaurant_staff AS
  SELECT * FROM public.restaurant_staff
  WHERE deleted_at IS NULL;
