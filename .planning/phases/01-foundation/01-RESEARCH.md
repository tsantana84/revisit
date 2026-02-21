# Phase 1: Foundation - Research

**Researched:** 2026-02-20
**Domain:** Supabase RLS + JWT custom claims + Next.js tenant middleware + PostgreSQL schema design
**Confidence:** HIGH (core patterns), MEDIUM (discretionary design choices)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Soft delete everywhere — `deleted_at` timestamp column on all tables, nothing ever hard-deleted
- Seed script with one demo restaurant — enough sample customers, sales, and ranks to verify the flow during development
- `restaurant_id` column on every single table — redundant but explicit, RLS policies are simple and consistent across the entire schema
- Automated cross-tenant test suite — runs on every deploy, verifies that a query authenticated as Restaurant A never returns Restaurant B data (must run from Supabase client SDK, not SQL Editor which bypasses RLS)

### Claude's Discretion
- **Points ledger design** — Claude picks the best approach for auditability and performance (running balance vs transaction log vs both)
- **Rank storage** — Claude decides whether ranks are a separate table or JSONB column, based on query patterns
- **Reward config storage** — Claude decides polymorphic JSON vs typed columns, based on flexibility vs type safety
- **RLS helper pattern** — Claude decides whether to use a helper function (get_restaurant_id()) or direct JWT access in policies
- **JWT claims** — Claude picks the right set of claims (at minimum restaurant_id + role, potentially more)
- **Auth model** — Claude decides whether owners and managers share one Supabase Auth table with roles or use separate flows
- **Login routing** — Claude picks whether to use role-based redirect from a single login or separate login pages
- **Manager scope** — Claude decides one-restaurant-only vs schema-supports-multiple for POC
- **Slug source** — Claude decides whether slug is auto-generated from restaurant name or owner-picked
- **Invalid slug behavior** — Claude decides the UX for invalid slugs (404, redirect, etc.)
- **Slug caching** — Claude decides the caching strategy for slug-to-restaurant_id resolution in middleware
- **Slug payload** — Claude decides whether middleware resolves just restaurant_id or also loads branding data

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-05 | Each restaurant's data is fully isolated — customers, points, sales, and configurations never visible to other restaurants (Supabase RLS) | Covered by: RLS policy patterns with restaurant_id, JWT custom claims hook, security definer helper functions, and cross-tenant test suite via SDK |
</phase_requirements>

---

## Summary

This phase establishes the invisible plumbing that every subsequent feature depends on. It has three distinct technical layers: (1) the PostgreSQL schema with soft-delete and tenant columns, (2) the Supabase Auth Custom Access Token Hook that injects `restaurant_id` and `role` into every JWT, and (3) the Next.js middleware that resolves the tenant slug from the URL path and enforces authentication before protected routes.

The RLS strategy is straightforward: all policies check `auth.jwt() ->> 'restaurant_id' = restaurant_id::text`, wrapped in `(SELECT auth.jwt() ->> 'restaurant_id')` for query plan caching. A single security definer helper function `get_restaurant_id()` is the right call — it eliminates repetition across 10+ tables and the planner caches the result per statement. The soft-delete + RLS interaction has a known gotcha: the SELECT policy must allow the row to be visible during UPDATE processing, which the view-based approach solves cleanly.

The cross-tenant test requirement (must use SDK, not SQL Editor) drives a specific testing architecture: Vitest integration tests that create real users with `supabase.auth.admin.createUser()`, sign in as each user, and assert data isolation. pgTAP can also be used for SQL-layer tests. Both approaches are valid; the SDK-based Vitest suite is the primary deliverable since it can run on every deploy in CI.

