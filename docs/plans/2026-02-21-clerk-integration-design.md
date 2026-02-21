# Clerk Auth Integration Design

**Date:** 2026-02-21
**Status:** Approved
**Replaces:** Supabase Auth (full replacement)

---

## 1. Architecture Overview

Clerk becomes the sole auth provider. Supabase remains the database and storage layer. A Clerk JWT Template bridges the two systems — Clerk issues a secondary JWT that Supabase RLS policies can validate via `auth.jwt()`.

```
Browser → Clerk (auth UI, session) → JWT Template → Supabase (RLS)
Server  → Clerk SDK (getAuth) → getToken('supabase') → Supabase client
```

Three-layer security stays intact:
- **Middleware**: Route guards via `clerkMiddleware` + `createRouteMatcher`
- **Layout/Action**: Auth checks via centralized `src/lib/auth.ts`
- **Database**: RLS policies unchanged — they read `restaurant_id` and `app_role` from JWT claims

## 2. Clerk JWT Template for Supabase

Create a JWT Template named `supabase` in the Clerk Dashboard:

```json
{
  "sub": "{{user.id}}",
  "aud": "authenticated",
  "role": "authenticated",
  "restaurant_id": "{{user.public_metadata.restaurant_id}}",
  "app_role": "{{user.public_metadata.app_role}}",
  "email": "{{user.primary_email_address}}",
  "iss": "https://clerk.revisit.com"
}
```

The `aud: "authenticated"` and `role: "authenticated"` fields match what Supabase RLS expects. The `restaurant_id` and `app_role` fields come from Clerk `publicMetadata`, which replaces the PostgreSQL `custom_access_token_hook`.

Supabase project settings → JWT Secret must be set to the Clerk JWT signing key.

## 3. Supabase Client Factory

### Server-side (replaces `src/lib/supabase/server.ts`)

```typescript
// src/lib/supabase/server.ts
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

export async function createClerkSupabaseClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'supabase' })

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}
```

### Service client (`src/lib/supabase/service.ts`)

Unchanged — uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS.

### Browser client (`src/lib/supabase/client.ts`)

Currently unused/vestigial. If needed later, use `useSession().session.getToken({ template: 'supabase' })` from `@clerk/nextjs`.

## 4. Middleware Rewrite

Replace `src/middleware.ts` and `src/lib/supabase/middleware.ts`:

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/api/webhooks/clerk(.*)',
  '/:slug/register(.*)',
])

const isAdminRoute = createRouteMatcher(['/dashboard/admin(.*)'])
const isOwnerRoute = createRouteMatcher(['/dashboard/owner(.*)'])
const isPosRoute = createRouteMatcher(['/dashboard/pos(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Slug resolution for /:slug/* routes stays
  // Public routes pass through
  // Protected routes: auth().protect()
  // Role checks: read app_role from sessionClaims.publicMetadata
  // Admin routes: block non-admins
  // Owner routes: block non-owners
  // POS routes: block non-manager/non-owner
})
```

The slug resolution logic (restaurant lookup by slug, cookie caching) moves into the `clerkMiddleware` callback. Structured logging stays.

## 5. Signup Flow

1. User visits `/signup` → Clerk `<SignUp />` component handles auth
2. After sign-up, Clerk redirects to `/onboarding`
3. Onboarding page collects restaurant name (and optionally slug)
4. Server action creates restaurant + restaurant_staff row in Supabase (via service client)
5. Server action calls Clerk Backend API to set `publicMetadata`:
   ```typescript
   import { clerkClient } from '@clerk/nextjs/server'

   await clerkClient().users.updateUser(userId, {
     publicMetadata: { restaurant_id: restaurant.id, app_role: 'owner' }
   })
   ```
6. Redirect to `/dashboard/owner`

For admin creation: manually set `publicMetadata` with `app_role: 'admin'` via Clerk Dashboard or API.

## 6. Manager Invitation Flow

Replaces the current "owner creates manager with email+password" pattern:

1. Owner clicks "Convidar gerente" in staff page
2. Server action calls Clerk Invitations API:
   ```typescript
   await clerkClient().invitations.createInvitation({
     emailAddress: managerEmail,
     publicMetadata: { restaurant_id: restaurantId, app_role: 'manager' },
     redirectUrl: `${baseUrl}/accept-invitation`,
   })
   ```
3. Manager receives email, clicks link → Clerk sign-up flow
4. On `user.created` webhook, if `publicMetadata` has `restaurant_id`:
   - Insert `restaurant_staff` row via service client
5. Manager is ready to use POS

## 7. Auth Helpers Centralization

Create `src/lib/auth.ts` to replace 14 duplicated JWT decode patterns:

```typescript
import { auth, currentUser } from '@clerk/nextjs/server'

