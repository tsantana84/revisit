# Phase 2: Owner Setup - Research

**Researched:** 2026-02-20
**Domain:** Supabase Auth (email/password), Next.js Server Actions, Supabase Storage, schema migration for branding/config columns, role-based routing
**Confidence:** HIGH (auth patterns, Server Actions, Storage), MEDIUM (signup flow ordering, trigger vs action approach)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Owner can sign up with email and password | Covered by: Supabase `auth.signUp()` in Server Action, service role client inserts restaurant + restaurant_staff records, email confirmation disabled in config.toml for local dev |
| AUTH-02 | Owner can log in and access their restaurant dashboard | Covered by: `signInWithPassword()` in Server Action + middleware reads `app_role` from JWT claim + redirect to `/dashboard/owner` |
| AUTH-03 | Owner can create manager accounts with email and password | Covered by: `auth.admin.createUser()` with `email_confirm: true` in API route (service role required), then insert into `restaurant_staff` with role='manager' |
| AUTH-04 | Manager can log in and access the dedicated manager panel | Covered by: same `signInWithPassword()` login page + middleware role check redirects to `/dashboard/manager`; middleware blocks `/dashboard/owner` for manager role |
| DASH-05 | Owner can configure program settings: program name, colors, ranks, multipliers, reward type | Covered by: migration adds branding + config columns to `restaurants` table; ranks migration adds `multiplier` and `visit_threshold` columns; Server Action updates via service role; dashboard settings page |
| WL-01 | Customer-facing pages are branded as the restaurant | Covered by: slug middleware already injects `x-restaurant-id`; Server Component reads branding from `restaurants` table; no REVISIT string in template |
| WL-02 | Customer never sees "REVISIT" on any customer-facing surface | Covered by: grep-based CI check in verification step; audit all customer-facing templates for the string "REVISIT" |
| WL-03 | Each restaurant has its own URL slug (app.revisit.com/{restaurant-slug}) | Covered by: Phase 1 middleware already fully implements this; slug auto-generated from restaurant name on signup |
| WL-04 | Colors, logo, and program name are fully configurable per restaurant | Covered by: restaurants table migration adds `primary_color`, `secondary_color`, `logo_url`, `program_name`; logo upload to Supabase Storage `restaurant-logos` bucket |
| WL-05 | Digital wallet card shows only restaurant branding | Covered by: branding data persisted in `restaurants` table; wallet card generation (Phase 4) reads from this table; this phase stores the data correctly |
</phase_requirements>

---

## Summary

Phase 2 is fundamentally a forms-and-auth phase with a schema migration component. It has four distinct work streams: (1) schema migration to add branding and program configuration columns to the `restaurants` table and a `multiplier` column to `ranks`, (2) the owner signup flow that atomically creates an auth user + restaurant + restaurant_staff record in a single Server Action, (3) the login/redirect flow that reads `app_role` from the JWT and routes owners vs managers to separate dashboard routes, and (4) the branding + program configuration forms that let the owner persist their settings.

The primary complexity is the owner signup atomicity problem. `signUp()` creates the auth user and issues a session, but the JWT from that session will not yet contain `restaurant_id` or `app_role` because the Custom Access Token Hook runs at token issuance time — and the `restaurant_staff` row that the hook reads does not exist until after signup. The correct sequence is: (1) create auth user via `auth.signUp()`, (2) use the service role client in the same Server Action to insert the `restaurants` row and the `restaurant_staff` row, (3) force the user to sign out and back in (or call `auth.refreshSession()`) so the hook issues a new JWT with the now-populated claims. The alternative is a Postgres trigger on `auth.users` that creates a placeholder record, but this approach has known failure risks and cannot create the `restaurants` row because it doesn't know the restaurant name.

Manager creation (AUTH-03, AUTH-04) uses `auth.admin.createUser()` with `email_confirm: true`, called from a Next.js Route Handler (not a Server Action) using the service role client. This bypasses the email confirmation flow for managers, which is appropriate since the owner is creating the account on behalf of the manager.

