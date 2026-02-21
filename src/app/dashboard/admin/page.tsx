import { createServiceClient } from '@/lib/supabase/service'
import PeriodSelector from '../owner/analytics/PeriodSelector'

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
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

export default async function AdminOverviewPage({ searchParams }: Props) {
  const { period = '30d' } = await searchParams
  const validPeriods = ['7d', '30d', '90d', 'all']
  const safePeriod = validPeriods.includes(period) ? period : '30d'
  const since = periodToDate(safePeriod)

  const supabase = createServiceClient()

  // Parallel queries for KPIs
  const [
    restaurantsRes,
    customersRes,
    salesRes,
    newSignupsRes,
    activeSalesRes,
    earnTxRes,
    redeemTxRes,
  ] = await Promise.all([
    // Total restaurants
    supabase.from('active_restaurants').select('id', { count: 'exact', head: true }),
    // Total customers
    supabase.from('active_customers').select('id', { count: 'exact', head: true }),
    // Sales volume in period
    (() => {
      let q = supabase.from('active_sales').select('amount_cents')
      if (since) q = q.gte('created_at', since.toISOString())
      return q
    })(),
    // New signups in period
    (() => {
      let q = supabase.from('active_customers').select('id', { count: 'exact', head: true })
      if (since) q = q.gte('created_at', since.toISOString())
      return q
    })(),
    // Active restaurants (distinct restaurant_id from sales in period)
    (() => {
      let q = supabase.from('active_sales').select('restaurant_id')
      if (since) q = q.gte('created_at', since.toISOString())
      return q
    })(),
    // Earn transactions in period (points issued)
    (() => {
      let q = supabase.from('active_point_transactions').select('points_delta').eq('transaction_type', 'earn')
      if (since) q = q.gte('created_at', since.toISOString())
      return q
    })(),
    // Redeem transactions in period
    (() => {
      let q = supabase.from('active_point_transactions').select('id', { count: 'exact', head: true }).eq('transaction_type', 'redeem')
      if (since) q = q.gte('created_at', since.toISOString())
      return q
    })(),
  ])

  const totalRestaurants = restaurantsRes.count ?? 0
  const totalCustomers = customersRes.count ?? 0
  const salesVolume = (salesRes.data ?? []).reduce((sum, s) => sum + (s.amount_cents as number), 0)
  const newSignups = newSignupsRes.count ?? 0

  const activeRestaurantIds = new Set((activeSalesRes.data ?? []).map(s => s.restaurant_id))
  const activeRestaurants = activeRestaurantIds.size

  const pointsIssued = (earnTxRes.data ?? []).reduce((sum, t) => sum + (t.points_delta as number), 0)
  const earnCount = earnTxRes.data?.length ?? 0
  const redeemCount = redeemTxRes.count ?? 0
  const totalTx = earnCount + redeemCount
  const redemptionRate = totalTx > 0 ? ((redeemCount / totalTx) * 100).toFixed(1) : '0.0'

  const kpis = [
    { label: 'Total Restaurantes', value: totalRestaurants.toLocaleString('pt-BR') },
    { label: 'Total Clientes', value: totalCustomers.toLocaleString('pt-BR') },
    { label: 'Volume de Vendas', value: formatBRL(salesVolume) },
    { label: 'Novos Cadastros', value: newSignups.toLocaleString('pt-BR') },
  ]

  const secondary = [
    { label: 'Restaurantes Ativos', value: activeRestaurants.toLocaleString('pt-BR') },
    { label: 'Pontos Emitidos', value: pointsIssued.toLocaleString('pt-BR') },
    { label: 'Taxa de Resgate', value: `${redemptionRate}%` },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-db-text mb-6">Visão Geral</h1>

      <PeriodSelector current={safePeriod} basePath="/dashboard/admin" />

      {/* Primary KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="db-card px-5 py-4">
            <p className="text-xs text-db-text-muted uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-db-text">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {secondary.map((kpi) => (
          <div key={kpi.label} className="db-card px-5 py-4">
            <p className="text-xs text-db-text-muted uppercase tracking-wider mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold text-db-text">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
