# Clerk Auth Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Supabase Auth with Clerk as the sole auth provider, keeping Supabase for database/storage with RLS enforced via Clerk JWT Templates.

**Architecture:** Clerk handles all auth UI and session management. A Clerk JWT Template named `supabase` bridges the two systems — it emits `restaurant_id` and `app_role` from Clerk `publicMetadata` so Supabase RLS policies continue working via `auth.jwt()`. A centralized `src/lib/auth.ts` replaces 14 duplicated jwtDecode patterns across the codebase.

**Tech Stack:** `@clerk/nextjs`, `@supabase/supabase-js`, Next.js 16, React 19

**Design doc:** `docs/plans/2026-02-21-clerk-integration-design.md`

---

## Task 1: Install Clerk and Remove Supabase Auth Packages

**Files:**
- Modify: `package.json`

**Step 1: Install @clerk/nextjs**

Run: `npm install @clerk/nextjs`

**Step 2: Remove Supabase auth packages**

Run: `npm uninstall @supabase/ssr jwt-decode`

**Step 3: Verify install**

Run: `ls node_modules/@clerk/nextjs/package.json && cat package.json | grep -E "clerk|supabase|jwt-decode"`
Expected: `@clerk/nextjs` present, `@supabase/ssr` and `jwt-decode` gone, `@supabase/supabase-js` still present

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @clerk/nextjs, remove @supabase/ssr and jwt-decode"
```

---

## Task 2: Add Clerk Environment Variables

**Files:**
- Modify: `.env.local` (not committed — manual step)
- Modify: `.env.local.example`

**Step 1: Document required env vars in `.env.local.example`**

Add these lines to the existing file (keep existing SUPABASE and OPENAI vars):

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

**Step 2: Commit**

```bash
git add .env.local.example
git commit -m "chore: add Clerk env vars to .env.local.example"
```

> **Manual step:** Copy these vars to `.env.local` with real values from your Clerk Dashboard.

---

## Task 3: Create Centralized Auth Helpers

**Files:**
- Create: `src/lib/auth.ts`

**Step 1: Write `src/lib/auth.ts`**

This replaces the 14 duplicated `createClient → getUser → getSession → jwtDecode` patterns across the codebase.

```typescript
import { auth, currentUser } from '@clerk/nextjs/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AppRole = 'owner' | 'manager' | 'admin'

export interface RevisitAuth {
  userId: string
  restaurantId: string | null
  role: AppRole
  email: string
}

type WithRestaurant = RevisitAuth & { restaurantId: string }

// ---------------------------------------------------------------------------
// Base helper — reads Clerk session claims
// ---------------------------------------------------------------------------

export async function getRevisitAuth(): Promise<RevisitAuth> {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('Não autenticado')
  }

  const metadata = (sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>
  const role = metadata.app_role as AppRole | undefined
  const restaurantId = (metadata.restaurant_id as string) ?? null
  const email = (sessionClaims?.email as string) ?? ''

  if (!role) {
    throw new Error('Conta não associada a nenhum restaurante')
  }

  return { userId, restaurantId, role, email }
}

// ---------------------------------------------------------------------------
// Role-specific helpers
// ---------------------------------------------------------------------------

export async function requireOwner(): Promise<WithRestaurant> {
  const ctx = await getRevisitAuth()
  if (ctx.role !== 'owner') {
    throw new Error('Acesso negado: apenas proprietários podem realizar esta ação')
  }
  if (!ctx.restaurantId) {
    throw new Error('Restaurante não encontrado')
  }
  return ctx as WithRestaurant
}

export async function requireManager(): Promise<WithRestaurant> {
  const ctx = await getRevisitAuth()
  if (ctx.role !== 'manager' && ctx.role !== 'owner') {
    throw new Error('Acesso negado: apenas gerentes e proprietários podem usar o PDV')
  }
  if (!ctx.restaurantId) {
    throw new Error('Restaurante não encontrado')
  }
  return ctx as WithRestaurant
}

export async function requireAdmin(): Promise<RevisitAuth> {
  const ctx = await getRevisitAuth()
  if (ctx.role !== 'admin') {
    throw new Error('Acesso negado: apenas administradores')
  }
  return ctx
}
```

**Step 2: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat: add centralized Clerk auth helpers"
```

---

## Task 4: Replace Supabase Server Client Factory

**Files:**
- Replace: `src/lib/supabase/server.ts`
- Delete: `src/lib/supabase/client.ts`

**Step 1: Rewrite `src/lib/supabase/server.ts`**

