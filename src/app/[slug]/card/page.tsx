import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { validateCardNumber } from '@/lib/utils/card-number'
import { CardLookupForm } from './CardLookupForm'
import { CardView } from './CardView'

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`
}

type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ n?: string }>
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createServiceClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, program_name')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (!restaurant) {
    return { title: 'Não encontrado' }
  }

  const title = restaurant.program_name ?? restaurant.name
  return {
    title: `Consultar Saldo — ${title}`,
    description: `Consulte o saldo do seu cartão fidelidade ${title}`,
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function CardPage({ searchParams }: Props) {
  const headersList = await headers()
  const restaurantId = headersList.get('x-restaurant-id')

  if (!restaurantId) {
    notFound()
  }

  const supabase = createServiceClient()

  // Always fetch restaurant for branding
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, program_name, primary_color, secondary_color, logo_url, card_image_url')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!restaurant) {
    notFound()
  }

  const primaryColor = restaurant.primary_color ?? '#2563eb'
  const primaryRgb = hexToRgb(primaryColor)
  const displayName = restaurant.program_name ?? restaurant.name

  const { n: cardNumber } = await searchParams

  // ---------- No card number: show lookup form ----------
  if (!cardNumber) {
    return (
      <div
        className="min-h-screen bg-white text-text-primary flex flex-col"
        style={{ '--primary': primaryColor, '--primary-rgb': primaryRgb } as React.CSSProperties}
      >
        {/* Header */}
        <div className="bg-primary text-white px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border border-white/10" />
          <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full border border-white/[0.06]" />
          <div className="relative">
            {restaurant.logo_url && (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                className="max-h-[48px] max-w-[160px] object-contain mb-4 mx-auto brightness-0 invert"
              />
            )}
            <h1 className="text-xl font-extrabold tracking-tight">{displayName}</h1>
            <p className="text-[13px] text-white/50 mt-1 font-light">Consultar saldo</p>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 flex items-start justify-center px-6 pt-12 pb-8">
          <div className="w-full max-w-[380px]">
            <p className="text-text-muted text-sm text-center mb-6">
              Digite o número do seu cartão para consultar seus pontos e histórico.
            </p>
            <CardLookupForm />
          </div>
        </div>
      </div>
    )
  }

  // ---------- Validate card number ----------
  if (!validateCardNumber(cardNumber)) {
    return (
      <div
        className="min-h-screen bg-white text-text-primary flex flex-col"
        style={{ '--primary': primaryColor, '--primary-rgb': primaryRgb } as React.CSSProperties}
      >
        <div className="bg-primary text-white px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border border-white/10" />
          <div className="relative">
            <h1 className="text-xl font-extrabold tracking-tight">{displayName}</h1>
            <p className="text-[13px] text-white/50 mt-1 font-light">Consultar saldo</p>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center px-6 pt-12 pb-8">
          <div className="w-full max-w-[380px] text-center">
            <div className="bg-red-50 border border-red-200/60 rounded-xl p-4 text-sm text-red-600 mb-6">
              Número de cartão inválido.
            </div>
            <CardLookupForm />
          </div>
        </div>
      </div>
    )
  }

  // ---------- Fetch customer ----------
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, card_number, points_balance, visit_count, total_spend, current_rank_id')
    .eq('restaurant_id', restaurantId)
    .eq('card_number', cardNumber)
    .is('deleted_at', null)
    .single()

  if (!customer) {
    return (
      <div
        className="min-h-screen bg-white text-text-primary flex flex-col"
        style={{ '--primary': primaryColor, '--primary-rgb': primaryRgb } as React.CSSProperties}
      >
        <div className="bg-primary text-white px-6 py-8 text-center relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border border-white/10" />
          <div className="relative">
            <h1 className="text-xl font-extrabold tracking-tight">{displayName}</h1>
            <p className="text-[13px] text-white/50 mt-1 font-light">Consultar saldo</p>
          </div>
        </div>
        <div className="flex-1 flex items-start justify-center px-6 pt-12 pb-8">
          <div className="w-full max-w-[380px] text-center">
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-4 text-sm text-amber-700 mb-6">
              Cartão não encontrado. Verifique o número e tente novamente.
            </div>
            <CardLookupForm />
          </div>
        </div>
      </div>
    )
  }

  // ---------- Fetch rank ----------
  let rank = null
  if (customer.current_rank_id) {
    const { data } = await supabase
      .from('ranks')
      .select('name, sort_order, multiplier, discount_pct')
      .eq('id', customer.current_rank_id)
      .single()
    rank = data
  }

  // ---------- Fetch transactions ----------
  const { data: transactions } = await supabase
    .from('point_transactions')
    .select('points_delta, balance_after, transaction_type, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // ---------- Render ----------
  return (
    <div
      className="min-h-screen bg-white text-text-primary"
      style={{ '--primary': primaryColor, '--primary-rgb': primaryRgb } as React.CSSProperties}
    >
      {/* Header */}
      <div className="bg-primary text-white px-6 py-6 text-center relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border border-white/10" />
        <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full border border-white/[0.06]" />
        <div className="relative">
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="max-h-[40px] max-w-[140px] object-contain mb-2 mx-auto brightness-0 invert"
            />
          )}
          <h1 className="text-lg font-extrabold tracking-tight">{displayName}</h1>
        </div>
      </div>

      {/* Card + Stats + Transactions */}
      <div className="px-6 py-8">
        <CardView
          customer={customer}
          rank={rank}
          transactions={transactions ?? []}
          restaurant={{ card_image_url: restaurant.card_image_url }}
        />
      </div>
    </div>
  )
}
