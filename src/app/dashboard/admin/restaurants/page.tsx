import { createServiceClient } from '@/lib/supabase/service'

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

export default async function AdminRestaurantsPage() {
  const supabase = createServiceClient()

  // Fetch all active restaurants
  const { data: restaurants } = await supabase
    .from('active_restaurants')
    .select('id, name, slug, created_at')
    .order('created_at', { ascending: false })

  const restaurantList = restaurants ?? []
  const restaurantIds = restaurantList.map((r) => r.id)

  // Fetch aggregates in parallel
  const [customersRes, salesRes, staffRes] = await Promise.all([
    restaurantIds.length > 0
      ? supabase
          .from('active_customers')
          .select('id, restaurant_id')
          .in('restaurant_id', restaurantIds)
      : Promise.resolve({ data: [] }),
    restaurantIds.length > 0
      ? supabase
          .from('active_sales')
          .select('id, restaurant_id, amount_cents')
          .in('restaurant_id', restaurantIds)
      : Promise.resolve({ data: [] }),
    restaurantIds.length > 0
      ? supabase
          .from('active_restaurant_staff')
          .select('id, restaurant_id')
          .in('restaurant_id', restaurantIds)
      : Promise.resolve({ data: [] }),
  ])

  // Build aggregate maps
  const customerCounts = new Map<string, number>()
  const saleCounts = new Map<string, number>()
  const revenueCents = new Map<string, number>()
  const staffCounts = new Map<string, number>()

  for (const c of customersRes.data ?? []) {
    customerCounts.set(c.restaurant_id, (customerCounts.get(c.restaurant_id) ?? 0) + 1)
  }
  for (const s of salesRes.data ?? []) {
    saleCounts.set(s.restaurant_id, (saleCounts.get(s.restaurant_id) ?? 0) + 1)
    revenueCents.set(s.restaurant_id, (revenueCents.get(s.restaurant_id) ?? 0) + (s.amount_cents as number))
  }
  for (const st of staffRes.data ?? []) {
    staffCounts.set(st.restaurant_id, (staffCounts.get(st.restaurant_id) ?? 0) + 1)
  }

  // Sort by revenue descending
  const sorted = [...restaurantList].sort(
    (a, b) => (revenueCents.get(b.id) ?? 0) - (revenueCents.get(a.id) ?? 0)
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-db-text mb-6">Restaurantes</h1>

      <p className="text-sm text-db-text-muted mb-4">
        {sorted.length.toLocaleString('pt-BR')} restaurante{sorted.length !== 1 ? 's' : ''}
      </p>

      <div className="db-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-db-border">
                {['Restaurante', 'Slug', 'Clientes', 'Vendas', 'Receita (BRL)', 'Equipe', 'Criado em'].map((h) => (
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
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-db-text-muted">
                    Nenhum restaurante encontrado.
                  </td>
                </tr>
              ) : (
                sorted.map((r) => (
                  <tr key={r.id} className="border-b border-db-border last:border-b-0 transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-db-text-secondary font-medium">
                      {r.name}
                    </td>
                    <td className="px-4 py-3 text-db-text-muted font-mono text-xs">
                      {r.slug}
                    </td>
                    <td className="px-4 py-3 text-db-text-secondary">
                      {(customerCounts.get(r.id) ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-db-text-secondary">
                      {(saleCounts.get(r.id) ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-db-text-secondary">
                      {formatBRL(revenueCents.get(r.id) ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-db-text-secondary">
                      {(staffCounts.get(r.id) ?? 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-db-text-muted text-xs">
                      {formatDate(r.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