Replace the entire file. The old version used `@supabase/ssr` with cookies. The new version gets a Clerk JWT token and passes it to the Supabase client.

```typescript
import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client authenticated with the current Clerk user's JWT.
 * The JWT comes from a Clerk JWT Template named 'supabase' that includes
 * restaurant_id and app_role claims for RLS.
 *
 * Use in Server Actions, Route Handlers, and Server Components.
 */
export async function createClerkSupabaseClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'supabase' })

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  )
}
```

**Step 2: Delete `src/lib/supabase/client.ts`**

This file is vestigial — unused browser client. Delete it.

**Step 3: Verify no other imports of old `createClient` from `@/lib/supabase/server`**

Search the codebase: every file that imports `createClient` from `@/lib/supabase/server` will need updating in later tasks. This is expected — we'll update them all.

**Step 4: Commit**

```bash
git add src/lib/supabase/server.ts
git rm src/lib/supabase/client.ts
git commit -m "feat: replace Supabase server client with Clerk JWT-based client"
```

---

## Task 5: Rewrite Middleware

**Files:**
- Replace: `src/middleware.ts`
- Delete: `src/lib/supabase/middleware.ts`

**Step 1: Rewrite `src/middleware.ts`**

The old middleware delegated to `updateSession()` in `src/lib/supabase/middleware.ts` which handled Supabase cookie refresh, dashboard route protection, and slug resolution. The new middleware uses `clerkMiddleware` for auth and keeps the slug resolution logic inline.

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Route matchers
// ---------------------------------------------------------------------------

const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/onboarding(.*)',
  '/api/webhooks/clerk(.*)',
  '/not-found',
])

// ---------------------------------------------------------------------------
// Slug cache (same as before — in-memory with 5-minute TTL)
// ---------------------------------------------------------------------------

const slugCache = new Map<string, { restaurantId: string; name: string; cachedAt: number }>()
const CACHE_TTL_MS = 300_000

