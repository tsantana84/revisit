'use server'

import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

export type RewardInfo =
  | { type: 'cashback'; availableCredit: number; pointsBalance: number; earnRate: number }
  | {
      type: 'free_product'
      available: boolean
      rewardName: string
      rewardId: string
      pointsRequired: number
      pointsBalance: number
    }
  | { type: 'progressive_discount'; discountPct: number; rankName: string }
  | { type: 'none' }

export type RedemptionState =
  | { step: 'success'; message: string; newBalance: number }
  | { step: 'error'; message: string }
  | undefined

// ---------------------------------------------------------------------------
// Helper: get authenticated manager (or owner) context
// ---------------------------------------------------------------------------

async function getAuthenticatedManager(): Promise<
  | {
      userId: string
      restaurantId: string
      supabase: Awaited<ReturnType<typeof createClient>>
    }
  | { error: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { error: 'Não autenticado' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { error: 'Sessão inválida' }
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)

  if (claims.app_role !== 'manager' && claims.app_role !== 'owner') {
    return { error: 'Acesso negado' }
  }

  if (!claims.restaurant_id) {
    return { error: 'Restaurante não encontrado no token' }
  }

  return {
    userId: user.id,
    restaurantId: claims.restaurant_id,
    supabase,
  }
}

// ---------------------------------------------------------------------------
// checkRewardAvailability — branches on restaurant reward_type
// ---------------------------------------------------------------------------

export async function checkRewardAvailability(
  cardNumber: string,
  restaurantId: string
): Promise<RewardInfo> {
  const supabase = await createClient()

  // 1. Get restaurant reward_type and earn_rate
  const { data: restaurant, error: restError } = await supabase
    .from('active_restaurants')
    .select('reward_type, earn_rate')
    .eq('id', restaurantId)
    .single()

  if (restError || !restaurant) {
    return { type: 'none' }
  }

  const rewardType = restaurant.reward_type as string
  const earnRate = restaurant.earn_rate as number

  // 2. Get customer by card_number
  const { data: customer, error: custError } = await supabase
    .from('active_customers')
    .select('id, points_balance, current_rank_id')
    .eq('card_number', cardNumber)
    .eq('restaurant_id', restaurantId)
    .single()

  if (custError || !customer) {
    return { type: 'none' }
  }

  const pointsBalance = customer.points_balance as number

  // 3. Branch on reward_type
  if (rewardType === 'cashback') {
    const availableCredit = Math.floor(pointsBalance / earnRate)
    return { type: 'cashback', availableCredit, pointsBalance, earnRate }
  }

  if (rewardType === 'free_product') {
    // Find first active reward config where customer has enough points
    const { data: configs } = await supabase
      .from('active_reward_configs')
      .select('id, name, points_required')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('points_required', { ascending: true })

    if (configs && configs.length > 0) {
      const qualifying = configs.find(
        (c) => pointsBalance >= (c.points_required as number)
      )
      if (qualifying) {
        return {
          type: 'free_product',
          available: true,
          rewardName: qualifying.name as string,
          rewardId: qualifying.id as string,
          pointsRequired: qualifying.points_required as number,
          pointsBalance,
        }
      }
    }

    return {
      type: 'free_product',
      available: false,
      rewardName: '',
      rewardId: '',
      pointsRequired: 0,
      pointsBalance,
    }
  }

  if (rewardType === 'progressive_discount') {
    if (customer.current_rank_id) {
      const { data: rank } = await supabase
        .from('active_ranks')
        .select('name, discount_pct')
        .eq('id', customer.current_rank_id)
        .single()

      if (rank) {
        return {
          type: 'progressive_discount',
          discountPct: (rank.discount_pct as number) ?? 0,
          rankName: (rank.name as string) ?? 'Sem nível',
        }
      }
    }

    return { type: 'progressive_discount', discountPct: 0, rankName: 'Sem nível' }
  }

  return { type: 'none' }
}

// ---------------------------------------------------------------------------
// registerRedemption — Server Action (useActionState)
// ---------------------------------------------------------------------------