**Primary recommendation:** Use Server Action for all auth forms. Signup atomicity is handled by the service role client in the same Server Action call sequence. Logo uploads go to a public Supabase Storage bucket with RLS only on INSERT/DELETE operations. All branding config goes in new columns on the `restaurants` table (one migration). The middleware (built in Phase 1) handles all slug and role-based routing — Phase 2 only needs to extend it slightly for dashboard protection.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | 0.8.0 (installed) | Server-side client with cookie handling | Already installed in Phase 1 |
| `@supabase/supabase-js` | 2.97.0 (installed) | Service role admin client | Already installed; needed for `auth.admin.createUser()` |
| `react` | 19.2.4 (installed) | `useActionState` for form state/pending | React 19 built-in; no additional install |
| `zod` | latest | Server-side form validation | Official Next.js docs use Zod for Server Action validation; prevents invalid data reaching Supabase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `next/navigation` | built-in | `redirect()` after successful auth | Server Action redirect after signup/login |
| `next/headers` | built-in | `cookies()` in Server Components | Not needed directly — `@supabase/ssr` handles cookies |
| `slugify` | latest | Generate URL-safe slug from restaurant name | Auto-slug generation on signup; prevents owner from picking slug |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod server validation | Manual validation | Zod gives typed error objects that `useActionState` can surface per-field; manual validation is more code |
| `auth.admin.createUser()` for managers | Owner triggers `inviteUserByEmail()` | Invite flow requires email delivery for local dev; `createUser()` with `email_confirm: true` is simpler for POC |
| Supabase Storage for logos | External CDN / base64 in DB | Storage is already Supabase-native; public bucket CDN serves logos efficiently |

**Installation:**
```bash
npm install zod slugify
```

---

## Architecture Patterns

### Recommended Project Structure (additions to Phase 1)

```
src/
├── app/
│   ├── (auth)/               # Auth route group (no layout chrome)
│   │   ├── signup/
│   │   │   └── page.tsx      # Owner signup form
│   │   └── login/
│   │       └── page.tsx      # Single login page (owners + managers)
│   ├── dashboard/
│   │   ├── owner/            # Owner-only dashboard
│   │   │   ├── layout.tsx    # Verifies app_role = 'owner'; redirects manager
│   │   │   ├── page.tsx      # Overview (empty shell in Phase 2)
│   │   │   └── settings/
│   │   │       └── page.tsx  # Branding + program config form (DASH-05)
│   │   └── manager/          # Manager-only panel (empty shell in Phase 2)
│   │       ├── layout.tsx    # Verifies app_role = 'manager'; redirects owner
│   │       └── page.tsx      # Placeholder for Phase 3
├── lib/
│   ├── supabase/             # (already exists from Phase 1)
│   │   ├── client.ts         # No change
│   │   ├── server.ts         # No change
│   │   └── middleware.ts     # Extend: add /dashboard role-based redirect
│   └── actions/
│       ├── auth.ts           # signup(), login(), logout() Server Actions
│       └── restaurant.ts     # updateBranding(), createManager() actions
supabase/
└── migrations/
    ├── 0005_branding.sql     # Add branding + config columns to restaurants
    └── 0006_storage.sql      # Create restaurant-logos storage bucket + RLS
```

### Pattern 1: Owner Signup — Atomic Multi-Step Server Action

**What:** A single Server Action that creates the auth user, then immediately uses the service role client to create the restaurant row and staff row, then forces a session refresh.

**When to use:** Only for owner signup. Manager creation uses a separate Route Handler.

**Critical constraint:** The Custom Access Token Hook reads `restaurant_staff` at token issuance. If `signUp()` succeeds but the subsequent inserts fail, the user exists in auth but has no restaurant — they will log in with empty claims and see nothing. Solution: if the service role inserts fail, call `auth.admin.deleteUser(user.id)` to clean up the orphaned auth user before returning the error.

```typescript
// Source: Next.js docs (nextjs.org/docs/app/guides/authentication) + Supabase admin.createUser reference
// src/lib/actions/auth.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const SignupSchema = z.object({
  restaurantName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').trim(),
  email: z.email('Email inválido').trim(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

export type SignupState = {
  errors?: { restaurantName?: string[]; email?: string[]; password?: string[] }
  message?: string
} | undefined

export async function signup(prevState: SignupState, formData: FormData): Promise<SignupState> {
  // 1. Validate inputs
  const validated = SignupSchema.safeParse({
    restaurantName: formData.get('restaurantName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }
  const { restaurantName, email, password } = validated.data

  // 2. Create auth user (uses anon client — signUp creates and signs in)
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })
  if (authError || !authData.user) {
    return { message: authError?.message ?? 'Erro ao criar conta' }
  }
  const userId = authData.user.id

  // 3. Use service role to create restaurant + staff atomically
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )

  // Generate slug from restaurant name
  const slug = slugify(restaurantName, { lower: true, strict: true })

  const { data: restaurant, error: restaurantError } = await serviceClient
    .from('restaurants')
    .insert({ name: restaurantName, slug, program_name: restaurantName })
    .select('id')
    .single()

  if (restaurantError || !restaurant) {
    // Clean up orphaned auth user
    await serviceClient.auth.admin.deleteUser(userId)
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  const { error: staffError } = await serviceClient
    .from('restaurant_staff')
    .insert({ restaurant_id: restaurant.id, user_id: userId, role: 'owner' })

  if (staffError) {
    // Clean up orphaned restaurant and auth user
    await serviceClient.from('restaurants').delete().eq('id', restaurant.id)
    await serviceClient.auth.admin.deleteUser(userId)
    return { message: 'Erro ao configurar acesso. Tente novamente.' }
  }

  // 4. Force session refresh so the JWT hook picks up the new restaurant_staff row
  // signUp() issues a JWT before restaurant_staff exists — the hook gets null claims
  // signOut + redirect to login ensures a fresh login issues the correct JWT
  await supabase.auth.signOut()
  // Do NOT redirect() inside try/catch — Next.js throws a special error for redirects
  redirect('/login?signup=success')
}
```

