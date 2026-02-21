-- =============================================================================
-- Migration 0003: Active-Record Views (Soft-Delete Filter)
-- REVISIT loyalty platform — application queries use these views, not base tables
-- =============================================================================

-- Views filter out soft-deleted rows.
-- RLS on base tables handles tenant isolation.
-- This separation avoids the UPDATE/soft-delete RLS conflict:
--   If SELECT policy included deleted_at IS NULL, then setting deleted_at = NOW()
--   would fail at re-validation (the row becomes invisible after the UPDATE).

CREATE VIEW public.active_restaurants AS
  SELECT * FROM public.restaurants
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_restaurant_staff AS
  SELECT * FROM public.restaurant_staff
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_customers AS
  SELECT * FROM public.customers
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_ranks AS
  SELECT * FROM public.ranks
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_reward_configs AS
  SELECT * FROM public.reward_configs
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_point_transactions AS
  SELECT * FROM public.point_transactions
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_reward_redemptions AS
  SELECT * FROM public.reward_redemptions
  WHERE deleted_at IS NULL;

CREATE VIEW public.active_sales AS
  SELECT * FROM public.sales
  WHERE deleted_at IS NULL;