export async function registerRedemption(
  prevState: RedemptionState,
  formData: FormData
): Promise<RedemptionState> {
  const cardNumber = formData.get('card_number') as string | null
  const rewardConfigId = formData.get('reward_config_id') as string | null
  const rewardType = formData.get('reward_type') as string | null

  if (!cardNumber || !rewardType) {
    return { step: 'error', message: 'Dados de resgate ausentes' }
  }

  const auth = await getAuthenticatedManager()
  if ('error' in auth) {
    return { step: 'error', message: auth.error }
  }

  const { supabase, restaurantId } = auth

  // For cashback and free_product: use the register_redemption RPC (atomic, deducts points)
  if (rewardType === 'cashback' || rewardType === 'free_product') {
    if (!rewardConfigId) {
      return { step: 'error', message: 'Configuração de recompensa não encontrada' }
    }

    const { data, error } = await supabase.rpc('register_redemption', {
      p_card_number: cardNumber,
      p_reward_config_id: rewardConfigId,
    })

    if (error) {
      return { step: 'error', message: `Erro ao registrar resgate: ${error.message}` }
    }

    const result = data as { success?: boolean; error?: string; new_balance?: number }

    if (!result.success) {
      const errorMessages: Record<string, string> = {
        not_authenticated: 'Não autenticado',
        customer_not_found: 'Cliente não encontrado',
        reward_not_found: 'Recompensa não encontrada',
        insufficient_points: 'Pontos insuficientes para resgate',
      }
      const msg = result.error
        ? (errorMessages[result.error] ?? result.error)
        : 'Erro ao registrar resgate'
      return { step: 'error', message: msg }
    }

    return {
      step: 'success',
      message: 'Resgate registrado com sucesso',
      newBalance: result.new_balance ?? 0,
    }
  }

  // Progressive discount: audit record without deducting points
  if (rewardType === 'progressive_discount') {
    // Lookup customer for their current balance and IDs
    const { data: customer, error: custError } = await supabase
      .from('active_customers')
      .select('id, points_balance')
      .eq('card_number', cardNumber)
      .eq('restaurant_id', restaurantId)
      .single()

    if (custError || !customer) {
      return { step: 'error', message: 'Cliente não encontrado' }
    }

    // Find or use the provided reward_config_id for the audit record.
    // Progressive discount doesn't deduct points — we just record the redemption event.
    // We need a valid reward_config_id; if not provided, get the first active config.
    let configId = rewardConfigId
    if (!configId) {
      const { data: configs } = await supabase
        .from('active_reward_configs')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .limit(1)

      if (!configs || configs.length === 0) {
        return { step: 'error', message: 'Nenhuma configuração de recompensa encontrada' }
      }
      configId = configs[0].id as string
    }

    const customerId = customer.id as string
    const pointsBalance = customer.points_balance as number

    // Insert redemption audit record (points_spent = 0)
    const { error: redemptionError } = await supabase.from('reward_redemptions').insert({
      restaurant_id: restaurantId,
      customer_id: customerId,
      reward_config_id: configId,
      points_spent: 0,
    })

    if (redemptionError) {
      return { step: 'error', message: `Erro ao registrar resgate: ${redemptionError.message}` }
    }

    // Insert audit point_transaction with zero delta for ledger traceability
    const { error: txError } = await supabase.from('point_transactions').insert({
      restaurant_id: restaurantId,
      customer_id: customerId,
      points_delta: 0,
      balance_after: pointsBalance,
      transaction_type: 'redeem',
      note: 'Desconto progressivo aplicado',
    })

    if (txError) {
      return { step: 'error', message: `Erro ao registrar transação: ${txError.message}` }
    }

    return {
      step: 'success',
      message: 'Desconto aplicado e registrado com sucesso',
      newBalance: pointsBalance,
    }
  }

  return { step: 'error', message: 'Tipo de recompensa desconhecido' }
}

// ---------------------------------------------------------------------------
// checkRewardForCurrentManager — convenience wrapper for client components
// Resolves restaurantId from the current manager's JWT automatically.
// ---------------------------------------------------------------------------

export async function checkRewardForCurrentManager(cardNumber: string): Promise<RewardInfo> {
  const auth = await getAuthenticatedManager()
  if ('error' in auth) {
    return { type: 'none' }
  }
  return checkRewardAvailability(cardNumber, auth.restaurantId)
}