**Primary recommendation:** Use the Custom Access Token Hook to embed `restaurant_id` + `app_role` into the JWT, enforce with RLS policies using a `get_restaurant_id()` security definer function, and test isolation with the Supabase JS SDK against a real local instance via Supabase CLI.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | latest | Server-side Supabase client with cookie handling | Official package replacing deprecated auth-helpers; handles cookie read/write contract for Next.js middleware + Server Components |
| `@supabase/supabase-js` | v2 | Client-side Supabase client | Standard JS client for browser use |
| `supabase` CLI | latest | Local dev, migrations, seed scripts, test runner | Official toolchain; `supabase db push`, `supabase test db` |
| `pgTAP` | via Supabase extension | SQL-layer RLS policy testing | Built into Supabase; `supabase test db` runs `.sql` test files |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | latest | SDK-level cross-tenant isolation tests | Required per user decision: cross-tenant tests MUST use SDK (not SQL Editor) |
| `jwt-decode` | latest | Decode JWT in client to read custom claims | Lightweight decode-only library (does not verify); needed to read `restaurant_id` from session on client |
| `supabase-test-helpers` (basejump) | latest | pgTAP helper: `authenticate_as()`, `create_supabase_user()`, `clear_authentication()` | Simplifies pgTAP user-context switching significantly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Auth Helpers is deprecated — do not use |
| Security definer `get_restaurant_id()` | `auth.jwt() ->> 'restaurant_id'` inline | Inline works but repeats across every policy; planner cannot cache without `(SELECT ...)` wrapper; helper centralizes the pattern |
| Vitest SDK tests | pgTAP only | pgTAP runs as Postgres superuser, SQL Editor bypasses RLS, defeating the test purpose — SDK tests are the correct approach per user decision |

**Installation:**
```bash
npm install @supabase/ssr @supabase/supabase-js jwt-decode
npm install -D vitest @vitest/coverage-v8
# Supabase CLI (macOS)
brew install supabase/tap/supabase
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/supabase/
│   ├── client.ts          # createBrowserClient — client components
│   ├── server.ts          # createServerClient — server components / route handlers
│   └── middleware.ts      # updateSession() — token refresh + tenant resolution
├── middleware.ts           # Next.js middleware entry point
├── app/
│   ├── [slug]/            # All customer-facing tenant routes
│   │   └── ...            # Receives restaurant_id via middleware headers
│   ├── dashboard/         # Owner/manager portal (auth-gated)
│   └── login/             # Single login page with role-based redirect
supabase/
├── migrations/
│   ├── 0001_schema.sql    # All tables
│   ├── 0002_rls.sql       # All RLS policies
│   ├── 0003_hooks.sql     # Custom access token hook function
│   └── 0004_views.sql     # Soft-delete views
├── seed.sql               # Demo restaurant seed data
└── tests/
    ├── rls_isolation.test.ts   # Vitest SDK cross-tenant tests
    └── rls_policies.sql        # pgTAP SQL-layer tests (optional secondary)
```

### Pattern 1: Custom Access Token Hook — JWT Claims Injection

**What:** A Postgres function that runs before every JWT is issued. Adds `restaurant_id` and `app_role` to the JWT claims by querying the `restaurant_staff` table.

**When to use:** Always — this is the mechanism that makes `auth.jwt() ->> 'restaurant_id'` available inside RLS policies.

**Example:**
```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
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
  SELECT restaurant_id, role
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

-- Grant the auth system access to execute this function and read the lookup table
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.restaurant_staff TO supabase_auth_admin;

-- Revoke from public to prevent direct calls
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;
```

Configure in Supabase Dashboard: Authentication → Hooks → Custom Access Token → select the function.

### Pattern 2: RLS Helper Function + Policy Template

**What:** A `SECURITY DEFINER` helper function that extracts `restaurant_id` from the JWT once per statement. Policies call it with `(SELECT get_restaurant_id())` to trigger query plan caching.

**When to use:** All RLS policies on all tenant-scoped tables.

```sql
-- Source: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
CREATE OR REPLACE FUNCTION public.get_restaurant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (auth.jwt() ->> 'restaurant_id')::UUID;
$$;

-- Helper for role checks
CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.jwt() ->> 'app_role';
$$;

-- Template for every tenant table's SELECT policy
CREATE POLICY "tenant_isolation_select"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (restaurant_id = (SELECT public.get_restaurant_id()));

-- Template for INSERT policy (also restrict writes)
CREATE POLICY "tenant_isolation_insert"
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));
```

