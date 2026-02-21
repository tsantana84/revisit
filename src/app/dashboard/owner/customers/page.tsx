import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import CustomerPanel from './CustomerPanel'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

type Props = {
  searchParams: Promise<{ q?: string; page?: string; selected?: string }>
}

function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

const PAGE_SIZE = 25

export default async function CustomersPage({ searchParams }: Props) {
  const { q = '', page = '1', selected } = await searchParams

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

  // Build customer query
  let query = supabase
    .from('active_customers')
    .select(
      'id, name, phone, card_number, points_balance, visit_count, total_spend, created_at, current_rank_id',
      { count: 'exact' }
    )
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,phone.ilike.%${q}%,card_number.ilike.%${q}%`
    )
  }

  const [{ data: customers, count }, { data: ranks }] = await Promise.all([
    query,
    supabase
      .from('active_ranks')
      .select('id, name')
      .eq('restaurant_id', restaurantId),
  ])

  const rankMap = new Map<string, string>()
  for (const rank of ranks ?? []) {
    rankMap.set(rank.id, rank.name)
  }

  const totalCount = count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  // Build close URL for panel (strips selected param)
  const buildUrl = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    if (params.q) p.set('q', params.q)
    if (params.page && params.page !== '1') p.set('page', params.page)
    if (params.selected) p.set('selected', params.selected)
    const qs = p.toString()
    return `/dashboard/owner/customers${qs ? '?' + qs : ''}`
  }

  const closeUrl = buildUrl({ q: q || undefined, page: page !== '1' ? page : undefined })

  return (
    <div style={{ position: 'relative' }}>
      <h1 style={{ margin: '0 0 1.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
        Clientes
      </h1>

      {/* Search form */}
      <form
        method="GET"
        action="/dashboard/owner/customers"
        style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, telefone ou cartão..."
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            fontSize: '0.875rem',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Buscar
        </button>
        {q && (
          <a
            href="/dashboard/owner/customers"
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              textDecoration: 'none',
              color: '#374151',
              fontSize: '0.875rem',
            }}
          >
            Limpar
          </a>
        )}
      </form>

      {/* Count */}
      <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#6b7280' }}>
        {totalCount.toLocaleString('pt-BR')} cliente{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
      </p>

      {/* Customer table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              {['Nome', 'Telefone', 'Cartão', 'Nível', 'Pontos', 'Visitas', 'Gasto Total', 'Cadastro'].map((h) => (
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
            {(customers ?? []).length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                  Nenhum cliente encontrado.
                </td>
              </tr>
            ) : (
              (customers ?? []).map((customer) => {
                const rankName = customer.current_rank_id
                  ? (rankMap.get(customer.current_rank_id) ?? '—')
                  : '—'
                const rowUrl = buildUrl({
                  q: q || undefined,
                  page: page !== '1' ? page : undefined,
                  selected: customer.id,
                })
                const isSelected = selected === customer.id

                return (
                  <tr
                    key={customer.id}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <a
                        href={rowUrl}
                        style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: '500' }}
                      >
                        {customer.name}
                      </a>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                      {formatPhone(customer.phone)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {customer.card_number}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                      {rankName}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                      {(customer.points_balance ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                      {customer.visit_count ?? 0}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                      {formatBRL(customer.total_spend ?? 0)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#6b7280', fontSize: '0.8rem' }}>
                      {formatDate(customer.created_at)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            Página {pageNum} de {totalPages}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pageNum > 1 && (
              <a
                href={buildUrl({ q: q || undefined, page: String(pageNum - 1) })}
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
                href={buildUrl({ q: q || undefined, page: String(pageNum + 1) })}
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

      {/* Customer side panel */}
      {selected && (
        <CustomerPanel customerId={selected} closeUrl={closeUrl} />
      )}
    </div>
  )
}
