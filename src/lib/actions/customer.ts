'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { headers } from 'next/headers'
import { z } from 'zod'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RegisterState =
  | { step: 'success'; cardNumber: string; customerName: string; rankName: string; isExisting: boolean }
  | { step: 'error'; message: string; fieldErrors?: { name?: string; phone?: string } }
  | undefined

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const RegisterSchema = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100, 'Nome muito longo'),
  phone: z.string().regex(/^\d{10,11}$/, 'Telefone invalido'),
})

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export async function registerCustomer(
  prevState: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  // 1. Read restaurant_id from middleware-injected header (cannot be spoofed)
  const headersList = await headers()
  const restaurantId = headersList.get('x-restaurant-id')

  if (!restaurantId) {
    return { step: 'error', message: 'Restaurante nao encontrado.' }
  }

  // 2. Extract and clean fields
  const rawName = (formData.get('name') as string | null)?.trim() ?? ''
  const rawPhone = ((formData.get('phone') as string | null) ?? '').replace(/\D/g, '')

  // 3. Validate with Zod
  const parsed = RegisterSchema.safeParse({ name: rawName, phone: rawPhone })
  if (!parsed.success) {
    const fieldErrors: { name?: string; phone?: string } = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as 'name' | 'phone'
      if (field === 'name' || field === 'phone') {
        fieldErrors[field] = issue.message
      }
    }
    return {
      step: 'error',
      message: 'Corrija os campos abaixo.',
      fieldErrors,
    }
  }

  const { name, phone } = parsed.data
  const startTime = Date.now()
  log.info('customer.registration_started', { restaurant_id: restaurantId, phone: phone.slice(-4) })
  const supabase = createServiceClient()

  // 4. Check for duplicate phone — return existing card (idempotent)
  const { data: existing } = await supabase
    .from('customers')
    .select('id, card_number, name, current_rank_id')
    .eq('restaurant_id', restaurantId)
    .eq('phone', phone)
    .is('deleted_at', null)
    .single()

  if (existing) {
    // Fetch the rank name
    let rankName = 'Bronze'
    if (existing.current_rank_id) {
      const { data: rank } = await supabase
        .from('ranks')
        .select('name')
        .eq('id', existing.current_rank_id)
        .single()
      if (rank) rankName = rank.name
    }
    log.info('customer.registration_completed', { restaurant_id: restaurantId, card_number: existing.card_number, is_existing: true, duration_ms: Date.now() - startTime })
    return {
      step: 'success',
      cardNumber: existing.card_number,
      customerName: existing.name,
      rankName,
      isExisting: true,
    }
  }

  // 5. Generate card number via atomic RPC
  const { data: cardNumberData, error: rpcError } = await supabase.rpc(
    'generate_next_card_number',
    { p_restaurant_id: restaurantId },
  )

  if (rpcError || !cardNumberData) {
    log.error('customer.registration_failed', { restaurant_id: restaurantId, error: rpcError?.message ?? 'card_number_generation_failed' })
    return { step: 'error', message: 'Erro ao gerar numero do cartao. Tente novamente.' }
  }

  const cardNumber = cardNumberData as string

  // 6. Get bronze rank (lowest sort_order) for this restaurant
  const { data: bronzeRank } = await supabase
    .from('ranks')
    .select('id, name')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()

  // 7. Insert customer
  const { error: insertError } = await supabase.from('customers').insert({
    restaurant_id: restaurantId,
    name,
    phone,
    card_number: cardNumber,
    points_balance: 0,
    visit_count: 0,
    total_spend: 0,
    current_rank_id: bronzeRank?.id ?? null,
  })

  // 8. Handle unique violation race condition — return existing customer
  if (insertError) {
    if (insertError.code === '23505') {
      const { data: raceExisting } = await supabase
        .from('customers')
        .select('card_number, name, current_rank_id')
        .eq('restaurant_id', restaurantId)
        .eq('phone', phone)
        .is('deleted_at', null)
        .single()

      let rankName = bronzeRank?.name ?? 'Bronze'
      if (raceExisting?.current_rank_id) {
        const { data: rank } = await supabase
          .from('ranks')
          .select('name')
          .eq('id', raceExisting.current_rank_id)
          .single()
        if (rank) rankName = rank.name
      }

      return {
        step: 'success',
        cardNumber: raceExisting?.card_number ?? cardNumber,
        customerName: raceExisting?.name ?? name,
        rankName,
        isExisting: true,
      }
    }

    log.error('customer.registration_failed', { restaurant_id: restaurantId, error: insertError.message })
    return { step: 'error', message: 'Erro ao cadastrar. Tente novamente.' }
  }

  // 9. Return success with new card
  log.info('customer.registration_completed', { restaurant_id: restaurantId, card_number: cardNumber, is_existing: false, duration_ms: Date.now() - startTime })
  return {
    step: 'success',
    cardNumber,
    customerName: name,
    rankName: bronzeRank?.name ?? 'Bronze',
    isExisting: false,
  }
}