**Critical performance note:** Without the `(SELECT ...)` wrapper, Postgres calls `get_restaurant_id()` once per row. With it, the planner caches the result for the entire statement — documented as up to 99.94% improvement on large tables.

### Pattern 3: Soft Delete + RLS — The View Approach

**What:** Tables have `deleted_at TIMESTAMPTZ`. Instead of filtering in RLS, create a view that filters it, and applications query the view. RLS policy on the base table remains simple (tenant isolation only).

**When to use:** Mandatory given user decision to soft-delete everything. This avoids the critical RLS conflict where an UPDATE to set `deleted_at` fails because the SELECT policy already hides the row.

```sql
-- Bad: RLS SELECT policy that excludes soft-deleted rows
-- UPDATE to set deleted_at will fail because after UPDATE, the row
-- matches deleted_at IS NOT NULL, so the re-validation SELECT fails.

-- Good: Keep RLS simple (tenant only), filter via view
CREATE POLICY "tenant_isolation_select"
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (restaurant_id = (SELECT public.get_restaurant_id()));
  -- No deleted_at check here!

-- Application queries this view instead of the base table
CREATE VIEW public.active_customers AS
  SELECT * FROM public.customers
   WHERE deleted_at IS NULL;
```

**Source:** https://supabase.com/docs/guides/troubleshooting/soft-deletes-with-supabase-js

### Pattern 4: Next.js Middleware — Tenant Resolution

**What:** Middleware extracts the slug from the URL path, resolves it to a `restaurant_id`, injects it as a request header, and refreshes the Supabase auth token.

**When to use:** Runs on every request to tenant routes (`/[slug]/...`).

```typescript
// middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // 1. Refresh Supabase auth token (mandatory — server components can't write cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getClaims() not getSession() in middleware (server-side validation)
  const { data: { user } } = await supabase.auth.getUser()

  // 2. Extract slug from path: /[slug]/...
  const segments = request.nextUrl.pathname.split('/')
  const slug = segments[1]

  if (slug && isCustomerRoute(request.nextUrl.pathname)) {
    // 3. Resolve slug → restaurant_id
    // Use service role client for this lookup (bypasses RLS, safe because we control it)
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )
    const { data: restaurant } = await adminSupabase
      .from('restaurants')
      .select('id, name')
      .eq('slug', slug)
      .eq('deleted_at', null) // exclude soft-deleted
      .single()

    if (!restaurant) {
      return NextResponse.rewrite(new URL('/not-found', request.url))
    }

    // 4. Inject restaurant_id as header for server components to consume
    supabaseResponse.headers.set('x-restaurant-id', restaurant.id)
    supabaseResponse.headers.set('x-restaurant-name', restaurant.name)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Key constraints:**
- Next.js middleware runs in the **Edge Runtime** — no Node.js APIs
- `unstable_cache` and the new `use cache` directive do NOT work in Edge Runtime
- In-memory `Map()` works but resets on every cold start (Vercel serverless) — acceptable for a slug lookup that hits DB on miss
- The service role key is safe in middleware (server-only) but must NEVER be `NEXT_PUBLIC_`

### Pattern 5: Cross-Tenant Isolation Test (SDK-based)

**What:** Vitest integration tests that authenticate as real users against a local Supabase instance and assert that each restaurant's data cannot be seen by other restaurants.

**When to use:** Required per user decision. Must use Supabase client SDK, not SQL Editor (which bypasses RLS as the postgres superuser).

```typescript
// supabase/tests/rls_isolation.test.ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY     = process.env.SUPABASE_ANON_KEY!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