**Key insight on JWT claim timing:** `supabase.auth.signUp()` issues a JWT immediately. At that moment, `restaurant_staff` does not yet exist (we insert it after). So the first JWT has empty `restaurant_id` and `app_role` claims. Signing out and back in triggers the hook again with the now-populated table, issuing a correct JWT.

### Pattern 2: Login — Role-Based Redirect

**What:** A single login page for both owners and managers. After `signInWithPassword()`, call `getUser()` to read JWT claims, then redirect based on `app_role`.

```typescript
// Source: Next.js docs auth guide + Supabase signInWithPassword reference
'use server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(prevState: unknown, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  })

  if (error) {
    return { message: 'Email ou senha inválidos' }
  }

  // Read JWT claims to determine role-based redirect
  const { data: { user } } = await supabase.auth.getUser()
  const role = user?.app_metadata?.['app_role'] // custom claim is in app_metadata mirror
  // NOTE: custom JWT claims are accessible via user.app_metadata on the client
  // but the actual JWT claim is set by the hook. After signIn, the session
  // cookie contains the JWT — the claim is readable from the decoded token.
  // Alternatively, decode the session's access_token to read `app_role`.

  if (role === 'owner') {
    redirect('/dashboard/owner')
  } else if (role === 'manager') {
    redirect('/dashboard/manager')
  } else {
    // User exists in auth but has no restaurant_staff row — orphaned account
    await supabase.auth.signOut()
    return { message: 'Conta não associada a nenhum restaurante' }
  }
}
```

**Note on reading custom JWT claims after login:** The `getUser()` call returns a `User` object where custom JWT claims injected by the hook appear in `user.app_metadata` (Supabase mirrors them there) OR you decode the access token from the session. The reliable approach is to decode the session's `access_token` JWT — it directly contains `app_role` and `restaurant_id` as top-level claims.

### Pattern 3: Middleware — Dashboard Route Protection

**What:** Extend the existing `updateSession()` in `src/lib/supabase/middleware.ts` to protect `/dashboard/owner` and `/dashboard/manager` routes by reading the `app_role` JWT claim.

**When to use:** Every request to `/dashboard/**`.

```typescript
// Extension to src/lib/supabase/middleware.ts updateSession()
// After auth.getUser() call, add:
import { jwtDecode } from 'jwt-decode'  // already in package.json or add: npm install jwt-decode

const { data: { session } } = await supabase.auth.getSession()
// Note: getSession() is ONLY acceptable here because we're reading the claim for redirect,
// not trusting it for data access. Data access is protected by RLS which uses getUser().

if (session) {
  const claims = jwtDecode<{ app_role?: string; restaurant_id?: string }>(session.access_token)
  const role = claims.app_role
  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/dashboard/owner') && role !== 'owner') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/dashboard/manager') && role !== 'manager') {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname.startsWith('/dashboard') && !role) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
  return NextResponse.redirect(new URL('/login', request.url))
}
```

**Alternative: read claims via layout.tsx (more secure, no JWT decode needed):**
- `dashboard/owner/layout.tsx` calls `supabase.auth.getUser()`, then queries `restaurant_staff` to confirm `role = 'owner'`. This is the "close to the data source" pattern recommended by Next.js docs.
- Middleware handles the fast redirect for unauthenticated users; layout handles role enforcement.

### Pattern 4: Manager Account Creation

**What:** Owner uses a form in the dashboard to create a manager account. This calls a Route Handler (not a Server Action) that uses `auth.admin.createUser()` with the service role client.

