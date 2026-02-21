import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import PeriodSelector from './PeriodSelector'
import RankDonutChart from './RankDonutChart'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

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

export default async function AnalyticsPage({ searchParams }: Props) {
  const { period = '30d' } = await searchParams
  const validPeriods = ['7d', '30d', '90d', 'all']
  const safePeriod = validPeriods.includes(period) ? period : '30d'
  const since = periodToDate(safePeriod)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const claims = jwtDecode<RevisitClaims>(session.access_token)
  const restaurantId = claims.restaurant_id
  if (!restaurantId) redirect('/login')

  // Run all queries in parallel
  const [
    { count: totalCustomers },
    { data: pointsData },
    { count: totalSales },
    { data: salesData },
    { data: customersWithRank },
    { data: ranksData },
  ] = await Promise.all([
    // Total customers (all-time, no period filter)
    supabase
      .from('active_customers')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),

    // Points issued (period filtered)
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

    // Sales count (period filtered)
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

    // Revenue data (period filtered)
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

    // Customers with rank ID for distribution
    supabase
      .from('active_customers')
      .select('current_rank_id')
      .eq('restaurant_id', restaurantId),

    // Ranks for name lookup
    supabase
      .from('active_ranks')
      .select('id, name')
      .eq('restaurant_id', restaurantId),
  ])

  // Compute aggregates client-side
  const totalPointsIssued = (pointsData ?? []).reduce(
    (sum, r) => sum + (r.points_delta ?? 0),
    0
  )

  const totalRevenueCents = (salesData ?? []).reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0
  )

  // Build rank distribution
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
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
        Análises
      </h1>

      <PeriodSelector current={safePeriod} />

      {/* Stat cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {statCards.map((card) => (
          <div
            key={card.label}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              {card.label}
            </p>
            <p style={{ margin: '0 0 0.25rem', fontSize: '1.75rem', fontWeight: 'bold', color: '#111827' }}>
              {card.value}
            </p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
              {card.note}
            </p>
          </div>
        ))}
      </div>

      <RankDonutChart data={rankDistribution} />
    </div>
  )
}
