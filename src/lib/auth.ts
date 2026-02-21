import { auth } from '@clerk/nextjs/server'

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
