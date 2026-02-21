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
    <div className="relative">
      <h1 className="text-2xl font-bold text-db-text mb-6">
        Clientes
      </h1>

      {/* Search form */}
      <form
        method="GET"
        action="/dashboard/owner/customers"
        className="flex gap-2 mb-6"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome, telefone ou cartão..."
          className="db-input flex-1"
        />
        <button
          type="submit"
          className="rounded-lg bg-db-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-db-accent-hover cursor-pointer"
        >
          Buscar
        </button>
        {q && (
          <a
            href="/dashboard/owner/customers"
            className="rounded-lg border border-db-border px-3 py-2 text-sm text-db-text-secondary no-underline transition-colors hover:bg-white/[0.03]"
          >
            Limpar
          </a>
        )}
      </form>

      {/* Count */}
      <p className="text-sm text-db-text-muted mb-4">
        {totalCount.toLocaleString('pt-BR')} cliente{totalCount !== 1 ? 's' : ''} encontrado{totalCount !== 1 ? 's' : ''}
      </p>

      {/* Customer table */}
      <div className="db-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-db-border">
                {['Nome', 'Telefone', 'Cartão', 'Nível', 'Pontos', 'Visitas', 'Gasto Total', 'Cadastro'].map((h) => (
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
              {(customers ?? []).length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-db-text-muted">
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
                      className={`border-b border-db-border last:border-b-0 transition-colors hover:bg-white/[0.02] ${
                        isSelected ? 'bg-db-accent/10' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <a
                          href={rowUrl}
                          className="text-db-accent hover:text-db-accent-hover no-underline font-medium"
                        >
                          {customer.name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-db-text-secondary">
                        {formatPhone(customer.phone)}
                      </td>
                      <td className="px-4 py-3 text-db-text-secondary font-mono text-xs">
                        {customer.card_number}
                      </td>
                      <td className="px-4 py-3 text-db-text-secondary">
                        {rankName}
                      </td>
                      <td className="px-4 py-3 text-db-text-secondary">
                        {(customer.points_balance ?? 0).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-db-text-secondary">
                        {customer.visit_count ?? 0}
                      </td>
                      <td className="px-4 py-3 text-db-text-secondary">
                        {formatBRL(customer.total_spend ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-db-text-muted text-xs">
                        {formatDate(customer.created_at)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <p className="text-sm text-db-text-muted">
            Página {pageNum} de {totalPages}
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <a
                href={buildUrl({ q: q || undefined, page: String(pageNum - 1) })}
                className="rounded-lg border border-db-border px-3 py-2 text-sm text-db-text-secondary no-underline transition-colors hover:bg-white/[0.03]"
              >
                Anterior
              </a>
            )}
            {pageNum < totalPages && (
              <a
                href={buildUrl({ q: q || undefined, page: String(pageNum + 1) })}
                className="rounded-lg border border-db-border px-3 py-2 text-sm text-db-text-secondary no-underline transition-colors hover:bg-white/[0.03]"
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