**Why Route Handler instead of Server Action:** `auth.admin.*` requires the service role key. Server Actions can also use it, but a Route Handler makes the boundary explicit and is easier to reason about for admin operations.

```typescript
// src/app/api/staff/route.ts
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  // 1. Verify the caller is an authenticated owner
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Get the caller's restaurant_id from the JWT claim
  // (We need to decode the access token to get the custom claim)
  const { data: { session } } = await supabase.auth.getSession()
  // Only for reading claims — not for RLS trust
  const claims = session ? jwtDecode<{ restaurant_id?: string; app_role?: string }>(session.access_token) : null
  if (claims?.app_role !== 'owner' || !claims.restaurant_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Parse and validate request body
  const { email, password } = await request.json()
  if (!email || !password) return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })

  // 4. Create the manager auth user (no confirmation email)
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  )

  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,  // Skip confirmation email — owner has verified the manager's email
  })
  if (createError || !newUser.user) {
    return NextResponse.json({ error: createError?.message ?? 'Erro ao criar conta' }, { status: 400 })
  }

  // 5. Insert restaurant_staff row for the manager
  const { error: staffError } = await serviceClient
    .from('restaurant_staff')
    .insert({
      restaurant_id: claims.restaurant_id,
      user_id: newUser.user.id,
      role: 'manager',
    })

  if (staffError) {
    await serviceClient.auth.admin.deleteUser(newUser.user.id)
    return NextResponse.json({ error: 'Erro ao configurar acesso do gerente' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

### Pattern 5: Schema Migration — Branding and Config Columns

**What:** A new SQL migration adds branding and program configuration columns to the `restaurants` table, and adds missing `multiplier` and `visit_threshold` columns to `ranks`.

**Critical finding:** The `ranks` table is missing the `multiplier` column (used for points calculation) and should use `visit_threshold` / `min_visits` (not `min_points` — RANK-03 says rank is by visit count, not points). The current schema has `min_points` on `ranks`, which conflicts with the requirement. This needs a migration to add `min_visits` (or rename) and `multiplier`.

```sql
-- supabase/migrations/0005_branding.sql

-- Add branding and program configuration columns to restaurants
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS program_name     TEXT,
  ADD COLUMN IF NOT EXISTS primary_color    TEXT NOT NULL DEFAULT '#000000',
  ADD COLUMN IF NOT EXISTS secondary_color  TEXT NOT NULL DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS logo_url         TEXT,           -- Supabase Storage public URL
  ADD COLUMN IF NOT EXISTS earn_rate        INTEGER NOT NULL DEFAULT 2,  -- points per R$1
  ADD COLUMN IF NOT EXISTS reward_type      TEXT NOT NULL DEFAULT 'cashback'
    CHECK (reward_type IN ('cashback', 'free_product', 'progressive_discount')),
  ADD COLUMN IF NOT EXISTS point_expiry_days INTEGER;       -- NULL = never expire

-- Add multiplier and visit-based threshold to ranks
-- NOTE: ranks.min_points is misleading — RANK-03 says rank is by visit count.
-- Keep min_points for backward compat with seed data; add min_visits for Phase 3 use.
ALTER TABLE public.ranks
  ADD COLUMN IF NOT EXISTS multiplier   NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS min_visits   INTEGER NOT NULL DEFAULT 0;

-- Update seed data rank records to have correct multipliers and visit thresholds
-- (done in updated seed.sql, not migration — keeps migration idempotent)
```

### Pattern 6: Supabase Storage for Logo Uploads

**What:** A public storage bucket for restaurant logos. RLS restricts INSERT (upload) and DELETE to authenticated owners, but SELECT (download) is public. Bucket created in a SQL migration.

```sql
-- supabase/migrations/0006_storage.sql

-- Create the restaurant-logos bucket (public: logos are served as CDN assets)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos',
  'restaurant-logos',
  true,                          -- public: anyone can read via the public URL
  1048576,                       -- 1MB limit per logo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;    -- idempotent

-- RLS: Only authenticated owners can upload to their own restaurant's folder
-- Path convention: restaurant-logos/{restaurant_id}/{filename}
CREATE POLICY "owner_upload_logo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND (storage.foldername(name))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  );

CREATE POLICY "owner_delete_logo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND (storage.foldername(name))[1] = (SELECT public.get_restaurant_id())::TEXT
    AND (SELECT public.get_app_role()) = 'owner'
  );

