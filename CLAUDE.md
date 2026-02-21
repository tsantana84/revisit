# CLAUDE.md — Revisit Codebase Guide

## What is this?

Revisit is a multi-tenant restaurant loyalty platform. Owners create loyalty programs, managers run POS operations, customers earn points and redeem rewards. There's also a super admin dashboard for cross-tenant visibility.

**Language:** All UI text and error messages are in **Portuguese (pt-BR)**.

## Tech Stack

- **Next.js 16** (App Router, Turbopack, React 19)
- **Clerk** — authentication (replaces Supabase Auth)
- **Supabase** — database (Postgres + RLS) and storage
- **Tailwind CSS 4** — styling
- **Zod 4** — validation
- **OpenAI** — DALL-E card image generation
- **Recharts** — analytics charts
- **TypeScript 5.9** (strict mode)

## Project Structure

```
src/
├── app/                        # App Router pages
│   ├── (auth)/                 # Login, signup, onboarding (Clerk components)
│   ├── dashboard/
│   │   ├── owner/              # Owner: settings, team, analytics, customers, logs
│   │   ├── manager/            # Manager: POS operations
│   │   └── admin/              # Super admin: restaurants, system logs
│   ├── api/
│   │   ├── staff/              # Manager invitations (Clerk Invitations API)
│   │   ├── generate-card/      # AI card image generation
│   │   └── webhooks/clerk/     # Clerk webhook (user.created)
│   └── [slug]/                 # Tenant public routes (customer registration)
├── lib/
│   ├── auth.ts                 # Centralized auth helpers (getRevisitAuth, requireOwner, etc.)
│   ├── logger.ts               # Structured JSON logger
│   ├── actions/                # Server Actions by domain
│   │   ├── auth.ts             # Onboarding (restaurant creation + Clerk metadata)
│   │   ├── customer.ts         # Customer registration
│   │   ├── pos.ts              # POS lookup + sale
│   │   ├── rewards.ts          # Reward checking + redemption
│   │   └── restaurant.ts       # Branding, ranks, card design, logo
│   ├── supabase/
│   │   ├── server.ts           # Clerk JWT-authenticated Supabase client
│   │   └── service.ts          # Service role client (bypasses RLS)
│   └── utils/
│       └── card-number.ts      # Card number validation
supabase/
├── migrations/                 # 0001-0011 numbered SQL migrations
├── config.toml
└── seed.sql
```

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test:rls     # Run RLS tests (vitest)
```

## Authentication

Clerk owns all auth. Supabase is database-only.

**How it works:** Clerk issues a JWT via a "supabase" JWT Template that includes `restaurant_id` and `app_role` from Clerk `publicMetadata`. Supabase RLS reads these claims via `auth.jwt()`.

**Auth helpers** (`src/lib/auth.ts`):
```typescript
getRevisitAuth()   // Returns { userId, restaurantId, role, email } or throws
requireOwner()     // Throws if not owner
requireManager()   // Throws if not manager or owner
requireAdmin()     // Throws if not admin
```

**Roles:** `owner` | `manager` | `admin`

**Three-layer security:**
1. Middleware — route guards via `clerkMiddleware`
2. Layout/Action — auth helpers throw on unauthorized
3. Database — RLS policies read JWT claims

## Supabase Clients

**Two clients, different purposes:**

| Client | File | When to use |
|--------|------|-------------|
| `createClerkSupabaseClient()` | `lib/supabase/server.ts` | Server Actions, Route Handlers — respects RLS |
| `createServiceClient()` | `lib/supabase/service.ts` | Admin operations, webhooks — bypasses RLS |

**Never import `createServiceClient` in client components.**

## Server Actions Pattern

All actions follow the same structure:

1. Auth check via `requireOwner()` / `requireManager()`
2. Create Supabase client via `createClerkSupabaseClient()`
3. Validate input with Zod
4. Database operations with error handling
5. Return discriminated union state for UI

```typescript
export type SaleState =
  | { step: 'success'; pointsEarned: number; ... }
  | { step: 'error'; message: string }
  | undefined
```

**Exception:** `customer.ts` uses `createServiceClient()` and reads `x-restaurant-id` from middleware headers (public-facing registration, no auth required).

## Middleware

`src/middleware.ts` handles:
- Route protection (Clerk `auth.protect()`)
- Role-based dashboard redirects
- Tenant slug resolution (`/:slug/*` → `x-restaurant-id` header injection)
- Slug cache with 5-minute TTL

## Structured Logging

Always use `src/lib/logger.ts`:

```typescript
import { log } from '@/lib/logger'

log.info('sale.registered', { restaurant_id, card_number, amount_cents, duration_ms })
log.error('sale.failed', { restaurant_id, error: message })
```

**Event naming:** `domain.action` in snake_case (e.g., `customer.registration_completed`, `middleware.slug_resolved`)

Output is one JSON line per event to stdout — compatible with Vercel, Datadog, etc.

## Multi-Tenancy

- Every data table is scoped by `restaurant_id`
- RLS enforces tenant isolation at the database level
- Middleware injects `x-restaurant-id` header for public tenant routes
- Card numbers are unique per restaurant, not globally

## Database Conventions

- **Soft deletes:** All entities have `deleted_at` column. Views prefixed `active_` filter these out.
- **Audit trail:** `point_transactions` table tracks every earn/redeem with `balance_after`
- **Atomic operations:** Card number generation uses an RPC function for uniqueness
- **Migrations:** Numbered `0001_` through `0011_`. Always add the next number.

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# OpenAI
OPENAI_API_KEY
```

## Key Flows

**Owner signup:** Clerk `<SignUp />` → `/onboarding` → create restaurant + staff row → set Clerk `publicMetadata` → redirect to dashboard

**Manager invitation:** Owner calls Clerk Invitations API → manager receives email → signs up via Clerk → `user.created` webhook creates `restaurant_staff` row

**Customer registration:** Public `/:slug/register` → middleware resolves slug → service client creates customer + card number

**POS sale:** Manager lookups customer by card → registers sale → points calculated → rank promotion check → transaction logged

## Style & Conventions

- Path alias: `@/*` → `src/*`
- Error messages in Portuguese
- Zod for all input validation
- Discriminated unions for action return types (`step: 'success' | 'error'`)
- Dark theme dashboard classes prefixed `db-` (e.g., `db-card`, `db-text`, `db-border`)
- No test files colocated with source (RLS tests in `supabase/tests/`)
