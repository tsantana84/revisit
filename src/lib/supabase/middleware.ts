import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { jwtDecode } from 'jwt-decode'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

// ---------------------------------------------------------------------------
// Module-level slug cache (Edge Runtime compatible — no unstable_cache)
// Caches slug → { restaurantId, name } with 5-minute TTL
// ---------------------------------------------------------------------------
const slugCache = new Map<string, { restaurantId: string; name: string; cachedAt: number }>()

const CACHE_TTL_MS = 300_000 // 5 minutes

/**
 * Determines whether a given pathname is a tenant route.
 * Returns false for: /dashboard, /login, /api, /_next, /not-found,
 * and static file extensions (.svg, .png, .jpg, etc.)
 */
function isTenantRoute(pathname: string): boolean {
  const NON_TENANT_PREFIXES = [
    '/dashboard',
    '/login',
    '/signup',
    '/api',
    '/_next',
    '/not-found',
  ]

  // Static file extensions
  const STATIC_EXT_RE = /\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$/i

  if (STATIC_EXT_RE.test(pathname)) return false

  // Root path is not a tenant route
  if (pathname === '/') return false

  for (const prefix of NON_TENANT_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return false
  }

  // Must start with /{segment} — the segment is the tenant slug
  return /^\/[^/]+/.test(pathname)
}

/**
 * updateSession handles both Supabase auth token refresh and tenant slug resolution.
 *
 * For every request:
 * 1. Refreshes Supabase auth session cookies (calls auth.getUser())
 * 2. For tenant routes, resolves slug → restaurant_id via cached DB lookup
 * 3. Injects x-restaurant-id and x-restaurant-name headers for Server Components
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  // Start with a response that forwards the request
  let supabaseResponse = NextResponse.next({
    request,
  })

  // ---------------------------------------------------------------------------
  // 1. Auth token refresh — use getUser() NOT getSession() (verifies JWT server-side)
  // ---------------------------------------------------------------------------
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies to both request and response so they are forwarded
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not remove auth.getUser() — it refreshes the session cookie
  await supabase.auth.getUser()

  // ---------------------------------------------------------------------------
  // 2. Dashboard route protection — redirect based on auth + role
  // ---------------------------------------------------------------------------
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/dashboard')) {
    // getSession() is acceptable here: we're reading claims for routing only, not for data trust.
    // RLS + layout auth checks handle the actual security enforcement.
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const claims = jwtDecode<RevisitClaims>(session.access_token)
    const role = claims.app_role

    // Bare /dashboard — redirect to role-appropriate sub-route
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      if (role === 'owner') {
        return NextResponse.redirect(new URL('/dashboard/owner', request.url))
      } else if (role === 'manager') {
        return NextResponse.redirect(new URL('/dashboard/manager', request.url))
      } else {
        return NextResponse.redirect(new URL('/login', request.url))
      }
    }

    // Owner dashboard — block non-owners
    if (pathname.startsWith('/dashboard/owner') && role !== 'owner') {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Manager dashboard — block non-managers
    if (pathname.startsWith('/dashboard/manager') && role !== 'manager') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  if (isTenantRoute(pathname)) {
    const slug = pathname.split('/')[1] // Extract first path segment

    // Check in-memory cache (with TTL validation)
    const cached = slugCache.get(slug)
    if (cached) {
      if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
        // Cache is stale — evict and re-query
        slugCache.delete(slug)
      } else {
        // Cache hit — inject headers and return
        supabaseResponse.headers.set('x-restaurant-id', cached.restaurantId)
        supabaseResponse.headers.set('x-restaurant-name', cached.name)
        return supabaseResponse
      }
    }

    // Cache miss — look up restaurant using service role (bypasses RLS)
    const serviceClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // NOT prefixed NEXT_PUBLIC_ — server-only
      {
        cookies: {
          getAll() { return [] },
          setAll() { /* no-op for service role client */ },
        },
      }
    )

    const { data: restaurant, error } = await serviceClient
      .from('restaurants')
      .select('id, name')
      .eq('slug', slug)
      .is('deleted_at', null)
      .single()

    if (error || !restaurant) {
      // Unknown slug — rewrite to not-found page
      const notFoundUrl = new URL('/not-found', request.url)
      return NextResponse.rewrite(notFoundUrl)
    }

    // Store in cache
    slugCache.set(slug, {
      restaurantId: restaurant.id,
      name: restaurant.name,
      cachedAt: Date.now(),
    })

    // Inject tenant headers for Server Components
    supabaseResponse.headers.set('x-restaurant-id', restaurant.id)
    supabaseResponse.headers.set('x-restaurant-name', restaurant.name)
  }

  return supabaseResponse
}
