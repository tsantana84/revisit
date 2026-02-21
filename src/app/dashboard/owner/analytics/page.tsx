import { createClerkSupabaseClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/auth'
import PeriodSelector from './PeriodSelector'
import RankDonutChart from './RankDonutChart'

type Props = {
  searchParams: Promise<{ period?: string }>
}

function periodToDate(period: string): Date | null {
  const now = new Date()
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    case 'all':
    default:
      return null
  }
}

function formatBRL(cents: number): string {
  const value = cents / 100
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

const CARD_ACCENTS = [
  'from-indigo-500/80 to-indigo-500/0',
  'from-emerald-500/80 to-emerald-500/0',
  'from-amber-500/80 to-amber-500/0',
  'from-cyan-500/80 to-cyan-500/0',
]

export default async function AnalyticsPage({ searchParams }: Props) {
  const { period = '30d' } = await searchParams
  const validPeriods = ['7d', '30d', '90d', 'all']
  const safePeriod = validPeriods.includes(period) ? period : '30d'
  const since = periodToDate(safePeriod)

  const { restaurantId } = await requireOwner()
  const supabase = await createClerkSupabaseClient()

  const [
    { count: totalCustomers },
    { data: pointsData },
    { count: totalSales },
    { data: salesData },
    { data: customersWithRank },
    { data: ranksData },
  ] = await Promise.all([
    supabase
      .from('active_customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),

    since
      ? supabase
          .from('active_point_transactions')
          .select('points_delta')
          .eq('restaurant_id', restaurantId)
          .eq('transaction_type', 'earn')
          .gte('created_at', since.toISOString())
      : supabase
          .from('active_point_transactions')
          .select('points_delta')
          .eq('restaurant_id', restaurantId)
          .eq('transaction_type', 'earn'),

    since
      ? supabase
          .from('active_sales')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .gte('created_at', since.toISOString())
      : supabase
          .from('active_sales')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId),

    since
      ? supabase
          .from('active_sales')
          .select('amount_cents')
          .eq('restaurant_id', restaurantId)
          .gte('created_at', since.toISOString())
      : supabase
          .from('active_sales')
          .select('amount_cents')
          .eq('restaurant_id', restaurantId),

    supabase
      .from('active_customers')
      .select('current_rank_id')
      .eq('restaurant_id', restaurantId),

    supabase
      .from('active_ranks')
      .select('id, name')
      .eq('restaurant_id', restaurantId),
  ])

  const totalPointsIssued = (pointsData ?? []).reduce(
    (sum, r) => sum + (r.points_delta ?? 0),
    0
  )

  const totalRevenueCents = (salesData ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0
  )

  const rankMap = new Map<string, string>()
  for (const rank of ranksData ?? []) {
    rankMap.set(rank.id, rank.name)
  }

  const rankCountMap = new Map<string, number>()
  for (const customer of customersWithRank ?? []) {
    const rankName = customer.current_rank_id
      ? (rankMap.get(customer.current_rank_id) ?? 'Desconhecido')
      : 'Sem Nível'
    rankCountMap.set(rankName, (rankCountMap.get(rankName) ?? 0) + 1)
  }

  const rankDistribution = Array.from(rankCountMap.entries()).map(
    ([name, value]) => ({ name, value })
  )

  const statCards = [
    {
      label: 'Total de Clientes',
      value: (totalCustomers ?? 0).toLocaleString('pt-BR'),
      note: 'Todos os tempos',
    },
    {
      label: 'Pontos Emitidos',
      value: totalPointsIssued.toLocaleString('pt-BR'),
      note: safePeriod === 'all' ? 'Todos os tempos' : `Últimos ${safePeriod}`,
    },
    {
      label: 'Vendas',
      value: (totalSales ?? 0).toLocaleString('pt-BR'),
      note: safePeriod === 'all' ? 'Todos os tempos' : `Últimos ${safePeriod}`,
    },
    {
      label: 'Receita',
      value: formatBRL(totalRevenueCents),
      note: safePeriod === 'all' ? 'Todos os tempos' : `Últimos ${safePeriod}`,
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-db-text mb-6">
        Análises
      </h1>

      <PeriodSelector current={safePeriod} />

      {/* Stat cards grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className="db-card p-5 relative overflow-hidden"
          >
            {/* Gradient accent top edge */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${CARD_ACCENTS[i]}`} />
            <p className="text-sm text-db-text-muted mb-2">
              {card.label}
            </p>
            <p className="text-[1.75rem] font-bold text-db-text mb-1">
              {card.value}
            </p>
            <p className="text-xs text-db-text-muted">
              {card.note}
            </p>
          </div>
        ))}
      </div>

      <RankDonutChart data={rankDistribution} />
    </div>
  )
}