describe('Cross-tenant RLS isolation', () => {
  let userA: { email: string; password: string; restaurantId: string }
  let userB: { email: string; password: string; restaurantId: string }

  beforeAll(async () => {
    // Create two isolated restaurants and staff accounts
    // ... setup code creates restaurants A and B, creates users,
    //     inserts test customers for each restaurant
  })

  it('Restaurant A owner cannot see Restaurant B customers', async () => {
    const clientA = createClient(SUPABASE_URL, ANON_KEY)
    await clientA.auth.signInWithPassword({ email: userA.email, password: userA.password })

    const { data } = await clientA.from('customers').select('*')
    const ids = data?.map(c => c.restaurant_id) ?? []
    expect(ids.every(id => id === userA.restaurantId)).toBe(true)
  })

  it('Restaurant B owner cannot see Restaurant A customers', async () => {
    const clientB = createClient(SUPABASE_URL, ANON_KEY)
    await clientB.auth.signInWithPassword({ email: userB.email, password: userB.password })

    const { data } = await clientB.from('customers').select('*')
    const ids = data?.map(c => c.restaurant_id) ?? []
    expect(ids.every(id => id === userB.restaurantId)).toBe(true)
  })

  it('Unauthenticated client gets zero rows', async () => {
    const anon = createClient(SUPABASE_URL, ANON_KEY)
    const { data } = await anon.from('customers').select('*')
    expect(data).toHaveLength(0)
  })
})
```

Run with: `supabase start && vitest run supabase/tests/`

### Anti-Patterns to Avoid

- **`auth.jwt()` inline without `(SELECT ...)`:** Postgres re-evaluates the JWT function per row. Always wrap: `(SELECT auth.jwt() ->> 'restaurant_id')`.
- **RLS on soft-delete visibility:** Including `deleted_at IS NULL` in SELECT RLS policy causes UPDATE-to-soft-delete to fail (the UPDATE re-validates SELECT, which now hides the just-updated row). Use views instead.
- **`supabase.auth.getSession()` in server code:** Does not validate JWT signature. Use `getUser()` in middleware and server code.
- **`getAll`/`setAll` omission:** The `@supabase/ssr` cookie contract requires `getAll` and `setAll` only — never the old `get`/`set`/`remove` individual methods.
- **Service role key with `NEXT_PUBLIC_` prefix:** Exposes the key to the browser. Always `SUPABASE_SERVICE_ROLE_KEY` (no PUBLIC prefix).
- **Testing RLS from SQL Editor or Supabase Studio:** Both run as postgres superuser and bypass RLS entirely. Tests pass but mean nothing.
- **Forgetting `TO authenticated` in policy `FOR` clause:** Without it, the anon role also evaluates the policy on every request, wasting cycles.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT injection into tokens | Custom auth middleware | Supabase Custom Access Token Hook | Runs in Postgres before JWT issuance; guaranteed atomic with auth |
| Cookie session management in Next.js | Manual cookie set/get | `@supabase/ssr` createServerClient | Handles the request/response cookie sync contract correctly |
| Auth token refresh in middleware | Custom JWT decode + refresh logic | `supabase.auth.getUser()` in middleware | Verifies JWT signature against published public keys |
| Tenant slug → ID mapping | Custom resolver service | Direct Supabase query in middleware with service role client | Middleware is the right layer; no extra service needed |
| RLS test framework | Custom testing SQL scripts | pgTAP + basejump test helpers OR Vitest SDK tests | SDK tests are mandatory; pgTAP helpers provide `authenticate_as()` sugar |

**Key insight:** The auth stack is deeply integrated — don't try to separate the JWT, RLS, and cookie concerns into custom code. Each Supabase primitive solves a specific integration point and they compose correctly only when used together.

---

## Common Pitfalls

### Pitfall 1: SQL Editor / Supabase Studio Bypass
**What goes wrong:** Developer writes `SELECT * FROM customers` in SQL Editor, sees all data from all restaurants, concludes RLS is broken.
**Why it happens:** SQL Editor and Supabase Studio run as the `postgres` superuser, which bypasses RLS entirely.
**How to avoid:** Test RLS ONLY via the Supabase JS client with a valid JWT. The automated SDK test suite (user decision) enforces this.
**Warning signs:** A query returns cross-tenant data when run from Studio but not from the app.

### Pitfall 2: Soft Delete + RLS UPDATE Conflict
**What goes wrong:** Setting `deleted_at = NOW()` via Supabase client returns a 403 error, even though the user owns the row.
**Why it happens:** Supabase UPDATE internally: (1) SELECT to find rows, (2) apply UPDATE, (3) re-validate SELECT policy on updated row. If SELECT policy includes `deleted_at IS NULL`, the row is invisible after step 2, causing step 3 to fail.
**How to avoid:** Do not include `deleted_at IS NULL` in RLS SELECT policies. Use a database view for filtering. RLS only enforces tenant isolation.
**Warning signs:** Soft-deletes fail with policy violations; hard-deletes would have worked.

### Pitfall 3: Missing `(SELECT ...)` Wrapper on JWT Function Calls
**What goes wrong:** RLS policies work correctly but queries are extremely slow on tables with many rows.
**Why it happens:** `auth.jwt() ->> 'restaurant_id'` is re-evaluated once per row. On a table with 100k rows, that's 100k JWT parse operations per query.
**How to avoid:** Always wrap: `(SELECT public.get_restaurant_id())`. The query planner treats this as a subquery that is evaluated once and cached for the statement.
**Warning signs:** `EXPLAIN ANALYZE` shows `Function Scan` appearing many times instead of once.

### Pitfall 4: JWT Claims Not Updating After Role Change
**What goes wrong:** Developer changes a user's restaurant or role in the database, but the user still sees the old data.
**Why it happens:** JWT claims are baked into the token at issue time. The Custom Access Token Hook only runs when a NEW token is issued. Existing tokens remain valid until expiry (default: 1 hour in Supabase).
**How to avoid:** For admin-level role changes, use `supabase.auth.admin.signOut(userId)` to force token invalidation, or accept that changes take up to 1 hour to propagate.
**Warning signs:** Roles or restaurant assignments appear correct in DB but wrong in app behavior.

### Pitfall 5: Missing Grant on Hook's Lookup Table
**What goes wrong:** Custom Access Token Hook runs but `restaurant_id` and `app_role` are always null in JWT claims.
**Why it happens:** The hook executes as `supabase_auth_admin` role. If RLS on `restaurant_staff` blocks that role (or GRANT is missing), the SELECT returns null rather than raising an error.
**How to avoid:** Explicitly `GRANT SELECT ON TABLE public.restaurant_staff TO supabase_auth_admin`.
**Warning signs:** Claims are null for all users; the hook function executes but the lookup silently returns nothing.

### Pitfall 6: Edge Runtime Cannot Use `unstable_cache` or `use cache`
**What goes wrong:** Developer tries to cache slug lookups in middleware using `unstable_cache` or the new `use cache` directive, gets a runtime error.
**Why it happens:** Next.js middleware runs only in the Edge Runtime. Both `unstable_cache` and the new Cache Components require Node.js runtime.
**How to avoid:** For slug caching in middleware, either (a) skip caching entirely (slug lookup is one small DB query per request), or (b) use a module-level `Map` as a warm cache that persists across requests within the same Edge instance (resets on cold start — acceptable for a POC).
**Warning signs:** `Error: unstable_cache is not available in the Edge runtime`.

### Pitfall 7: `NEXT_PUBLIC_` Service Role Key
**What goes wrong:** Service role key is exposed in browser bundle, allowing any user to bypass RLS.
**Why it happens:** Naming a server-only variable with the `NEXT_PUBLIC_` prefix causes Next.js to include it in the client bundle.
**How to avoid:** Name it `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_`). Use it only in server files, middleware, and route handlers.
**Warning signs:** Key visible in browser DevTools Network tab or page source.

---

## Code Examples

### Full Custom Access Token Hook (production-ready)
```sql
-- Source: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook
-- + https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac

