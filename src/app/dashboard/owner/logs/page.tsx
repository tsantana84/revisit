import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

type Props = {
  searchParams: Promise<{ tab?: string; page?: string; period?: string }>
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

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return (
    d.toLocaleDateString('pt-BR') +
    ' ' +
    d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  )
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  earn: 'Compra',
  redeem: 'Resgate',
  adjustment: 'Ajuste',
  expiry: 'Expiração',
}

const TRANSACTION_TYPE_BADGE: Record<string, string> = {
  earn: 'bg-emerald-500/15 text-emerald-400',
  redeem: 'bg-blue-500/15 text-blue-400',
  adjustment: 'bg-amber-500/15 text-amber-400',
  expiry: 'bg-red-500/15 text-red-400',
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  manager: 'Gerente',
}

const PAGE_SIZE = 25

export default async function LogsPage({ searchParams }: Props) {
  const { tab = 'vendas', page = '1', period = '30d' } = await searchParams

  const safeTab = ['vendas', 'atividade'].includes(tab) ? tab : 'vendas'
  const validPeriods = ['7d', '30d', '90d', 'all']
  const safePeriod = validPeriods.includes(period) ? period : '30d'
  const since = periodToDate(safePeriod)

  const pageNum = Math.max(1, parseInt(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

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

  const buildTabUrl = (t: string, p?: string) => {
    const params = new URLSearchParams({ tab: t, period: safePeriod })
    if (p && p !== '1') params.set('page', p)
    return `/dashboard/owner/logs?${params.toString()}`
  }

  const buildPeriodUrl = (p: string) => {
    const params = new URLSearchParams({ tab: safeTab, period: p, page: '1' })
    return `/dashboard/owner/logs?${params.toString()}`
  }

  const PERIODS = [
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
    { value: '90d', label: '90 dias' },
    { value: 'all', label: 'Todos' },
  ]

  let totalCount = 0
  let totalPages = 1

  // -----------------------------------------------
  // VENDAS TAB
  // -----------------------------------------------
  let salesRows: {
    id: string
    amount_cents: number
    points_earned: number
    created_at: string
    customer_id: string | null
    staff_id: string | null
  }[] = []

  let customerMap = new Map<string, { name: string; card_number: string }>()
  let staffRoleMap = new Map<string, string>()

  if (safeTab === 'vendas') {
    let salesQuery = supabase
      .from('active_sales')
      .select('id, amount_cents, points_earned, created_at, customer_id, staff_id', {
        count: 'exact',
      })
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (since) {
      salesQuery = salesQuery.gte('created_at', since.toISOString())
    }

    const { data: sales, count } = await salesQuery
    salesRows = sales ?? []
    totalCount = count ?? 0
    totalPages = Math.ceil(totalCount / PAGE_SIZE)

    const customerIds = [...new Set(salesRows.map((s) => s.customer_id).filter(Boolean) as string[])]
    const staffIds = [...new Set(salesRows.map((s) => s.staff_id).filter(Boolean) as string[])]

    const [customersRes, staffRes] = await Promise.all([
      customerIds.length > 0
        ? supabase
            .from('active_customers')
            .select('id, name, card_number')
            .in('id', customerIds)
        : Promise.resolve({ data: [] }),
      staffIds.length > 0
        ? supabase
            .from('active_restaurant_staff')
            .select('id, role')
            .in('id', staffIds)
        : Promise.resolve({ data: [] }),
    ])

    for (const c of customersRes.data ?? []) {
      customerMap.set(c.id, { name: c.name, card_number: c.card_number })
    }
    for (const s of staffRes.data ?? []) {
      staffRoleMap.set(s.id, s.role)
    }
  }

  // -----------------------------------------------
  // ATIVIDADE TAB
  // -----------------------------------------------
  let auditRows: {
    id: string
    customer_id: string | null
    points_delta: number
    balance_after: number
    transaction_type: string
    note: string | null
    reference_id: string | null
    created_at: string
  }[] = []

  let auditCustomerMap = new Map<string, { name: string }>()
  let auditSalesStaffMap = new Map<string, string>()

  if (safeTab === 'atividade') {
    let auditQuery = supabase
      .from('active_point_transactions')
      .select(
        'id, customer_id, points_delta, balance_after, transaction_type, note, reference_id, created_at',
        { count: 'exact' }
      )
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (since) {
      auditQuery = auditQuery.gte('created_at', since.toISOString())
    }

    const { data: audit, count } = await auditQuery
    auditRows = audit ?? []
    totalCount = count ?? 0
    totalPages = Math.ceil(totalCount / PAGE_SIZE)

    const auditCustomerIds = [
      ...new Set(auditRows.map((r) => r.customer_id).filter(Boolean) as string[]),
    ]

    const earnSaleIds = [
      ...new Set(
        auditRows
          .filter((r) => r.transaction_type === 'earn' && r.reference_id)
          .map((r) => r.reference_id as string)
      ),
    ]

    const [auditCustomersRes, salesForAuditRes] = await Promise.all([
      auditCustomerIds.length > 0
        ? supabase
            .from('active_customers')
            .select('id, name')
            .in('id', auditCustomerIds)
        : Promise.resolve({ data: [] }),
      earnSaleIds.length > 0
        ? supabase
            .from('active_sales')
            .select('id, staff_id')
            .in('id', earnSaleIds)
        : Promise.resolve({ data: [] }),
    ])

    for (const c of auditCustomersRes.data ?? []) {
      auditCustomerMap.set(c.id, { name: c.name })
    }

    const saleStaffIds = [
      ...new Set(
        (salesForAuditRes.data ?? [])
          .map((s) => s.staff_id)
          .filter(Boolean) as string[]
      ),
    ]

    const staffRolesRes =
      saleStaffIds.length > 0
        ? await supabase
            .from('active_restaurant_staff')
            .select('id, role')
            .in('id', saleStaffIds)
        : { data: [] }

    const staffIdToRole = new Map<string, string>()
    for (const s of staffRolesRes.data ?? []) {
      staffIdToRole.set(s.id, s.role)
    }

    for (const sale of salesForAuditRes.data ?? []) {
      if (sale.staff_id) {
        const role = staffIdToRole.get(sale.staff_id)
        if (role) auditSalesStaffMap.set(sale.id, role)
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-db-text mb-6">
        Registros
      </h1>

      {/* Period selector */}
      <div className="flex gap-2 mb-5">
        {PERIODS.map((p) => {
          const isActive = safePeriod === p.value
          return (
            <a
              key={p.value}
              href={buildPeriodUrl(p.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium no-underline transition-all ${
                isActive
                  ? 'bg-db-accent text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                  : 'text-db-text-muted hover:text-db-text-secondary bg-white/[0.03] hover:bg-white/[0.06]'
              }`}
            >
              {p.label}
            </a>
          )
        })}
      </div>

      {/* Tab buttons — Linear style underline tabs */}
      <div className="flex gap-0 mb-6 border-b border-db-border">
        {[
          { value: 'vendas', label: 'Vendas' },
          { value: 'atividade', label: 'Atividade' },
        ].map((t) => {
          const isActive = safeTab === t.value
          return (
            <a
              key={t.value}
              href={buildTabUrl(t.value)}
              className={`px-5 py-2.5 no-underline text-sm -mb-px transition-colors ${
                isActive
                  ? 'text-db-accent font-semibold border-b-2 border-db-accent'
                  : 'text-db-text-muted hover:text-db-text-secondary border-b-2 border-transparent'
              }`}
            >
              {t.label}
            </a>
          )
        })}
      </div>

      {/* Count */}
      <p className="text-sm text-db-text-muted mb-4">
        {totalCount.toLocaleString('pt-BR')} registro{totalCount !== 1 ? 's' : ''}
      </p>

      {/* VENDAS TABLE */}
      {safeTab === 'vendas' && (
        <div className="db-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-db-border">
                  {['Data/Hora', 'Cliente', 'Cartão', 'Valor', 'Pontos', 'Registrado por'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-db-text-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salesRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-db-text-muted">
                      Nenhuma venda encontrada para este período.
                    </td>
                  </tr>
                ) : (
                  salesRows.map((sale) => {
                    const customer = sale.customer_id ? customerMap.get(sale.customer_id) : null
                    const staffRole = sale.staff_id ? staffRoleMap.get(sale.staff_id) : null
                    return (
                      <tr key={sale.id} className="border-b border-db-border last:border-b-0 transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-db-text-secondary text-xs">
                          {formatDateTime(sale.created_at)}
                        </td>
                        <td className="px-4 py-3 text-db-text-secondary">
                          {customer?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-db-text-secondary font-mono text-xs">
                          {customer?.card_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-db-text-secondary">
                          {formatBRL(sale.amount_cents)}
                        </td>
                        <td className="px-4 py-3 text-db-success font-medium">
                          +{sale.points_earned}
                        </td>
                        <td className="px-4 py-3 text-db-text-secondary text-xs">
                          {staffRole ? (ROLE_LABELS[staffRole] ?? staffRole) : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ATIVIDADE TABLE */}
      {safeTab === 'atividade' && (
        <div className="db-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-db-border">
                  {['Data/Hora', 'Cliente', 'Tipo', 'Pontos', 'Saldo', 'Gerente', 'Nota'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-medium text-db-text-muted uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-db-text-muted">
                      Nenhuma atividade encontrada para este período.
                    </td>
                  </tr>
                ) : (
                  auditRows.map((tx) => {
                    const customer = tx.customer_id ? auditCustomerMap.get(tx.customer_id) : null
                    const staffRole =
                      tx.transaction_type === 'earn' && tx.reference_id
                        ? auditSalesStaffMap.get(tx.reference_id)
                        : undefined
                    const badgeClass = TRANSACTION_TYPE_BADGE[tx.transaction_type] ?? 'bg-white/[0.06] text-db-text-secondary'
                    return (
                      <tr key={tx.id} className="border-b border-db-border last:border-b-0 transition-colors hover:bg-white/[0.02]">
                        <td className="px-4 py-3 text-db-text-secondary text-xs">
                          {formatDateTime(tx.created_at)}
                        </td>
                        <td className="px-4 py-3 text-db-text-secondary">
                          {customer?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${badgeClass}`}>
                            {TRANSACTION_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${tx.points_delta >= 0 ? 'text-db-success' : 'text-db-error'}`}>
                          {tx.points_delta >= 0 ? '+' : ''}{tx.points_delta}
                        </td>
                        <td className="px-4 py-3 text-db-text-muted">
                          {tx.balance_after}
                        </td>
                        <td className="px-4 py-3 text-db-text-secondary text-xs">
                          {staffRole ? (ROLE_LABELS[staffRole] ?? staffRole) : '—'}
                        </td>
                        <td className="px-4 py-3 text-db-text-muted text-xs">
                          {tx.note ?? '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-db-text-muted">
            Página {pageNum} de {totalPages}
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <a
                href={buildTabUrl(safeTab, String(pageNum - 1))}
                className="rounded-lg border border-db-border px-3 py-2 text-sm text-db-text-secondary no-underline transition-colors hover:bg-white/[0.03]"
              >
                Anterior
              </a>
            )}
            {pageNum < totalPages && (
              <a
                href={buildTabUrl(safeTab, String(pageNum + 1))}
                className="rounded-lg border border-db-border px-3 py-2 text-sm text-db-text-secondary no-underline transition-colors hover:bg-white/[0.03]"
              >
                Próxima
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
