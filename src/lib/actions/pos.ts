'use server'

import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import { z } from 'zod'
import { validateCardNumber } from '@/lib/utils/card-number'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

export type LookupState =
  | {
      step: 'preview'
      customerName: string
      currentRank: string
      pointsBalance: number
      pointsPreview: number
      cardNumber: string
      amountCents: number
      staffId: string
    }
  | { step: 'error'; message: string }
  | undefined

export type SaleState =
  | {
      step: 'success'
      pointsEarned: number
      newBalance: number
      customerName: string
      rankPromoted: boolean
      newRankName: string
    }
  | { step: 'error'; message: string }
  | undefined

// ---------------------------------------------------------------------------
// Helper: get authenticated manager (or owner) context
// ---------------------------------------------------------------------------

async function getAuthenticatedManager(): Promise<
  | {
      supabase: Awaited<ReturnType<typeof createClient>>
      restaurantId: string
      staffId: string
      userId: string
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

  // Accept both manager and owner roles (owners can use POS for POC flexibility)
  if (claims.app_role !== 'manager' && claims.app_role !== 'owner') {
    return { error: 'Acesso negado: apenas gerentes e proprietários podem usar o PDV' }
  }

  if (!claims.restaurant_id) {
    return { error: 'Restaurante não encontrado no token' }
  }

  // Resolve staff ID from restaurant_staff table (not assumed from JWT sub)
  const { data: staffRow, error: staffError } = await supabase
    .from('active_restaurant_staff')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (staffError || !staffRow) {
    return { error: 'Funcionário não encontrado. Entre em contato com o proprietário.' }
  }

  return {
    supabase,
    restaurantId: claims.restaurant_id,
    staffId: staffRow.id,
    userId: user.id,
  }
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const RegisterSaleSchema = z.object({
  card_number: z.string().refine(validateCardNumber, { message: 'Formato de cartão inválido' }),
  amount_cents: z.coerce.number().int().min(1, 'Valor mínimo é R$0,01'),
  staff_id: z.string().uuid('ID de funcionário inválido'),
})

// ---------------------------------------------------------------------------
// lookupCustomer — read-only preview, no DB writes
// ---------------------------------------------------------------------------

export async function lookupCustomer(
  prevState: LookupState,
  formData: FormData
): Promise<LookupState> {
  // 1. Extract inputs
  const cardNumber = (formData.get('card_number') as string | null)?.trim() ?? ''
  const amountRaw = (formData.get('amount') as string | null)?.trim() ?? ''

  // 2. Validate card format
  if (!validateCardNumber(cardNumber)) {
    return { step: 'error', message: 'Formato de cartão inválido' }
  }

  // 3. Validate amount
  const amountFloat = parseFloat(amountRaw)
  if (isNaN(amountFloat) || amountFloat <= 0 || amountFloat > 99999.99) {
    return { step: 'error', message: 'Valor inválido. Informe um valor entre R$0,01 e R$99.999,99' }
  }

  // 4. Auth check
  const auth = await getAuthenticatedManager()
  if ('error' in auth) {
    return { step: 'error', message: auth.error }
  }

  const { supabase, restaurantId, staffId } = auth

  // 5. Convert amount to cents
  const amountCents = Math.round(amountFloat * 100)

  // 6. Look up customer
  const { data: customer, error: customerError } = await supabase
    .from('active_customers')
    .select('id, name, points_balance, visit_count, current_rank_id')
    .eq('card_number', cardNumber)
    .single()

  if (customerError || !customer) {
    return { step: 'error', message: 'Cartão não encontrado' }
  }

  // 7. Get rank details (multiplier)
  let multiplier = 1
  let currentRank = 'Sem nível'

  if (customer.current_rank_id) {
    const { data: rank } = await supabase
      .from('active_ranks')
      .select('name, multiplier')
      .eq('id', customer.current_rank_id)
      .single()

    if (rank) {
      multiplier = rank.multiplier
      currentRank = rank.name
    }
  }

  // 8. Get earn rate from restaurant
  const { data: restaurant } = await supabase
    .from('active_restaurants')
    .select('earn_rate')
    .eq('id', restaurantId)
    .single()

  const earnRate = restaurant?.earn_rate ?? 1

  // 9. Calculate points preview
  const pointsPreview = Math.round((amountCents / 100) * earnRate * multiplier)

  return {
    step: 'preview',
    customerName: customer.name,
    currentRank,
    pointsBalance: customer.points_balance,
    pointsPreview,
    cardNumber,
    amountCents,
    staffId,
  }
}

// ---------------------------------------------------------------------------
// registerSale — commits transaction via register_sale RPC atomically
// ---------------------------------------------------------------------------

export async function registerSale(
  prevState: SaleState,
  formData: FormData
): Promise<SaleState> {
  // 1. Extract hidden fields populated from preview state
  const raw = {
    card_number: (formData.get('card_number') as string | null)?.trim() ?? '',
    amount_cents: formData.get('amount_cents'),
    staff_id: formData.get('staff_id'),
  }

  // 2. Validate with Zod
  const validated = RegisterSaleSchema.safeParse(raw)
  if (!validated.success) {
    const firstIssue = validated.error.issues[0]
    return { step: 'error', message: firstIssue?.message ?? 'Dados inválidos' }
  }

  const { card_number, amount_cents, staff_id } = validated.data

  // 3. Auth check
  const auth = await getAuthenticatedManager()
  if ('error' in auth) {
    return { step: 'error', message: auth.error }
  }

  const { supabase } = auth

  // 4. Call register_sale RPC atomically
  const { data, error: rpcError } = await supabase.rpc('register_sale', {
    p_card_number: card_number,
    p_amount_cents: amount_cents,
    p_staff_id: staff_id,
  })

  // 5. Handle PostgREST-level errors
  if (rpcError) {
    return { step: 'error', message: 'Erro interno. Tente novamente.' }
  }

  // 6. Handle RPC application-level errors
  if (data?.error) {
    const errorMap: Record<string, string> = {
      not_authenticated: 'Sessão expirada. Faça login novamente.',
      invalid_card_format: 'Formato de cartão inválido.',
      customer_not_found: 'Cartão não encontrado.',
    }
    return {
      step: 'error',
      message: errorMap[data.error] ?? 'Erro desconhecido',
    }
  }

  // 7. Return success with points and rank promotion info for Phase 4 consumption
  return {
    step: 'success',
    pointsEarned: data.points_earned,
    newBalance: data.new_balance,
    customerName: data.customer_name,
    rankPromoted: data.rank_promoted ?? false,
    newRankName: data.new_rank_name ?? '',
  }
}