CREATE TYPE public.app_role AS ENUM ('owner', 'manager');

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims          JSONB;
  v_restaurant_id UUID;
  v_role          public.app_role;
BEGIN
  SELECT restaurant_id, role::public.app_role
    INTO v_restaurant_id, v_role
    FROM public.restaurant_staff
   WHERE user_id = (event->>'user_id')::UUID
     AND deleted_at IS NULL
   LIMIT 1;

  claims := event->'claims';

  IF v_restaurant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{restaurant_id}', to_jsonb(v_restaurant_id::TEXT));
    claims := jsonb_set(claims, '{app_role}',      to_jsonb(v_role::TEXT));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT USAGE  ON SCHEMA public                              TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.restaurant_staff              TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC, authenticated, anon;
```

### RLS Helper Functions
```sql
-- Source: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv

CREATE OR REPLACE FUNCTION public.get_restaurant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT (auth.jwt() ->> 'restaurant_id')::UUID; $$;

CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT auth.jwt() ->> 'app_role'; $$;

-- RLS policy template (repeat for each table):
CREATE POLICY "tenant_isolation"
  ON public.{table_name}
  FOR ALL
  TO authenticated
  USING      (restaurant_id = (SELECT public.get_restaurant_id()))
  WITH CHECK (restaurant_id = (SELECT public.get_restaurant_id()));