-- Public bucket handles SELECT without RLS for CDN serving
-- No SELECT policy needed for public buckets
```

**Upload from Server Action:**
```typescript
// In the branding update Server Action:
const logoFile = formData.get('logo') as File
if (logoFile && logoFile.size > 0) {
  const ext = logoFile.name.split('.').pop()
  const path = `${restaurantId}/logo.${ext}`  // upsert pattern
  const { data, error } = await supabase.storage
    .from('restaurant-logos')
    .upload(path, logoFile, { upsert: true, contentType: logoFile.type })

  if (!error) {
    const { data: { publicUrl } } = supabase.storage
      .from('restaurant-logos')
      .getPublicUrl(path)

    await supabase.from('restaurants').update({ logo_url: publicUrl }).eq('id', restaurantId)
  }
}
```

**Note on CDN staleness with upsert:** Supabase docs warn that overwriting files (upsert: true) causes CDN propagation delays — cached CDN copies serve the old logo for minutes. For a POC, this is acceptable. Production fix: append a timestamp or version number to the path to force CDN cache busting.

### Anti-Patterns to Avoid

- **Trusting JWT claims for data mutations without RLS:** Middleware reads `app_role` from the JWT for routing. This is correct. RLS (in place from Phase 1) prevents data mutation mistakes independently. Never skip RLS because the middleware "already checked the role."
- **Using `supabase.auth.getSession()` for server-side trust decisions:** `getSession()` does not verify the JWT signature. Use `getUser()` for any trust decision, and `getSession()` only for reading claims for UI purposes.
- **Auth user without restaurant_staff row:** If signup fails mid-way (restaurant insert succeeds, staff insert fails), the user can log in but the hook gets null claims. The cleanup pattern (delete auth user on insert failure) prevents this.
- **Using a Postgres trigger on `auth.users` for restaurant creation:** The trigger fires at the Postgres level and cannot receive the restaurant name from the form — it only sees `raw_user_meta_data`. While you can pass metadata to `signUp()`, any trigger failure blocks the signup entirely. The Server Action approach gives explicit error handling.
- **`min_points` on `ranks` for rank promotion:** RANK-03 requires rank by visit count, not points. The `min_points` column in the current schema is misnamed. Use `min_visits` for rank thresholds; `min_points` can remain for any future points-based tier logic.
- **Checking `user.app_metadata` to read custom JWT claims:** Supabase Client SDK reflects some claims in `user.app_metadata`, but this is not reliable for custom hook-injected claims. Always decode the raw `access_token` to read `restaurant_id` and `app_role` reliably.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation on the server | Custom field checking code | `zod` | Type-safe, standard, integrates with `useActionState` error shape |
| File upload with size/type limits | Custom multipart parser | Supabase Storage SDK with `allowedMimeTypes` and `fileSizeLimit` on bucket | Bucket-level enforcement in Supabase; no parser needed in application |
| Manager account password flow | Custom password reset/invite | `auth.admin.createUser()` with `email_confirm: true` | Owner sets the initial password directly; no email flow needed for POC |
| Role-based route guard component | Custom HOC or wrapper | Layout-level `supabase.auth.getUser()` + redirect | Next.js App Router layouts are the correct pattern for shared auth checks per segment |
| Slug uniqueness validation | Custom uniqueness check query | Postgres UNIQUE constraint on `restaurants.slug` + catch the constraint error | Constraint is already in place from Phase 1 schema; catch error code `23505` in the Server Action |

**Key insight:** The auth stack composes correctly only when used in layers: middleware handles unauthenticated redirects fast (reads JWT claim), layout handles role enforcement (reads JWT claim), RLS handles data access (reads JWT claim from database). All three must be present; none replaces the others.

---

## Common Pitfalls

### Pitfall 1: JWT Claims Empty After Signup
**What goes wrong:** Owner signs up, gets redirected to dashboard, but the dashboard shows no restaurant data because `restaurant_id` is null in the JWT.
**Why it happens:** `supabase.auth.signUp()` issues a JWT immediately at signup time. The `restaurant_staff` row doesn't exist yet when the hook fires — it's inserted in the lines of code after signUp() in the Server Action. So the first JWT has no claims.
**How to avoid:** After all inserts succeed, call `supabase.auth.signOut()` and redirect to the login page with a `?signup=success` param. The user logs in normally, the hook finds the now-existing `restaurant_staff` row, and issues a JWT with correct claims.
**Warning signs:** Dashboard page loads but Supabase queries return empty results for the authenticated user even though the restaurant exists in the DB.

### Pitfall 2: Slug Collision on Signup
**What goes wrong:** Two restaurants with similar names generate the same slug. Insert fails with a `23505` unique violation.
**Why it happens:** `slugify('Café do João')` and `slugify('Cafe do Joao')` may produce the same slug.
**How to avoid:** Catch the `23505` error code from the Supabase insert response and append a random suffix: `slug-3x7a`. The Server Action retries with the suffixed slug, or returns an error asking the user to choose a different name.
**Warning signs:** Restaurant creation fails silently or with a generic error for users with names similar to existing restaurants.

### Pitfall 3: Logo Upload File Too Large / Wrong Type in Client
**What goes wrong:** User uploads a 10MB PNG, the storage upload call returns a `413 Payload Too Large` or type rejection.
**Why it happens:** Client-side file pickers don't enforce limits. Bucket-level limits only fire at upload time.
**How to avoid:** Add `accept="image/jpeg,image/png,image/webp,image/svg+xml"` and validate `file.size < 1_048_576` in the Server Action before calling the storage SDK. Return a form error before hitting the network.
**Warning signs:** Users see a generic storage error or timeout; no user-friendly message.

### Pitfall 4: Manager Can Access Owner Dashboard Routes
**What goes wrong:** A logged-in manager navigates to `/dashboard/owner/settings` and sees (or modifies) restaurant configuration.
**Why it happens:** Middleware redirect is optimistic — it reads the JWT claim. But if the layout doesn't also verify the role, a determined user can sometimes bypass the redirect by direct navigation.
**How to avoid:** Both middleware (fast redirect for unauth) AND the layout (role check close to data) must verify `app_role`. The layout should call `supabase.auth.getUser()` and check the JWT claim — not just middleware alone.
**Warning signs:** Navigating directly to `/dashboard/owner` while logged in as manager doesn't redirect to `/dashboard/manager`.

### Pitfall 5: `ranks.min_points` vs `ranks.min_visits` Confusion
**What goes wrong:** Owner configures ranks with visit thresholds (as required), but the data is stored in `min_points` (which was in the Phase 1 schema). Later code uses the wrong column for rank promotion.
**Why it happens:** RANK-03 says rank is by visit count; RANK-01 says owner configures "visit thresholds" — but the existing `ranks` table only has `min_points`. The Phase 1 researcher missed this column mismatch.
**How to avoid:** The Phase 2 schema migration adds `min_visits INTEGER NOT NULL DEFAULT 0` to `ranks`. The branding config form uses `min_visits`. The `min_points` column stays for backward compat with seed data but is not used for rank promotion.
**Warning signs:** Rank config UI shows "pontos mínimos" instead of "visitas mínimas" — wrong business logic.

### Pitfall 6: Email Confirmation Blocking Signup in Local Dev
**What goes wrong:** Owner signs up, the server returns success, but the user cannot log in because Supabase is waiting for email confirmation.
**Why it happens:** Local Supabase has `enable_confirmations = true` in config.toml by default for hosted projects, but defaults vary. If not explicitly set to `false`, signUp() creates the user but marks email as unconfirmed.
**How to avoid:** Add this to `supabase/config.toml`:
```toml
[auth.email]
enable_signup = true
enable_confirmations = false
```
This is for local dev only. On production Supabase, email confirmation can remain enabled since the hook is configured in the Dashboard.
**Warning signs:** `signUp()` returns success, `signInWithPassword()` returns "Email not confirmed".

### Pitfall 7: Storage RLS on Public Buckets Still Applies to Writes
**What goes wrong:** Logo upload fails with an RLS policy violation even though the bucket is public.
**Why it happens:** Public bucket status only bypasses RLS for SELECT (reads/downloads). INSERT (upload), DELETE, UPDATE still require an RLS policy that permits the operation.
**How to avoid:** The storage migration must create INSERT and DELETE policies on `storage.objects` for the bucket. Without them, no authenticated user can upload — even to a public bucket.
**Warning signs:** `supabase.storage.from('restaurant-logos').upload()` returns a 403 policy violation.

---

## Code Examples

Verified patterns from official sources and Phase 1 established patterns:

### Owner Signup — Client Component with useActionState

```typescript
// Source: nextjs.org/docs/app/guides/authentication
// src/app/(auth)/signup/page.tsx
'use client'
import { useActionState } from 'react'
import { signup } from '@/lib/actions/auth'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <form action={action}>
      <div>
        <label htmlFor="restaurantName">Nome do Restaurante</label>
        <input id="restaurantName" name="restaurantName" required />
        {state?.errors?.restaurantName && <p>{state.errors.restaurantName[0]}</p>}
      </div>
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />
        {state?.errors?.email && <p>{state.errors.email[0]}</p>}
      </div>
      <div>
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" required />
        {state?.errors?.password && <p>{state.errors.password[0]}</p>}
      </div>
      {state?.message && <p role="alert">{state.message}</p>}
      <button type="submit" disabled={pending}>
        {pending ? 'Criando conta...' : 'Criar conta'}
      </button>
    </form>
  )
}
```

### Service Role Client Factory (for Server Actions and Route Handlers)

```typescript
// Source: Supabase discussions/30739 + @supabase/supabase-js docs
// src/lib/supabase/service.ts  (NEW file in Phase 2)
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role key.
 * Use ONLY in Server Actions and Route Handlers.
 * NEVER import this in client components or pages.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
