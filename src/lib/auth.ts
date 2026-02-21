import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { log } from '@/lib/logger'

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
// Base helper — reads Clerk session claims, falls back to DB if stale
// ---------------------------------------------------------------------------

export async function getRevisitAuth(): Promise<RevisitAuth> {
  const { userId, sessionClaims } = await auth()

  if (!userId) {
    throw new Error('Não autenticado')
  }

  const metadata = (sessionClaims?.publicMetadata ?? {}) as Record<string, unknown>
  let role = metadata.app_role as AppRole | undefined
  let restaurantId = (metadata.restaurant_id as string) ?? null
  const email = (sessionClaims?.email as string) ?? ''

  // If session claims don't have role, check database as fallback.
  // This handles the case where Clerk metadata was just updated but
  // the session JWT hasn't refreshed yet (~60s cache).
  if (!role) {
    const serviceClient = createServiceClient()
    const { data: staff } = await serviceClient
      .from('restaurant_staff')
      .select('restaurant_id, role')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle()

    if (staff) {
      role = staff.role as AppRole
      restaurantId = staff.restaurant_id

      // Sync Clerk metadata so future requests use the fast path
      try {
        const clerk = await clerkClient()
        await clerk.users.updateUser(userId, {
          publicMetadata: { restaurant_id: restaurantId, app_role: role },
        })
      } catch (err) {
        log.error('auth.metadata_sync_failed', { user_id: userId, error: (err as Error).message })
      }
    }
  }

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