```

### Soft Delete View Pattern
```sql
-- Base table has deleted_at; RLS only enforces tenant isolation
-- Application code queries views for all normal operations

CREATE VIEW public.active_customers AS
  SELECT * FROM public.customers WHERE deleted_at IS NULL;

CREATE VIEW public.active_point_transactions AS
  SELECT * FROM public.point_transactions WHERE deleted_at IS NULL;

-- Soft delete operation (no RLS conflict):
UPDATE public.customers
   SET deleted_at = NOW()
 WHERE id = $1;
-- This works because SELECT RLS does NOT check deleted_at
```

### Points Ledger Schema (Recommended Design)
```sql
-- Recommendation: Transaction log + denormalized running balance on customers table
-- Rationale: Pure transaction log requires SUM() on every balance check (expensive).
-- Pure running balance has concurrency/drift risk. Both gives auditability + fast reads.

CREATE TABLE public.point_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id),
  customer_id     UUID NOT NULL REFERENCES public.customers(id),
  points_delta    INTEGER NOT NULL,              -- positive = earn, negative = redeem
  balance_after   INTEGER NOT NULL,              -- denormalized running balance at time of tx
  transaction_type TEXT NOT NULL,                -- 'earn', 'redeem', 'adjustment', 'expiry'
  reference_id    UUID,                          -- FK to sales or reward_redemptions
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ                    -- soft delete per user decision
);

-- Running balance stored on customers for fast reads (no SUM needed)
-- Updated atomically with each transaction via function + trigger or application logic
ALTER TABLE public.customers ADD COLUMN points_balance INTEGER NOT NULL DEFAULT 0;

-- Index for balance reads
CREATE INDEX idx_point_transactions_customer ON public.point_transactions(customer_id, created_at DESC);
CREATE INDEX idx_point_transactions_restaurant ON public.point_transactions(restaurant_id);
```

**Rationale for this design:** The pgledger pattern (source: https://www.pgrs.net/2025/03/24/pgledger-ledger-implementation-in-postgresql/) stores both deltas AND running balances to avoid expensive SUM queries on every read. Points are integers (no float risk — confirmed prior decision). The `balance_after` column enables audit ("why is my balance X?") and the `points_balance` on `customers` enables instant reads. Both must be updated in the same transaction.

### Rank Storage (Recommended Design)
```sql
-- Recommendation: Separate `ranks` table (not JSONB column)
-- Rationale: Ranks are queried by ID to display customer rank, queried by threshold
-- to determine rank-ups, and iterated in order. All three patterns benefit from
-- relational structure and indexes. JSONB would make threshold queries awkward.

CREATE TABLE public.ranks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id),
  name            TEXT NOT NULL,                 -- "Bronze", "Silver", "Gold"
  min_points      INTEGER NOT NULL,              -- threshold to achieve this rank
  sort_order      INTEGER NOT NULL,              -- display/progression order
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key on customers
ALTER TABLE public.customers ADD COLUMN current_rank_id UUID REFERENCES public.ranks(id);

CREATE INDEX idx_ranks_restaurant_threshold ON public.ranks(restaurant_id, min_points);
```

### Reward Config Storage (Recommended Design)
```sql
-- Recommendation: Typed columns (not JSONB) for a POC with known reward types.
-- For this system, there's one reward type: "spend X points, get Y reward".
-- JSONB flexibility is premature for a single reward type. Typed columns give
-- type safety, constraint enforcement, and clear schema documentation.

