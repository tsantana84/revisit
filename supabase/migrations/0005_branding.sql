-- =============================================================================
-- Migration 0005: Branding and program configuration columns
-- Adds branding fields to restaurants and ranking fields to ranks
-- =============================================================================

-- Add branding and program configuration columns to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS program_name      TEXT,
  ADD COLUMN IF NOT EXISTS primary_color     TEXT NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS secondary_color   TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS logo_url          TEXT,
  ADD COLUMN IF NOT EXISTS earn_rate         INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS reward_type       TEXT NOT NULL DEFAULT 'cashback'
    CHECK (reward_type IN ('cashback', 'free_product', 'progressive_discount')),
  ADD COLUMN IF NOT EXISTS point_expiry_days INTEGER;

-- Add multiplier and visit-based threshold to ranks
-- NOTE: ranks.min_points is misleading per RANK-03 (rank is by visit count, not points).
-- Keep min_points for backward compat with seed data; add min_visits for Phase 3 use.
ALTER TABLE public.ranks
  ADD COLUMN IF NOT EXISTS multiplier  NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS min_visits  INTEGER NOT NULL DEFAULT 0;
