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