CREATE TABLE public.reward_configs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id),
  name            TEXT NOT NULL,                 -- "Free Coffee"
  description     TEXT,
  points_required INTEGER NOT NULL,              -- cost in points
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- If reward types multiply in future phases, add a `reward_type` discriminator column
-- and migrate to typed config at that point rather than over-engineering now.
```

### Auth Model (Recommended Design)
```sql
-- Recommendation: Single Supabase Auth table, roles via JWT claims.
-- Owners and managers both sign in through one login page at /login.
-- After sign-in, the JWT contains `app_role` = 'owner' | 'manager'.
-- Middleware reads the role claim and redirects: owner → /dashboard/owner, manager → /dashboard/manager.
-- No separate login pages. No separate auth tables. Simpler, fewer code paths.

-- All staff (owners + managers) live in restaurant_staff:
CREATE TABLE public.restaurant_staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   UUID NOT NULL REFERENCES public.restaurants(id),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  role            public.app_role NOT NULL,       -- 'owner' | 'manager'
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)  -- each user belongs to exactly one restaurant (POC scope)
);
```

### Manager Scope (Recommendation)
**Decision:** Schema enforces one-restaurant-only via `UNIQUE(user_id)` on `restaurant_staff`. This is the right POC scope. If future phases need multi-restaurant managers, the UNIQUE constraint is dropped and the JWT claim logic changed to return an array (Supabase JWT size limit applies).

### Slug Design (Recommendation)
```sql
-- Auto-generated from restaurant name during signup (owner cannot pick slug — reduces complexity).
-- Slug is URL-safe, lowercase, hyphenated. Generated in application code, stored in restaurants.
-- Invalid slug behavior: 404 (NextResponse.rewrite to /not-found). Clean, no confusion.

ALTER TABLE public.restaurants ADD COLUMN slug TEXT UNIQUE NOT NULL;
CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);

-- Caching strategy: Module-level Map in middleware. Persists within same Edge instance.
-- On Vercel, this provides warm cache for hot slugs within a worker lifetime.
-- On cold start, first request hits DB. Acceptable for POC.
-- Do NOT attempt unstable_cache or use cache — both are Node.js only, not Edge Runtime.
const slugCache = new Map<string, { restaurantId: string; name: string }>();
```

### Middleware Slug Payload (Recommendation)
**Decision:** Middleware resolves `restaurant_id` + `name` (basic branding). Not the full branding payload (logo URL, colors). The restaurant page Server Component fetches full branding data directly using the `restaurant_id` header. Middleware should stay lean — it runs on every request.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023-2024 | Auth Helpers is deprecated; `@supabase/ssr` is the official replacement |
| `get`, `set`, `remove` cookie methods | `getAll`, `setAll` only | With `@supabase/ssr` | Old methods caused race conditions; new batch methods are atomic |
| `supabase.auth.getSession()` in server code | `supabase.auth.getUser()` (or `getClaims()` for JWT-only validation) | 2024 docs update | `getSession()` does not verify JWT signature server-side; `getUser()` does |
| Storing role in `user_metadata` | Storing role in `app_metadata` or custom JWT claim via Hook | 2024 | `user_metadata` is user-editable; `app_metadata` is admin-only; Hook-injected claims are most secure |
| `unstable_cache` in middleware | Module-level `Map` or skip caching | Next.js 15/16 | `unstable_cache` and `use cache` require Node.js runtime; middleware is Edge Runtime only |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: deprecated, do not use
- `createMiddlewareClient` from auth-helpers: replaced by `createServerClient` from `@supabase/ssr`
- `supabase.auth.getSession()` in server/middleware code: insecure, use `getUser()`

---

## Open Questions

1. **Supabase API key naming (publishable vs anon)**
   - What we know: Supabase rolled out a new key naming scheme in late 2024 — `sb_publishable_xxx` replaces the old `anon` key for new projects; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the documented env var name
   - What's unclear: Whether the project being built is new (gets new keys) or migrated (keeps old keys); old `anon` key still works during transition
   - Recommendation: Check the Supabase project dashboard for the actual key format. Use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` if on new key scheme; `NEXT_PUBLIC_SUPABASE_ANON_KEY` if on old scheme. The `createBrowserClient` call accepts either.