```

### Reading Custom JWT Claims from Session

```typescript
// Source: Supabase RBAC docs + Phase 1 established patterns
// The custom Access Token Hook injects restaurant_id and app_role as top-level JWT claims.
// These are accessible by decoding the access_token from the session.
// jwt-decode is a lightweight decode-only library (no verification — use getUser() for trust)

import { jwtDecode } from 'jwt-decode'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string  // user_id
  exp: number
}

// In a Server Component or Server Action:
const supabase = await createClient()
const { data: { session } } = await supabase.auth.getSession()
// getSession() is used ONLY for reading claims for UI/routing — not for security decisions
// Security is enforced by RLS (which uses getUser() internally) and layout auth checks

if (session) {
  const claims = jwtDecode<RevisitClaims>(session.access_token)
  const { restaurant_id, app_role } = claims
}
```

### Branding Config Update Server Action

```typescript
// src/lib/actions/restaurant.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'

const BrandingSchema = z.object({
  program_name: z.string().min(1).max(100).trim(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  secondary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
  earn_rate: z.coerce.number().int().min(1).max(100),
  reward_type: z.enum(['cashback', 'free_product', 'progressive_discount']),
  point_expiry_days: z.coerce.number().int().min(0).nullable().optional(),
})

export async function updateBranding(prevState: unknown, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { message: 'Não autenticado' }

  const validated = BrandingSchema.safeParse(Object.fromEntries(formData))
  if (!validated.success) return { errors: validated.error.flatten().fieldErrors }

  // RLS ensures update only affects the authenticated owner's restaurant
  const { error } = await supabase
    .from('restaurants')
    .update(validated.data)
    .eq('id', '...')  // restaurant_id from decoded JWT claim

  if (error) return { message: 'Erro ao salvar configurações' }

  revalidatePath('/dashboard/owner/settings')
  return { message: 'Configurações salvas com sucesso' }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useFormStatus` (from react-dom) | `useActionState` (from react) | React 19 | `useActionState` replaces the old hook; provides form state, error shape, and pending in one call |
| `auth-helpers-nextjs` createServerActionClient | `@supabase/ssr` createServerClient (already in project) | 2024 | Already using correct package from Phase 1 |
| Separate login pages per role | Single `/login` page with role-based redirect | Current best practice | Simpler UX; role determined from JWT claim after authentication |
| Email invitation flow for staff | `auth.admin.createUser({ email_confirm: true })` | Current Supabase docs | For POC where owner sets manager password directly; no email delivery required |

**Deprecated/outdated:**
- `createServerActionClient` from `@supabase/auth-helpers-nextjs`: deprecated, do not use
- `useFormStatus` for form-level state: use `useActionState` from `react` instead
- `supabase.auth.getSession()` for trust decisions: use `getUser()` instead (getSession() does not verify JWT)

---

## Open Questions

1. **JWT claim reading after signUp + immediate signOut approach vs session refresh**
   - What we know: `auth.refreshSession()` exists and re-issues the JWT (triggering the hook). This would avoid the signOut + redirect flow.
   - What's unclear: Whether `refreshSession()` in a Server Action reliably refreshes the session cookie before the redirect — the response cookies need to be set correctly for the new JWT to persist.
   - Recommendation: The signOut + redirect approach is proven and simple. If refresh-in-place is needed for UX reasons, test `refreshSession()` and verify the cookie is set on the response before adopting it.

2. **`ranks.min_points` naming conflict with visit-based rank thresholds**
   - What we know: Current schema has `min_points` on `ranks`, but RANK-03 says rank is by visit count. Phase 1 research doc used `min_points` for rank threshold — likely a copy-paste from a points-based system assumption.
   - What's unclear: Whether the planner should rename the column (breaking change to seed data) or add a parallel `min_visits` column.
   - Recommendation: Add `min_visits INTEGER NOT NULL DEFAULT 0` as a new column. Leave `min_points` for any future use. Seed data should be updated to populate `min_visits` with the correct values (0, 5, 15, 30 per RANK-02 defaults).

3. **Storage bucket RLS on `storage.foldername()` — Supabase function availability**
   - What we know: Supabase Storage provides helper functions like `storage.foldername(name)` and `storage.extension(name)` for path-based RLS policies.
   - What's unclear: Whether these functions are available in all Supabase CLI versions / local dev environments.
   - Recommendation: Use path-based check: `(string_to_array(name, '/'))[1] = (SELECT public.get_restaurant_id())::TEXT` as a fallback if `storage.foldername()` is not available locally.

4. **Dashboard layout structure — one layout with role check vs two separate layouts**
   - What we know: `app/dashboard/owner/layout.tsx` and `app/dashboard/manager/layout.tsx` as separate layout files means each route segment independently checks the role.
   - What's unclear: Whether a shared `app/dashboard/layout.tsx` with shared nav chrome would complicate the role-separation requirement.
   - Recommendation: Use separate layouts per role (`owner/layout.tsx` and `manager/layout.tsx`). Each layout independently calls `getUser()` and checks `app_role`. No shared `/dashboard/layout.tsx` — it would make role checks ambiguous.

---

## Sources

### Primary (HIGH confidence)
- [Supabase auth.admin.createUser reference](https://supabase.com/docs/reference/javascript/auth-admin-createuser) — parameters, `email_confirm`, server-only requirement
- [Next.js Authentication Guide](https://nextjs.org/docs/app/guides/authentication) (version 16.1.6, dated 2026-02-20) — full `useActionState` signup pattern, Server Action implementation, role-based redirect in layout
- [Supabase Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data) — `handle_new_user()` trigger pattern, SECURITY DEFINER requirement, warning about trigger blocking signups
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — RLS on `storage.objects`, public bucket behavior (reads bypass RLS, writes do not)
- [Supabase Storage Bucket Creation](https://supabase.com/docs/guides/storage/buckets/creating-buckets) — SQL INSERT syntax for bucket creation in migrations
- [Supabase Password Auth](https://supabase.com/docs/guides/auth/passwords) — `signUp()`, `signInWithPassword()`, email confirmation config
- Phase 1 Research + Summaries (established patterns) — JWT hook, RLS helper, middleware, slug cache, `@supabase/ssr` patterns

### Secondary (MEDIUM confidence)
- [Supabase Discussion #30739 — Service Role in Next.js](https://github.com/orgs/supabase/discussions/30739) — `auth: { persistSession: false, autoRefreshToken: false }` config for service role client; cross-referenced with official docs
- [Supabase Discussion #7890 — Disable email confirmation](https://github.com/orgs/supabase/discussions/7890) — `enable_confirmations = false` in config.toml; confirmed by Supabase CLI config docs
- WebSearch consensus on `useActionState` from React 19 replacing `useFormStatus` for form-level state — cross-verified with Next.js 16 docs and React 19 release notes

### Tertiary (LOW confidence — flag for validation)
- Reading custom JWT claims via `jwtDecode` on the client session access_token — documented pattern in Supabase RBAC guide but specific behavior for hook-injected claims (top-level vs app_metadata) should be verified in the actual running environment.
- `storage.foldername()` availability in local Supabase CLI — confirmed to exist in Supabase docs but not verified against the specific CLI version in use (supabase-cli-v2.75.0).

---

## Metadata

**Confidence breakdown:**
- Auth patterns (signup, login, admin.createUser): HIGH — verified with official Supabase and Next.js 16 docs
- Server Action + useActionState form pattern: HIGH — Next.js 16 docs dated 2026-02-20 contain exact code
- JWT claim timing after signUp: MEDIUM — reasoning is sound but the specific behavior of signOut + redirect vs refreshSession needs validation in the running environment
- Storage RLS policies: MEDIUM — official docs confirm the pattern; specific function names (storage.foldername) need local validation
- Schema migration design (branding columns, ranks.min_visits): HIGH — straightforward SQL with no external dependency
- Role-based middleware extension: HIGH — follows established Phase 1 patterns

**Research date:** 2026-02-20
**Valid until:** 2026-03-20 (30 days — Supabase Auth and Next.js App Router APIs are stable at these versions)
