import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { jwtDecode } from 'jwt-decode'
import { log } from '@/lib/logger'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager' | 'admin'
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
  const startTime = Date.now()
  const { pathname } = request.nextUrl
  log.info('middleware.request', { pathname, method: request.method })

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
      let destination = '/login'
      if (role === 'owner') destination = '/dashboard/owner'
      else if (role === 'manager') destination = '/dashboard/manager'
      else if (role === 'admin') destination = '/dashboard/admin'

      log.info('middleware.auth_redirect', { user_id: claims.sub, role, destination })
      return NextResponse.redirect(new URL(destination, request.url))
    }

    // Owner dashboard — block non-owners
    if (pathname.startsWith('/dashboard/owner') && role !== 'owner') {
      log.warn('middleware.auth_redirect', { user_id: claims.sub, role, destination: '/login', reason: 'not_owner' })
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Manager dashboard — block non-managers
    if (pathname.startsWith('/dashboard/manager') && role !== 'manager') {
      log.warn('middleware.auth_redirect', { user_id: claims.sub, role, destination: '/login', reason: 'not_manager' })
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Admin dashboard — block non-admins
    if (pathname.startsWith('/dashboard/admin') && role !== 'admin') {
      log.warn('middleware.auth_redirect', { user_id: claims.sub, role, destination: '/login', reason: 'not_admin' })
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
        log.info('middleware.slug_resolved', { slug, restaurant_id: cached.restaurantId, cache_hit: true })
        supabaseResponse.headers.set('x-restaurant-id', cached.restaurantId)
        supabaseResponse.headers.set('x-restaurant-name', cached.name)
        log.info('middleware.completed', { pathname, duration_ms: Date.now() - startTime })
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

    log.info('middleware.slug_resolved', { slug, restaurant_id: restaurant.id, cache_hit: false })

    // Inject tenant headers for Server Components
    supabaseResponse.headers.set('x-restaurant-id', restaurant.id)
    supabaseResponse.headers.set('x-restaurant-name', restaurant.name)
  }

  log.info('middleware.completed', { pathname, duration_ms: Date.now() - startTime })
  return supabaseResponse
}