2. **pgTAP tests vs SDK tests as CI gate**
   - What we know: User decision is SDK-based tests; pgTAP is an alternative that tests at SQL layer. pgTAP's `authenticate_as()` helper does set JWT context properly (not the same as SQL Editor superuser).
   - What's unclear: Whether pgTAP tests with `authenticate_as()` truly exercise RLS or also run as superuser.
   - Recommendation: Implement both. SDK tests (Vitest) are the primary gate per user decision. pgTAP tests can add a secondary layer for schema-level validation. The basejump test helpers are the only credible pgTAP RLS testing library found.

3. **Hook timeout with restaurant lookup**
   - What we know: Postgres Custom Access Token Hook has a 2-second hard timeout
   - What's unclear: Whether a single-row indexed lookup from `restaurant_staff` will consistently fit within 2 seconds under load
   - Recommendation: The lookup is a primary-key indexed SELECT on a small table — this should complete in milliseconds. Add an index on `restaurant_staff(user_id)` and it will be fine.

---

## Sources

### Primary (HIGH confidence)
- [Supabase Custom Access Token Hook](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook) — hook function signature, GRANT requirements, 2-second timeout
- [Supabase Custom Claims & RBAC](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — complete hook function example, RLS policy pattern
- [Supabase RLS Performance & Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — `(SELECT ...)` wrapper, index recommendations, security definer functions
- [Supabase Soft Deletes Guide](https://supabase.com/docs/guides/troubleshooting/soft-deletes-with-supabase-js) — view-based approach to avoid UPDATE/SELECT policy conflict
- [Supabase SSR Server-Side Auth for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) — `createServerClient`, cookie `getAll`/`setAll` pattern, middleware pattern
- [Next.js RLS docs — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — `auth.uid()`, `auth.jwt()`, `TO authenticated` clause
- [pgLedger — Ledger Implementation in PostgreSQL](https://www.pgrs.net/2025/03/24/pgledger-ledger-implementation-in-postgresql/) — transaction log + running balance pattern
- [Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview) — SDK vs pgTAP testing approaches

### Secondary (MEDIUM confidence)
- [Basejump pgTAP Test Helpers](https://usebasejump.com/blog/testing-on-supabase-with-pgtap) — `authenticate_as()`, `create_supabase_user()`, `clear_authentication()` helper functions; verified against Supabase docs
- [Next.js GitHub Issue: Caching doesn't work in middleware](https://github.com/vercel/next.js/issues/48169) — Edge Runtime cache limitation; confirmed by Next.js docs on `unstable_cache`
- [Supabase RLS Best Practices — MakerKit](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — cross-tenant testing patterns; cross-referenced with Supabase docs
- [Next.js Multi-Tenant Guide](https://nextjs.org/docs/app/guides/multi-tenant) — official guide referenced (content minimal but links to Vercel example)

### Tertiary (LOW confidence — flag for validation)
- WebSearch consensus on slug auto-generation vs user-pick: common pattern is auto-generation from name, but no official Supabase guide found. Implemented as recommendation.
- Module-level `Map` for slug caching in Edge Runtime: pattern inferred from Edge Runtime constraints; no official Supabase/Next.js guide for this specific pattern.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@supabase/ssr` and Supabase CLI are official and well-documented
- Custom Access Token Hook: HIGH — official Supabase docs, exact SQL verified
- RLS patterns: HIGH — official Supabase docs with performance benchmarks
- Soft delete + RLS: HIGH — official Supabase troubleshooting guide
- Middleware patterns: HIGH (pattern) / MEDIUM (slug caching specifics)
- Points ledger design: MEDIUM — pattern from pgLedger and industry standard; not Supabase-specific
- Rank/reward schema: MEDIUM — design reasoning is sound; no external validation source
- Cross-tenant SDK tests: HIGH — explicitly documented as correct approach vs SQL Editor

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days — Supabase APIs are stable, but check for `@supabase/ssr` patch versions)
