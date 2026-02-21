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

    // Batch fetch customers and staff
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
  let auditSalesStaffMap = new Map<string, string>() // sale_id → staff role

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

    // Batch fetch customer names
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

    // Fetch staff roles for those sales
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

    // Map sale_id → staff role for the audit rows
    for (const sale of salesForAuditRes.data ?? []) {
      if (sale.staff_id) {
        const role = staffIdToRole.get(sale.staff_id)
        if (role) auditSalesStaffMap.set(sale.id, role)
      }
    }
  }

  return (
    <div>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
        Registros
      </h1>

      {/* Period selector */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {PERIODS.map((p) => {
          const isActive = safePeriod === p.value
          return (
            <a
              key={p.value}
              href={buildPeriodUrl(p.value)}
              style={{
                padding: '0.4rem 0.875rem',
                borderRadius: '6px',
                border: '1px solid #3b82f6',
                backgroundColor: isActive ? '#3b82f6' : 'transparent',
                color: isActive ? '#ffffff' : '#3b82f6',
                textDecoration: 'none',
                fontWeight: isActive ? '600' : '400',
                fontSize: '0.875rem',
              }}
            >
              {p.label}
            </a>
          )
        })}
      </div>

      {/* Tab buttons */}
      <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
        {[
          { value: 'vendas', label: 'Vendas' },
          { value: 'atividade', label: 'Atividade' },
        ].map((t) => {
          const isActive = safeTab === t.value
          return (
            <a
              key={t.value}
              href={buildTabUrl(t.value)}
              style={{
                padding: '0.6rem 1.25rem',
                textDecoration: 'none',
                color: isActive ? '#1d4ed8' : '#6b7280',
                fontWeight: isActive ? '600' : '400',
                borderBottom: isActive ? '2px solid #1d4ed8' : '2px solid transparent',
                marginBottom: '-2px',
                fontSize: '0.9rem',
              }}
            >
              {t.label}
            </a>
          )
        })}
      </div>

      {/* Count */}
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
        {totalCount.toLocaleString('pt-BR')} registro{totalCount !== 1 ? 's' : ''}
      </p>

      {/* VENDAS TABLE */}
      {safeTab === 'vendas' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Data/Hora', 'Cliente', 'Cartão', 'Valor', 'Pontos', 'Registrado por'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      color: '#6b7280',
                      fontWeight: '500',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {salesRows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                    Nenhuma venda encontrada para este período.
                  </td>
                </tr>
              ) : (
                salesRows.map((sale) => {
                  const customer = sale.customer_id ? customerMap.get(sale.customer_id) : null
                  const staffRole = sale.staff_id ? staffRoleMap.get(sale.staff_id) : null
                  return (
                    <tr key={sale.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151', fontSize: '0.8rem' }}>
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                        {customer?.name ?? '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {customer?.card_number ?? '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                        {formatBRL(sale.amount_cents)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#059669', fontWeight: '500' }}>
                        +{sale.points_earned}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151', fontSize: '0.8rem' }}>
                        {staffRole ? (ROLE_LABELS[staffRole] ?? staffRole) : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ATIVIDADE TABLE */}
      {safeTab === 'atividade' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Data/Hora', 'Cliente', 'Tipo', 'Pontos', 'Saldo', 'Gerente', 'Nota'].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'left',
                      color: '#6b7280',
                      fontWeight: '500',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
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
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151', fontSize: '0.8rem' }}>
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                        {customer?.name ?? '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                        {TRANSACTION_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                      </td>
                      <td
                        style={{
                          padding: '0.75rem 1rem',
                          color: tx.points_delta >= 0 ? '#059669' : '#dc2626',
                          fontWeight: '500',
                        }}
                      >
                        {tx.points_delta >= 0 ? '+' : ''}{tx.points_delta}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                        {tx.balance_after}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#374151', fontSize: '0.8rem' }}>
                        {staffRole ? (ROLE_LABELS[staffRole] ?? staffRole) : '—'}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                        {tx.note ?? '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            Página {pageNum} de {totalPages}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pageNum > 1 && (
              <a
                href={buildTabUrl(safeTab, String(pageNum - 1))}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: '#374151',
                  fontSize: '0.875rem',
                }}
              >
                Anterior
              </a>
            )}
            {pageNum < totalPages && (
              <a
                href={buildTabUrl(safeTab, String(pageNum + 1))}
                style={{
                  padding: '0.5rem 0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: '#374151',
                  fontSize: '0.875rem',
                }}
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
