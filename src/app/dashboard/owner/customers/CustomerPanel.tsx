import { createClient } from '@/lib/supabase/server'

interface CustomerPanelProps {
  customerId: string
  closeUrl: string
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  earn: 'Compra',
  redeem: 'Resgate',
  adjustment: 'Ajuste',
  expiry: 'Expiração',
}

const RANK_COLORS: Record<string, string> = {
  Bronze: '#CD7F32',
  Prata: '#C0C0C0',
  Gold: '#FFD700',
  VIP: '#9b59b6',
}

export default async function CustomerPanel({ customerId, closeUrl }: CustomerPanelProps) {
  const supabase = await createClient()

  const [
    { data: customer },
    { data: transactions },
  ] = await Promise.all([
    supabase
      .from('active_customers')
      .select('id, name, phone, card_number, points_balance, visit_count, total_spend, created_at, current_rank_id')
      .eq('id', customerId)
      .single(),

    supabase
      .from('active_point_transactions')
      .select('id, transaction_type, points_delta, balance_after, note, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  let rankName = 'Sem Nível'
  if (customer?.current_rank_id) {
    const { data: rank } = await supabase
      .from('active_ranks')
      .select('name')
      .eq('id', customer.current_rank_id)
      .single()
    if (rank) rankName = rank.name
  }

  if (!customer) {
    return (
      <div className="fixed right-0 top-0 w-[400px] h-screen bg-db-surface border-l border-db-border p-6 z-50 overflow-y-auto shadow-[-4px_0_20px_rgba(0,0,0,0.4)]">
        <p className="text-db-text-muted">Cliente não encontrado.</p>
        <a href={closeUrl} className="text-db-accent hover:text-db-accent-hover no-underline">Fechar</a>
      </div>
    )
  }

  const rankColor = RANK_COLORS[rankName] ?? '#71717a'

  return (
    <div className="fixed right-0 top-0 w-[420px] h-screen bg-db-surface border-l border-db-border p-6 z-50 overflow-y-auto shadow-[-4px_0_20px_rgba(0,0,0,0.4)]">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-db-text mb-1">
            {customer.name}
          </h2>
          <p className="text-sm text-db-text-muted mb-1">
            {customer.phone}
          </p>
          <p className="text-xs text-db-text-muted font-mono">
            {customer.card_number}
          </p>
        </div>
        <a
          href={closeUrl}
          className="text-db-text-muted hover:text-db-text text-xl px-2 py-1 rounded-lg border border-db-border hover:bg-white/[0.03] no-underline"
        >
          ×
        </a>
      </div>

      {/* Rank badge */}
      <div className="mb-6">
        <span
          className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
          style={{ backgroundColor: rankColor }}
        >
          {rankName}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Saldo de Pontos', value: (customer.points_balance ?? 0).toLocaleString('pt-BR') },
          { label: 'Visitas', value: (customer.visit_count ?? 0).toLocaleString('pt-BR') },
          { label: 'Gasto Total', value: formatBRL(customer.total_spend ?? 0) },
          { label: 'Membro desde', value: formatDate(customer.created_at) },
        ].map((stat) => (
          <div key={stat.label} className="bg-white/[0.03] border border-db-border rounded-lg p-3">
            <p className="text-xs text-db-text-muted mb-1">{stat.label}</p>
            <p className="text-base font-semibold text-db-text">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <div>
        <h3 className="text-sm font-semibold text-db-text-secondary mb-3">
          Histórico de Transações
        </h3>
        {(transactions ?? []).length === 0 ? (
          <p className="text-sm text-db-text-muted">Nenhuma transação encontrada.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-db-border">
                {['Data', 'Tipo', 'Pontos', 'Saldo'].map((h) => (
                  <th key={h} className="text-left py-2 px-1 text-db-text-muted font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map((tx) => (
                <tr key={tx.id} className="border-b border-db-border last:border-b-0">
                  <td className="py-2 px-1 text-db-text-secondary">
                    {formatDateTime(tx.created_at)}
                  </td>
                  <td className="py-2 px-1 text-db-text-secondary">
                    {TRANSACTION_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                  </td>
                  <td className={`py-2 px-1 font-medium ${tx.points_delta >= 0 ? 'text-db-success' : 'text-db-error'}`}>
                    {tx.points_delta >= 0 ? '+' : ''}{tx.points_delta}
                  </td>
                  <td className="py-2 px-1 text-db-text-muted">
                    {tx.balance_after}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