interface RevisitAuth {
  userId: string
  restaurantId: string | null
  role: 'owner' | 'manager' | 'admin'
  email: string
}

export async function getAuth(): Promise<RevisitAuth> { ... }
export async function requireOwner(): Promise<RevisitAuth & { restaurantId: string }> { ... }
export async function requireManager(): Promise<RevisitAuth & { restaurantId: string }> { ... }
export async function requireAdmin(): Promise<RevisitAuth> { ... }
```

All server actions and API routes switch from:
```typescript
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const { data: { session } } = await supabase.auth.getSession()
const claims = jwtDecode<RevisitClaims>(session.access_token)
```

To:
```typescript
const { userId, restaurantId, role } = await requireOwner()
const supabase = await createClerkSupabaseClient()
```

## 8. Files Changed

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/auth.ts` | **Create** — centralized auth helpers |
| 2 | `src/lib/supabase/server.ts` | **Replace** — Clerk-based Supabase client |
| 3 | `src/lib/supabase/middleware.ts` | **Delete** — logic moves to middleware.ts |
| 4 | `src/lib/supabase/client.ts` | **Delete** — vestigial |
| 5 | `src/middleware.ts` | **Replace** — clerkMiddleware |
| 6 | `src/app/layout.tsx` | **Modify** — wrap with `<ClerkProvider>` |
| 7 | `src/app/(auth)/login/page.tsx` | **Replace** — Clerk `<SignIn />` |
| 8 | `src/app/(auth)/signup/page.tsx` | **Replace** — Clerk `<SignUp />` |
| 9 | `src/app/(auth)/onboarding/page.tsx` | **Create** — post-signup restaurant setup |
| 10 | `src/lib/actions/auth.ts` | **Replace** — onboarding action + Clerk metadata |
| 11 | `src/lib/actions/customer.ts` | **Modify** — use `requireManager()` + new client |
| 12 | `src/lib/actions/pos.ts` | **Modify** — use `requireManager()` + new client |
| 13 | `src/lib/actions/rewards.ts` | **Modify** — use `requireManager()` + new client |
| 14 | `src/lib/actions/restaurant.ts` | **Modify** — use `requireOwner()` + new client |
| 15 | `src/app/api/staff/route.ts` | **Modify** — use `requireOwner()` + Clerk Invitations |
| 16 | `src/app/api/generate-card/route.ts` | **Modify** — use `requireOwner()` + new client |
| 17 | `src/app/api/webhooks/clerk/route.ts` | **Create** — handle `user.created` webhook |
| 18 | `src/app/dashboard/owner/layout.tsx` | **Modify** — use `getAuth()` |
| 19 | `src/app/dashboard/admin/layout.tsx` | **Modify** — use `requireAdmin()` |
| 20 | `src/app/dashboard/pos/layout.tsx` | **Modify** — use `getAuth()` |
| 21 | `supabase/migrations/0011_drop_auth_hook.sql` | **Create** — drop custom_access_token_hook |
| 22 | `package.json` | **Modify** — add `@clerk/nextjs` |
| 23 | `.env.local` | **Modify** — add Clerk env vars |

## 9. What Stays Unchanged

- **RLS policies** — they read `restaurant_id` from `auth.jwt()`, which now comes from Clerk's JWT Template instead of Supabase's hook
- **Service client** (`createServiceClient`) — still uses service role key, bypasses RLS
- **`restaurant_staff` table** — still the source of truth for user-restaurant mapping
- **All business logic** — customer registration, POS, rewards, analytics
- **Structured logging** — all `log.*` calls remain as-is
- **Admin dashboard** — same pages, just different auth check mechanism
- **Database schema** — no structural changes beyond dropping the auth hook

---

## Dependencies

- `@clerk/nextjs` — Clerk SDK for Next.js
- Clerk Dashboard: JWT Template named `supabase`
- Clerk Dashboard: Webhook endpoint for `user.created`
- Supabase: Update JWT secret to Clerk's signing key
