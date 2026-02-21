'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import { z } from 'zod'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

export type BrandingState =
  | {
      success?: boolean
      message?: string
      errors?: {
        program_name?: string[]
        primary_color?: string[]
        secondary_color?: string[]
        earn_rate?: string[]
        reward_type?: string[]
        point_expiry_days?: string[]
      }
    }
  | undefined

export type LogoState =
  | {
      success?: boolean
      message?: string
    }
  | undefined

export type RanksState =
  | {
      success?: boolean
      message?: string
      errors?: string[]
    }
  | undefined

export type CardDesignState =
  | {
      success?: boolean
      message?: string
      imageUrl?: string
    }
  | undefined

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const BrandingSchema = z.object({
  program_name: z.string().min(1, 'Nome do programa é obrigatório').max(100, 'Nome muito longo').trim(),
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor primária inválida (use formato #RRGGBB)'),
  secondary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Cor secundária inválida (use formato #RRGGBB)'),
  earn_rate: z.coerce
    .number()
    .int('Deve ser um número inteiro')
    .min(1, 'Mínimo 1 ponto')
    .max(100, 'Máximo 100 pontos'),
  reward_type: z.enum(['cashback', 'free_product', 'progressive_discount'] as const, {
    error: 'Tipo de recompensa inválido',
  }),
  point_expiry_days: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z
      .number()
      .int('Deve ser um número inteiro')
      .min(0, 'Mínimo 0 dias')
      .nullable()
      .optional()
  ),
})

const RankSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Nome do nível é obrigatório').max(50),
  min_visits: z.number().int().min(0, 'Mínimo 0 visitas'),
  multiplier: z.number().min(0.1, 'Multiplicador deve ser positivo').max(10, 'Multiplicador máximo é 10'),
  discount_pct: z.number().min(0, 'Mínimo 0%').max(100, 'Máximo 100%').default(0),
})

const RanksSchema = z.array(RankSchema).min(1, 'Deve ter pelo menos um nível')

// ---------------------------------------------------------------------------
// Helper: get authenticated owner context
// ---------------------------------------------------------------------------

async function getAuthenticatedOwner(): Promise<
  { userId: string; restaurantId: string; supabase: Awaited<ReturnType<typeof createClient>> } | { error: string }
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

  if (claims.app_role !== 'owner') {
    return { error: 'Acesso negado: apenas proprietários podem alterar configurações' }
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
// updateBranding — persists program name, colors, earn rate, reward type, expiry
// ---------------------------------------------------------------------------

export async function updateBranding(
  prevState: BrandingState,
  formData: FormData
): Promise<BrandingState> {
  const auth = await getAuthenticatedOwner()
  if ('error' in auth) {
    return { message: auth.error }
  }

  const raw = {
    program_name: formData.get('program_name'),
    primary_color: formData.get('primary_color'),
    secondary_color: formData.get('secondary_color'),
    earn_rate: formData.get('earn_rate'),
    reward_type: formData.get('reward_type'),
    point_expiry_days: formData.get('point_expiry_days'),
  }

  const validated = BrandingSchema.safeParse(raw)

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { supabase, restaurantId } = auth

  const { error } = await supabase
    .from('restaurants')
    .update(validated.data)
    .eq('id', restaurantId)

  if (error) {
    return { message: `Erro ao salvar configurações: ${error.message}` }
  }

  log.info('restaurant.branding_updated', { restaurant_id: restaurantId, user_id: auth.userId, fields: Object.keys(validated.data) })
  revalidatePath('/dashboard/owner/settings')
  return { success: true, message: 'Configurações salvas com sucesso' }
}

// ---------------------------------------------------------------------------
// uploadLogo — uploads logo to Supabase Storage and saves public URL
// ---------------------------------------------------------------------------

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] as const
const MAX_LOGO_SIZE = 1_048_576 // 1MB

function getExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/svg+xml':
      return 'svg'
    default:
      return 'bin'
  }
}

