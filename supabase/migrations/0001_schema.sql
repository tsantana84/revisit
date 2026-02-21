-- =============================================================================
-- Migration 0001: Base Schema
-- REVISIT loyalty platform — all tables with tenant isolation columns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM ('owner', 'manager');

-- ---------------------------------------------------------------------------
-- 1. restaurants — must exist first (all other tables reference it)
-- ---------------------------------------------------------------------------
CREATE TABLE public.restaurants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);

-- ---------------------------------------------------------------------------
-- 2. ranks — referenced by customers.current_rank_id; must exist before customers
-- ---------------------------------------------------------------------------
CREATE TABLE public.ranks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  name          TEXT NOT NULL,
  min_points    INTEGER NOT NULL,
  sort_order    INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_ranks_restaurant_threshold ON public.ranks(restaurant_id, min_points);

-- ---------------------------------------------------------------------------
-- 3. restaurant_staff — owners and managers (references auth.users and restaurants)
-- ---------------------------------------------------------------------------
CREATE TABLE public.restaurant_staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  user_id       UUID NOT NULL REFERENCES auth.users(id),
  role          public.app_role NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ,
  UNIQUE(user_id)   -- one restaurant per user for POC
);

-- ---------------------------------------------------------------------------
-- 4. customers — references restaurants and ranks
-- ---------------------------------------------------------------------------
CREATE TABLE public.customers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES public.restaurants(id),
  name             TEXT NOT NULL,
  phone            TEXT NOT NULL,
  card_number      TEXT UNIQUE,
  points_balance   INTEGER NOT NULL DEFAULT 0,
  visit_count      INTEGER NOT NULL DEFAULT 0,
  current_rank_id  UUID REFERENCES public.ranks(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ,
  UNIQUE(restaurant_id, phone)   -- per-tenant phone uniqueness
);

-- ---------------------------------------------------------------------------
-- 5. reward_configs — referenced by reward_redemptions
-- ---------------------------------------------------------------------------
CREATE TABLE public.reward_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id),
  name            TEXT NOT NULL,
  description     TEXT,
  points_required INTEGER NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 6. point_transactions — ledger log (transaction log + running balance pattern)
-- ---------------------------------------------------------------------------
CREATE TABLE public.point_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES public.restaurants(id),
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  points_delta     INTEGER NOT NULL,    -- positive = earn, negative = redeem
  balance_after    INTEGER NOT NULL,    -- denormalized running balance at time of tx
  transaction_type TEXT NOT NULL,       -- 'earn', 'redeem', 'adjustment', 'expiry'
  reference_id     UUID,               -- FK to sales or reward_redemptions (app-level)
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_point_transactions_customer ON public.point_transactions(customer_id, created_at DESC);
CREATE INDEX idx_point_transactions_restaurant ON public.point_transactions(restaurant_id);

-- ---------------------------------------------------------------------------
-- 7. reward_redemptions
-- ---------------------------------------------------------------------------
CREATE TABLE public.reward_redemptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    UUID NOT NULL REFERENCES public.restaurants(id),
  customer_id      UUID NOT NULL REFERENCES public.customers(id),
  reward_config_id UUID NOT NULL REFERENCES public.reward_configs(id),
  points_spent     INTEGER NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 8. sales
-- ---------------------------------------------------------------------------
CREATE TABLE public.sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id),
  customer_id   UUID NOT NULL REFERENCES public.customers(id),
  staff_id      UUID NOT NULL REFERENCES public.restaurant_staff(id),
  amount_cents  INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- Policies are created in 0002_rls.sql
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_configs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales             ENABLE ROW LEVEL SECURITY;