function isTenantRoute(pathname: string): boolean {
  const NON_TENANT_PREFIXES = ['/dashboard', '/login', '/signup', '/onboarding', '/api', '/_next', '/not-found']
  const STATIC_EXT_RE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$/i

  if (STATIC_EXT_RE.test(pathname)) return false
  if (pathname === '/') return false

  for (const prefix of NON_TENANT_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return false
  }

  return /^\/[^/]+/.test(pathname)
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export default clerkMiddleware(async (auth, request) => {
  const startTime = Date.now()
  const { pathname } = request.nextUrl
  log.info('middleware.request', { pathname, method: request.method })

  // 1. Protect non-public routes
  if (!isPublicRoute(request) && !isTenantRoute(pathname)) {
    await auth.protect()
  }

  // 2. Dashboard route protection — role-based redirects
  if (pathname.startsWith('/dashboard')) {
    const { userId, sessionClaims } = await auth.protect()
    const metadata = (sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>
    const role = metadata.app_role as string | undefined

    // Bare /dashboard — redirect to role-appropriate sub-route
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      let destination = '/login'
      if (role === 'owner') destination = '/dashboard/owner'
      else if (role === 'manager') destination = '/dashboard/manager'
      else if (role === 'admin') destination = '/dashboard/admin'

      log.info('middleware.auth_redirect', { user_id: userId, role, destination })
      return NextResponse.redirect(new URL(destination, request.url))
    }

    // Owner dashboard — block non-owners
    if (pathname.startsWith('/dashboard/owner') && role !== 'owner') {
      log.warn('middleware.auth_redirect', { user_id: userId, role, destination: '/login', reason: 'not_owner' })
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Manager dashboard — block non-managers (owners can also access)
    if (pathname.startsWith('/dashboard/manager') && role !== 'manager' && role !== 'owner') {
      log.warn('middleware.auth_redirect', { user_id: userId, role, destination: '/login', reason: 'not_manager' })
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Admin dashboard — block non-admins
    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      log.warn('middleware.auth_redirect', { user_id: userId, role, destination: '/login', reason: 'not_admin' })
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // 3. Tenant slug resolution (public routes like /:slug/register)
  if (isTenantRoute(pathname)) {
    const slug = pathname.split('/')[1]

    const cached = slugCache.get(slug)
    if (cached && Date.now() - cached.cachedAt <= CACHE_TTL_MS) {
      log.info('middleware.slug_resolved', { slug, restaurant_id: cached.restaurantId, cache_hit: true })
      const response = NextResponse.next()
      response.headers.set('x-restaurant-id', cached.restaurantId)
      response.headers.set('x-restaurant-name', cached.name)
      log.info('middleware.completed', { pathname, duration_ms: Date.now() - startTime })
      return response
    }

    slugCache.delete(slug)

    // Service-role lookup (bypasses RLS)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    )

    const { data: restaurant, error } = await serviceClient
      .from('restaurants')
      .select('id, name')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (error || !restaurant) {
      return NextResponse.rewrite(new URL('/not-found', request.url))
    }

    slugCache.set(slug, { restaurantId: restaurant.id, name: restaurant.name, cachedAt: Date.now() })
    log.info('middleware.slug_resolved', { slug, restaurant_id: restaurant.id, cache_hit: false })

    const response = NextResponse.next()
    response.headers.set('x-restaurant-id', restaurant.id)
    response.headers.set('x-restaurant-name', restaurant.name)
    log.info('middleware.completed', { pathname, duration_ms: Date.now() - startTime })
    return response
  }

  log.info('middleware.completed', { pathname, duration_ms: Date.now() - startTime })
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

**Step 2: Delete `src/lib/supabase/middleware.ts`**

All its logic has been moved into `src/middleware.ts`.

**Step 3: Commit**

```bash
git add src/middleware.ts
git rm src/lib/supabase/middleware.ts
git commit -m "feat: rewrite middleware with clerkMiddleware, remove Supabase middleware"
```

---

## Task 6: Wrap Root Layout with ClerkProvider

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Add ClerkProvider wrapper**

Current file at `src/app/layout.tsx:15-25`. Add the `ClerkProvider` import and wrap `<body>` children.

```typescript
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
})

export const metadata: Metadata = {
  title: 'Revisit',
  description: 'Loyalty card app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={geist.variable}>
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wrap root layout with ClerkProvider"
```

---

## Task 7: Replace Auth Pages (Login + Signup)

**Files:**
- Replace: `src/app/(auth)/login/page.tsx`
- Replace: `src/app/(auth)/signup/page.tsx`

**Step 1: Replace login page with Clerk `<SignIn />`**

Replace entire `src/app/(auth)/login/page.tsx`:

```typescript
import { SignIn } from '@clerk/nextjs'

export default function LoginPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <SignIn />
    </div>
  )
}
```

**Step 2: Replace signup page with Clerk `<SignUp />`**

Replace entire `src/app/(auth)/signup/page.tsx`:

```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignupPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <SignUp />
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/app/(auth)/login/page.tsx src/app/(auth)/signup/page.tsx
git commit -m "feat: replace login/signup pages with Clerk components"
```

---

## Task 8: Create Onboarding Page

**Files:**
- Create: `src/app/(auth)/onboarding/page.tsx`

**Step 1: Write the onboarding page**

After Clerk signup, users land here to provide their restaurant name. This page calls a server action that creates the restaurant and sets Clerk publicMetadata.

```typescript
'use client'

import { useActionState } from 'react'
import { completeOnboarding } from '@/lib/actions/auth'

export default function OnboardingPage() {
  const [state, action, pending] = useActionState(completeOnboarding, undefined)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
          Bem-vindo ao Revisit!
        </h1>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          Para começar, informe o nome do seu restaurante.
        </p>

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="restaurantName" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
              Nome do Restaurante
            </label>
            <input
              id="restaurantName"
              name="restaurantName"
              type="text"
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {state?.errors?.restaurantName && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {state.errors.restaurantName[0]}
              </p>
            )}
          </div>

          {state?.message && (
            <p role="alert" style={{ color: '#dc2626', fontSize: '0.875rem' }}>
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.6 : 1,
              fontWeight: '500',
            }}
          >
            {pending ? 'Configurando...' : 'Começar'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(auth)/onboarding/page.tsx
git commit -m "feat: add post-signup onboarding page"
```

---

## Task 9: Rewrite Auth Actions

**Files:**
- Replace: `src/lib/actions/auth.ts`

**Step 1: Rewrite `src/lib/actions/auth.ts`**

The old file had `signup` (Supabase signUp + restaurant creation), `login` (signInWithPassword + jwtDecode), and `logout` (signOut). The new file has:
- `completeOnboarding` — creates restaurant + sets Clerk publicMetadata (replaces signup)
- `logout` — uses Clerk's signOut

Login is handled entirely by Clerk's `<SignIn />` component — no server action needed.

```typescript
'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import slugify from 'slugify'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingState =
  | {
      errors?: {
        restaurantName?: string[]
      }
      message?: string
    }
  | undefined

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const OnboardingSchema = z.object({
  restaurantName: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .trim(),
})

// ---------------------------------------------------------------------------
// completeOnboarding — creates restaurant + sets Clerk publicMetadata
// ---------------------------------------------------------------------------

export async function completeOnboarding(
  prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const { userId } = await auth()

  if (!userId) {
    return { message: 'Não autenticado' }
  }

  // 1. Validate inputs
  const validated = OnboardingSchema.safeParse({
    restaurantName: formData.get('restaurantName'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { restaurantName } = validated.data

  // 2. Create restaurant via service client (bypasses RLS)
  const serviceClient = createServiceClient()

  let slug = slugify(restaurantName, { lower: true, strict: true })

  const { data: restaurant, error: restaurantError } = await serviceClient
    .from('restaurants')
    .insert({ name: restaurantName, slug, program_name: restaurantName })
    .select('id')
    .single()

  if (restaurantError) {
    // Handle slug collision (Postgres unique violation code: 23505)
    if (restaurantError.code === '23505') {
      const suffix = Math.random().toString(36).substring(2, 6)
      slug = `${slug}-${suffix}`

      const { data: restaurantRetry, error: retryError } = await serviceClient
        .from('restaurants')
        .insert({ name: restaurantName, slug, program_name: restaurantName })
        .select('id')
        .single()

      if (retryError || !restaurantRetry) {
        log.error('auth.onboarding_failed', { user_id: userId, error: retryError?.message ?? 'retry_failed' })
        return { message: 'Erro ao criar restaurante. Tente outro nome.' }
      }

      // Create staff row
      const { error: staffError } = await serviceClient
        .from('restaurant_staff')
        .insert({ restaurant_id: restaurantRetry.id, user_id: userId, role: 'owner' })

      if (staffError) {
        await serviceClient.from('restaurants').delete().eq('id', restaurantRetry.id)
        log.error('auth.onboarding_failed', { user_id: userId, error: staffError.message })
        return { message: 'Erro ao configurar acesso. Tente novamente.' }
      }

      // Set Clerk publicMetadata
      const clerk = await clerkClient()
      await clerk.users.updateUser(userId, {
        publicMetadata: { restaurant_id: restaurantRetry.id, app_role: 'owner' },
      })

      log.info('auth.onboarding_completed', { user_id: userId, restaurant_id: restaurantRetry.id, slug })
      redirect('/dashboard/owner')
    }

    log.error('auth.onboarding_failed', { user_id: userId, error: restaurantError.message })
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  if (!restaurant) {
    log.error('auth.onboarding_failed', { user_id: userId, error: 'restaurant_insert_null' })
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  // 3. Create restaurant_staff row
  const { error: staffError } = await serviceClient
    .from('restaurant_staff')
    .insert({ restaurant_id: restaurant.id, user_id: userId, role: 'owner' })

  if (staffError) {
    await serviceClient.from('restaurants').delete().eq('id', restaurant.id)
    log.error('auth.onboarding_failed', { user_id: userId, error: staffError.message })
    return { message: 'Erro ao configurar acesso. Tente novamente.' }
  }

  // 4. Set Clerk publicMetadata so JWT Template includes restaurant_id + app_role
  const clerk = await clerkClient()
  await clerk.users.updateUser(userId, {
    publicMetadata: { restaurant_id: restaurant.id, app_role: 'owner' },
  })

  log.info('auth.onboarding_completed', { user_id: userId, restaurant_id: restaurant.id, slug })
  redirect('/dashboard/owner')
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout() {
  const { userId } = await auth()
  log.info('auth.logout', { user_id: userId })
  // Clerk handles actual session invalidation client-side via <SignOutButton>
  // This server action just logs and redirects
  redirect('/login')
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/auth.ts
git commit -m "feat: rewrite auth actions for Clerk (onboarding + logout)"
```

---

## Task 10: Create Clerk Webhook Handler

**Files:**
- Create: `src/app/api/webhooks/clerk/route.ts`

**Step 1: Write the webhook handler**

Handles `user.created` events — when a manager accepts an invitation, the webhook creates the `restaurant_staff` row.

```typescript
import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { log } from '@/lib/logger'

export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    log.error('webhook.clerk_missing_secret', {})
    return new Response('Webhook secret not configured', { status: 500 })
  }

  // Verify webhook signature
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await request.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    log.error('webhook.clerk_verification_failed', { error: (err as Error).message })
    return new Response('Webhook verification failed', { status: 400 })
  }

  // Handle user.created — insert restaurant_staff for invited managers
  if (event.type === 'user.created') {
    const { id: userId, public_metadata } = event.data
    const metadata = public_metadata as Record<string, unknown> | undefined
    const restaurantId = metadata?.restaurant_id as string | undefined
    const appRole = metadata?.app_role as string | undefined

    if (restaurantId && appRole === 'manager') {
      const serviceClient = createServiceClient()

      const { error } = await serviceClient
        .from('restaurant_staff')
        .insert({ restaurant_id: restaurantId, user_id: userId, role: 'manager' })

      if (error) {
        log.error('webhook.staff_creation_failed', { user_id: userId, restaurant_id: restaurantId, error: error.message })
        return new Response('Failed to create staff record', { status: 500 })
      }

      log.info('webhook.manager_created', { user_id: userId, restaurant_id: restaurantId })
    } else {
      log.info('webhook.user_created_no_staff', { user_id: userId, has_restaurant: !!restaurantId })
    }
  }

  return new Response('OK', { status: 200 })
}
```

**Step 2: Install svix for webhook verification**

Run: `npm install svix`

**Step 3: Commit**

```bash
git add src/app/api/webhooks/clerk/route.ts package.json package-lock.json
git commit -m "feat: add Clerk webhook handler for manager invitation flow"
```

---

## Task 11: Update POS Actions

**Files:**
- Modify: `src/lib/actions/pos.ts`

**Step 1: Replace the auth pattern**

Replace lines 1-106 (imports + types + `getAuthenticatedManager` helper). The rest of the file stays the same — only the auth helper and its callers change.

Remove these imports:
- `import { createClient } from '@/lib/supabase/server'`
- `import { jwtDecode } from 'jwt-decode'`

Remove the `RevisitClaims` interface (lines 13-18).

Add these imports:
- `import { requireManager } from '@/lib/auth'`
- `import { createClerkSupabaseClient } from '@/lib/supabase/server'`

Replace `getAuthenticatedManager()` (lines 50-106) with:

```typescript
async function getAuthenticatedManager() {
  try {
    const ctx = await requireManager()
    const supabase = await createClerkSupabaseClient()

    // Resolve staff ID from restaurant_staff table
    const { data: staffRow, error: staffError } = await supabase
      .from('active_restaurant_staff')
      .select('id')
      .eq('user_id', ctx.userId)
      .single()

    if (staffError || !staffRow) {
      return { error: 'Funcionário não encontrado. Entre em contato com o proprietário.' }
    }

    return {
      supabase,
      restaurantId: ctx.restaurantId,
      staffId: staffRow.id,
      userId: ctx.userId,
    }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
```

The return type stays identical, so `lookupCustomer` and `registerSale` need no changes.

**Step 2: Commit**

```bash
git add src/lib/actions/pos.ts
git commit -m "refactor: migrate POS actions to Clerk auth"
```

---

## Task 12: Update Rewards Actions

**Files:**
- Modify: `src/lib/actions/rewards.ts`

**Step 1: Replace the auth pattern**

Remove these imports:
- `import { createClient } from '@/lib/supabase/server'`
- `import { jwtDecode } from 'jwt-decode'`

Remove the `RevisitClaims` interface (lines 11-16).

Add these imports:
- `import { requireManager } from '@/lib/auth'`
- `import { createClerkSupabaseClient } from '@/lib/supabase/server'`

Replace `getAuthenticatedManager()` (lines 40-82) with:

```typescript
async function getAuthenticatedManager() {
  try {
    const ctx = await requireManager()
    const supabase = await createClerkSupabaseClient()
    return {
      userId: ctx.userId,
      restaurantId: ctx.restaurantId,
      supabase,
    }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
```

**Important:** `checkRewardAvailability` (line 88) creates its own supabase client for read-only checks without auth. This currently uses `createClient()` from `@/lib/supabase/server`. Change this to `createClerkSupabaseClient()`:

Find: `const supabase = await createClient()` inside `checkRewardAvailability`
Replace with: `const supabase = await createClerkSupabaseClient()`

**Note:** `checkRewardAvailability` receives `cardNumber` and `restaurantId` as params and does read-only queries. It doesn't use the manager helper. But we still need a valid Supabase client. Since this is called from client context where the user is authenticated, `createClerkSupabaseClient()` works.

**Step 2: Commit**

```bash
git add src/lib/actions/rewards.ts
git commit -m "refactor: migrate rewards actions to Clerk auth"
```

---

## Task 13: Update Restaurant Actions

**Files:**
- Modify: `src/lib/actions/restaurant.ts`

**Step 1: Replace the auth pattern**

Remove these imports:
- `import { createClient } from '@/lib/supabase/server'`
- `import { jwtDecode } from 'jwt-decode'`

Remove the `RevisitClaims` interface (lines 13-18).

Add these imports:
- `import { requireOwner } from '@/lib/auth'`
- `import { createClerkSupabaseClient } from '@/lib/supabase/server'`

Replace `getAuthenticatedOwner()` (lines 103-140) with:

```typescript
async function getAuthenticatedOwner() {
  try {
    const ctx = await requireOwner()
    const supabase = await createClerkSupabaseClient()
    return {
      userId: ctx.userId,
      restaurantId: ctx.restaurantId,
      supabase,
    }
  } catch (err) {
    return { error: (err as Error).message }
  }
}
```

The return type stays identical, so all five action functions (`updateBranding`, `uploadLogo`, `updateRanks`, `saveCardImage`, `removeCardImage`) need no changes.

**Step 2: Commit**

```bash
git add src/lib/actions/restaurant.ts
git commit -m "refactor: migrate restaurant actions to Clerk auth"
```

---

## Task 14: Update Staff API Route (with Clerk Invitations)

**Files:**
- Modify: `src/app/api/staff/route.ts`

**Step 1: Rewrite the entire file**

Major changes:
- Auth: `verifyOwner()` → `requireOwner()` from `@/lib/auth`
- POST: Replace `serviceClient.auth.admin.createUser()` with Clerk Invitations API
- GET: Replace `serviceClient.auth.admin.getUserById()` with Clerk user lookup
- Schema: Remove `password` field — managers set their own password via Clerk

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireOwner } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const InviteManagerSchema = z.object({
  email: z.string().email('Email inválido').trim(),
})

// ---------------------------------------------------------------------------
// POST /api/staff — invite a manager via Clerk Invitations
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let owner
  try {
    owner = await requireOwner()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const validated = InviteManagerSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validated.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email } = validated.data

  try {
    const clerk = await clerkClient()
    await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        restaurant_id: owner.restaurantId,
        app_role: 'manager',
      },
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/signup`,
    })

    log.info('staff.invited', { restaurant_id: owner.restaurantId, user_id: owner.userId, invited_email: email })
    return NextResponse.json({ success: true, email }, { status: 201 })
  } catch (err) {
    const message = (err as Error).message
    log.error('staff.invitation_failed', { restaurant_id: owner.restaurantId, error: message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/staff — list managers for the authenticated owner's restaurant
// ---------------------------------------------------------------------------

export async function GET() {
  let owner
  try {
    owner = await requireOwner()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 })
  }

  const serviceClient = createServiceClient()

  const { data: staff, error } = await serviceClient
    .from('restaurant_staff')
    .select('id, user_id, role, created_at')
    .eq('restaurant_id', owner.restaurantId)
    .eq('role', 'manager')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar gerentes' }, { status: 500 })
  }

  // Enrich with emails from Clerk
  const clerk = await clerkClient()
  const enriched = await Promise.all(
    (staff ?? []).map(async (s) => {
      try {
        const user = await clerk.users.getUser(s.user_id)
        return { ...s, email: user.emailAddresses[0]?.emailAddress ?? null }
      } catch {
        return { ...s, email: null }
      }
    })
  )

  log.info('staff.listed', { restaurant_id: owner.restaurantId, user_id: owner.userId, count: enriched.length })
  return NextResponse.json({ staff: enriched })
}
```

**Step 2: Commit**

```bash
git add src/app/api/staff/route.ts
git commit -m "feat: migrate staff API to Clerk invitations, replace Supabase admin API"
```

---

## Task 15: Update Generate-Card API Route

**Files:**
- Modify: `src/app/api/generate-card/route.ts`

**Step 1: Replace auth pattern**

Remove these imports:
- `import { createClient } from '@/lib/supabase/server'`
- `import { jwtDecode } from 'jwt-decode'`

Remove the `RevisitClaims` interface (lines 7-12).

Add:
- `import { requireOwner } from '@/lib/auth'`

Replace lines 14-38 (the auth check block) with:

```typescript
export async function POST(request: Request) {
  let owner
  try {
    owner = await requireOwner()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 })
  }
```

Then replace all references:
- `claims.restaurant_id` → `owner.restaurantId`
- `user.id` → `owner.userId`

The rest of the file (OpenAI DALL-E call) stays the same.

**Step 2: Commit**

```bash
git add src/app/api/generate-card/route.ts
git commit -m "refactor: migrate generate-card API to Clerk auth"
```

---

## Task 16: Update Dashboard Layouts

**Files:**
- Modify: `src/app/dashboard/owner/layout.tsx`
- Modify: `src/app/dashboard/admin/layout.tsx`
- Modify: `src/app/dashboard/manager/layout.tsx`

**Step 1: Rewrite owner layout auth check**

File: `src/app/dashboard/owner/layout.tsx`

Remove these imports:
- `import { createClient } from '@/lib/supabase/server'`
- `import { jwtDecode } from 'jwt-decode'`

Remove the `RevisitClaims` interface (lines 7-12).

Add:
- `import { requireOwner } from '@/lib/auth'`

Replace lines 28-50 (the auth block inside the component) with:

```typescript
  try {
    await requireOwner()
  } catch {
    redirect('/login')
  }
```

Keep the `logout` import — it's still used in the sidebar form.

**Step 2: Rewrite admin layout auth check**

File: `src/app/dashboard/admin/layout.tsx`

Same pattern. Remove `createClient`, `jwtDecode`, `RevisitClaims`. Add `requireAdmin` from `@/lib/auth`.

Replace lines 25-47 with:

```typescript
  try {
    await requireAdmin()
  } catch {
    redirect('/login')
  }
```

**Step 3: Rewrite manager layout auth check**

File: `src/app/dashboard/manager/layout.tsx`

Same pattern. Remove `createClient`, `jwtDecode`, `RevisitClaims`. Add `getRevisitAuth` from `@/lib/auth`.

Replace lines 23-45 with:

```typescript
  try {
    const ctx = await getRevisitAuth()
    if (ctx.role !== 'manager') {
      redirect('/login')
    }
  } catch {
    redirect('/login')
  }
```

**Step 4: Commit**

```bash
git add src/app/dashboard/owner/layout.tsx src/app/dashboard/admin/layout.tsx src/app/dashboard/manager/layout.tsx
git commit -m "refactor: migrate all dashboard layouts to Clerk auth"
```

---

## Task 17: Update Customer Actions (Minor)

**Files:**
- Modify: `src/lib/actions/customer.ts`

**Step 1: Check imports**

`customer.ts` does NOT use Supabase auth — it reads `x-restaurant-id` from middleware headers and uses `createServiceClient()`. No `createClient`, no `jwtDecode`, no `RevisitClaims`.

**Verify:** No changes needed. The service client import is from `@/lib/supabase/service` which is unchanged.

**Step 2: Skip — no commit needed**

---

## Task 18: Create Migration to Drop Auth Hook

**Files:**
- Create: `supabase/migrations/0011_drop_auth_hook.sql`

**Step 1: Write migration**

```sql
-- Drop the custom access token hook since Clerk now handles JWT claims.
-- The hook was used to inject app_role and restaurant_id into Supabase JWTs.
-- With Clerk, these claims come from the JWT Template instead.

DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);

-- Remove the hook from Supabase config (must be done via Dashboard or CLI)
-- ALTER DATABASE postgres RESET pgrst.db_extra_search_path;
-- Note: The actual hook removal from auth.hooks must be done via the Supabase Dashboard.
```

**Step 2: Commit**

```bash
git add supabase/migrations/0011_drop_auth_hook.sql
git commit -m "chore: add migration to drop Supabase custom_access_token_hook"
```

---

## Task 19: Update Logout in Dashboard Sidebars

**Files:**
- Modify: `src/app/dashboard/owner/layout.tsx`
- Modify: `src/app/dashboard/admin/layout.tsx`
- Modify: `src/app/dashboard/manager/layout.tsx`

**Step 1: Replace logout form with Clerk SignOutButton**

In all three layout files, the logout button currently uses a `<form action={logout}>` pattern. Replace with Clerk's `<SignOutButton>`:

Remove: `import { logout } from '@/lib/actions/auth'`
Add: `import { SignOutButton } from '@clerk/nextjs'`

Replace the logout form in each file:

```tsx
<div className="mt-auto">
  <SignOutButton redirectUrl="/login">
    <button
      type="button"
      className="w-full rounded-lg border border-db-border px-3 py-2 text-left text-sm text-db-text-muted transition-colors hover:text-db-text-secondary hover:bg-white/[0.03] cursor-pointer"
    >
      Sair
    </button>
  </SignOutButton>
</div>
```

**Important:** `<SignOutButton>` is a client component. The layouts are server components. This works because Clerk's `<SignOutButton>` renders as a client component within a server component — Next.js supports this pattern natively.

**Step 2: Commit**

```bash
git add src/app/dashboard/owner/layout.tsx src/app/dashboard/admin/layout.tsx src/app/dashboard/manager/layout.tsx
git commit -m "refactor: replace logout form with Clerk SignOutButton"
```

---

## Task 20: Clean Up Unused Code

**Files:**
- Verify: no remaining imports of `@supabase/ssr`, `jwt-decode`, or old `createClient` from server

**Step 1: Search for dead imports**

Run:
```bash
grep -rn "from '@supabase/ssr'" src/
grep -rn "from 'jwt-decode'" src/
grep -rn "supabase.auth.getUser\|supabase.auth.getSession\|supabase.auth.signUp\|supabase.auth.signInWithPassword\|supabase.auth.signOut" src/
```

Expected: No matches. If any remain, fix them.

**Step 2: Verify the `logout` server action in `src/lib/actions/auth.ts`**

The `logout` export may still be imported somewhere besides the dashboard layouts. If all layouts now use `<SignOutButton>`, the `logout` function may be dead code. Keep it for now — it's used as a fallback.

**Step 3: Commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore: remove dead Supabase auth imports"
```

---

## Task 21: Build Verification

**Step 1: Run the build**

Run: `npm run build`
Expected: Compiles successfully with no errors.

**Step 2: Fix any build errors**

Common issues:
- Missing imports (search for the broken file, fix the import)
- Type mismatches (update types to match new auth helpers)
- Unused variables from removed auth code

**Step 3: Commit fixes (if needed)**

```bash
git add -A
git commit -m "fix: resolve build errors from Clerk migration"
```

---

## Task 22: Manual Verification Checklist

These steps require the Clerk Dashboard to be configured. Run the dev server with `npm run dev`.

1. **Clerk Dashboard Setup:**
   - Create JWT Template named `supabase` with claims from design doc
   - Set Supabase JWT secret to Clerk signing key
   - Create webhook endpoint pointing to `https://your-domain/api/webhooks/clerk`
   - Add `CLERK_WEBHOOK_SECRET` to `.env.local`

2. **Signup flow:**
   - Visit `/signup` → Clerk signup form appears
   - Sign up → redirects to `/onboarding`
   - Enter restaurant name → creates restaurant → redirects to `/dashboard/owner`

3. **Login flow:**
   - Visit `/login` → Clerk signin form appears
   - Sign in as owner → redirects to `/dashboard/owner`
   - Sign in as admin → redirects to `/dashboard/admin`

4. **Manager invitation:**
   - Owner → Team page → Invite manager with email
   - Manager receives Clerk invitation email
   - Manager signs up → webhook creates restaurant_staff row
   - Manager signs in → redirects to `/dashboard/manager`

5. **Route protection:**
   - Unauthenticated user → `/dashboard/owner` → redirects to `/login`
   - Manager → `/dashboard/owner` → redirects to `/login`
   - Owner → `/dashboard/admin` → redirects to `/login`

6. **RLS still works:**
   - Owner can only see their restaurant's data
   - Admin can see all data (via service client)
   - Tenant routes (/:slug/register) still resolve correctly

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install Clerk, remove Supabase auth packages | `package.json` |
| 2 | Add Clerk env vars | `.env.local.example` |
| 3 | Create centralized auth helpers | `src/lib/auth.ts` |
| 4 | Replace Supabase server client | `src/lib/supabase/server.ts`, delete `client.ts` |
| 5 | Rewrite middleware | `src/middleware.ts`, delete `supabase/middleware.ts` |
| 6 | Wrap layout with ClerkProvider | `src/app/layout.tsx` |
| 7 | Replace auth pages | `login/page.tsx`, `signup/page.tsx` |
| 8 | Create onboarding page | `onboarding/page.tsx` |
| 9 | Rewrite auth actions | `src/lib/actions/auth.ts` |
| 10 | Create webhook handler | `api/webhooks/clerk/route.ts` |
| 11 | Update POS actions | `src/lib/actions/pos.ts` |
| 12 | Update rewards actions | `src/lib/actions/rewards.ts` |
| 13 | Update restaurant actions | `src/lib/actions/restaurant.ts` |
| 14 | Update staff API (Clerk Invitations) | `src/app/api/staff/route.ts` |
| 15 | Update generate-card API | `src/app/api/generate-card/route.ts` |
| 16 | Update dashboard layouts | 3 layout files |
| 17 | Verify customer actions (no change) | — |
| 18 | Migration to drop auth hook | `0011_drop_auth_hook.sql` |
| 19 | Replace logout with SignOutButton | 3 layout files |
| 20 | Clean up dead imports | various |
| 21 | Build verification | — |
| 22 | Manual verification | — |