export async function uploadLogo(
  prevState: LogoState,
  formData: FormData
): Promise<LogoState> {
  const auth = await getAuthenticatedOwner()
  if ('error' in auth) {
    return { message: auth.error }
  }

  const file = formData.get('logo') as File | null

  if (!file || file.size === 0) {
    return { message: 'Nenhum arquivo selecionado' }
  }

  if (file.size > MAX_LOGO_SIZE) {
    return { message: 'Imagem muito grande. Máximo 1MB.' }
  }

  if (!ALLOWED_LOGO_TYPES.includes(file.type as (typeof ALLOWED_LOGO_TYPES)[number])) {
    return { message: 'Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou SVG.' }
  }

  const { supabase, restaurantId } = auth
  const ext = getExtension(file.type)
  const path = `${restaurantId}/logo.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('restaurant-logos')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return { message: `Erro ao enviar imagem: ${uploadError.message}` }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('restaurant-logos').getPublicUrl(path)

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ logo_url: publicUrl })
    .eq('id', restaurantId)

  if (updateError) {
    return { message: `Erro ao salvar URL do logo: ${updateError.message}` }
  }

  log.info('restaurant.logo_uploaded', { restaurant_id: restaurantId, user_id: auth.userId, file_size: file.size, mime_type: file.type })
  revalidatePath('/dashboard/owner/settings')
  return { success: true, message: 'Logo atualizado com sucesso' }
}

// ---------------------------------------------------------------------------
// updateRanks — replaces the full ranks configuration for the restaurant
// ---------------------------------------------------------------------------

export async function updateRanks(
  prevState: RanksState,
  formData: FormData
): Promise<RanksState> {
  const auth = await getAuthenticatedOwner()
  if ('error' in auth) {
    return { message: auth.error }
  }

  const ranksJson = formData.get('ranks_json') as string | null

  if (!ranksJson) {
    return { message: 'Dados dos níveis não encontrados' }
  }

  let rawRanks: unknown
  try {
    rawRanks = JSON.parse(ranksJson)
  } catch {
    return { message: 'Formato de dados inválido' }
  }

  const validated = RanksSchema.safeParse(rawRanks)

  if (!validated.success) {
    return {
      errors: validated.error.issues.map((issue) => issue.message),
      message: 'Dados dos níveis inválidos',
    }
  }

  // Sort by min_visits ascending
  const sortedRanks = [...validated.data].sort((a, b) => a.min_visits - b.min_visits)

  const { supabase, restaurantId } = auth

  // Delete all existing ranks for this restaurant, then insert the new set
  const { error: deleteError } = await supabase
    .from('ranks')
    .delete()
    .eq('restaurant_id', restaurantId)

  if (deleteError) {
    return { message: `Erro ao atualizar níveis: ${deleteError.message}` }
  }

  const ranksToInsert = sortedRanks.map((rank, index) => ({
    restaurant_id: restaurantId,
    name: rank.name,
    min_visits: rank.min_visits,
    multiplier: rank.multiplier,
    discount_pct: rank.discount_pct,
    sort_order: index,
  }))

  const { error: insertError } = await supabase.from('ranks').insert(ranksToInsert)

  if (insertError) {
    return { message: `Erro ao salvar níveis: ${insertError.message}` }
  }

  log.info('restaurant.ranks_updated', { restaurant_id: restaurantId, user_id: auth.userId, rank_count: ranksToInsert.length })
  revalidatePath('/dashboard/owner/settings')
  return { success: true, message: 'Níveis salvos com sucesso' }
}

// ---------------------------------------------------------------------------
// saveCardImage — fetches AI-generated image and uploads to Supabase Storage
// ---------------------------------------------------------------------------

export async function saveCardImage(
  prevState: CardDesignState,
  formData: FormData
): Promise<CardDesignState> {
  const auth = await getAuthenticatedOwner()
  if ('error' in auth) {
    return { message: auth.error }
  }

  const imageUrl = formData.get('imageUrl') as string | null

  if (!imageUrl) {
    return { message: 'URL da imagem não fornecida' }
  }

  const { supabase, restaurantId } = auth

  // Fetch image bytes from the temporary OpenAI URL
  let imageBuffer: ArrayBuffer
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) {
      return { message: 'Erro ao baixar imagem gerada' }
    }
    imageBuffer = await res.arrayBuffer()
  } catch {
    return { message: 'Erro ao baixar imagem gerada' }
  }

  const path = `${restaurantId}/card.png`

  const { error: uploadError } = await supabase.storage
    .from('restaurant-logos')
    .upload(path, imageBuffer, {
      upsert: true,
      contentType: 'image/png',
    })

  if (uploadError) {
    return { message: `Erro ao enviar imagem: ${uploadError.message}` }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('restaurant-logos').getPublicUrl(path)

  // Append cache-buster so browsers pick up new image
  const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ card_image_url: urlWithCacheBust })
    .eq('id', restaurantId)

  if (updateError) {
    return { message: `Erro ao salvar URL do cartão: ${updateError.message}` }
  }

  log.info('restaurant.card_image_saved', { restaurant_id: restaurantId, user_id: auth.userId })
  revalidatePath('/dashboard/owner/settings')
  return { success: true, message: 'Design do cartão salvo com sucesso' }
}

// ---------------------------------------------------------------------------
// removeCardImage — removes card image from storage and clears URL
// ---------------------------------------------------------------------------

export async function removeCardImage(
  prevState: CardDesignState,
  formData: FormData
): Promise<CardDesignState> {
  const auth = await getAuthenticatedOwner()
  if ('error' in auth) {
    return { message: auth.error }
  }

  const { supabase, restaurantId } = auth

  const path = `${restaurantId}/card.png`

  await supabase.storage.from('restaurant-logos').remove([path])

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({ card_image_url: null })
    .eq('id', restaurantId)

  if (updateError) {
    return { message: `Erro ao remover design: ${updateError.message}` }
  }

  log.info('restaurant.card_image_removed', { restaurant_id: restaurantId, user_id: auth.userId })
  revalidatePath('/dashboard/owner/settings')
  return { success: true, message: 'Design do cartão removido' }
}
