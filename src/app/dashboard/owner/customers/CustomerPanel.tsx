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

  // Get rank name if customer has a rank
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
      <div style={{
        position: 'fixed',
        right: 0,
        top: 0,
        width: '400px',
        height: '100vh',
        backgroundColor: '#ffffff',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
        padding: '1.5rem',
        zIndex: 50,
        overflowY: 'auto',
      }}>
        <p style={{ color: '#6b7280' }}>Cliente não encontrado.</p>
        <a href={closeUrl} style={{ color: '#3b82f6', textDecoration: 'none' }}>Fechar</a>
      </div>
    )
  }

  const rankColor = RANK_COLORS[rankName] ?? '#6b7280'

  return (
    <div style={{
      position: 'fixed',
      right: 0,
      top: 0,
      width: '420px',
      height: '100vh',
      backgroundColor: '#ffffff',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      padding: '1.5rem',
      zIndex: 50,
      overflowY: 'auto',
      fontFamily: 'sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 'bold', color: '#111827' }}>
            {customer.name}
          </h2>
          <p style={{ margin: '0 0 0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
            {customer.phone}
          </p>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#9ca3af', fontFamily: 'monospace' }}>
            {customer.card_number}
          </p>
        </div>
        <a
          href={closeUrl}
          style={{
            color: '#6b7280',
            textDecoration: 'none',
            fontSize: '1.25rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid #e5e7eb',
          }}
        >
          ×
        </a>
      </div>

      {/* Rank badge */}
      <div style={{ marginBottom: '1.5rem' }}>
        <span style={{
          display: 'inline-block',
          backgroundColor: rankColor,
          color: '#fff',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          fontSize: '0.8rem',
          fontWeight: '600',
        }}>
          {rankName}
        </span>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Saldo de Pontos', value: (customer.points_balance ?? 0).toLocaleString('pt-BR') },
          { label: 'Visitas', value: (customer.visit_count ?? 0).toLocaleString('pt-BR') },
          { label: 'Gasto Total', value: formatBRL(customer.total_spend ?? 0) },
          { label: 'Membro desde', value: formatDate(customer.created_at) },
        ].map((stat) => (
          <div key={stat.label} style={{
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            padding: '0.75rem',
          }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>{stat.label}</p>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: '#111827' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Transaction history */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#374151' }}>
          Histórico de Transações
        </h3>
        {(transactions ?? []).length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>Nenhuma transação encontrada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Data', 'Tipo', 'Pontos', 'Saldo'].map((h) => (
                  <th key={h} style={{ padding: '0.5rem 0.25rem', textAlign: 'left', color: '#6b7280', fontWeight: '500' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(transactions ?? []).map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem 0.25rem', color: '#374151' }}>
                    {formatDateTime(tx.created_at)}
                  </td>
                  <td style={{ padding: '0.5rem 0.25rem', color: '#374151' }}>
                    {TRANSACTION_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                  </td>
                  <td style={{
                    padding: '0.5rem 0.25rem',
                    color: tx.points_delta >= 0 ? '#059669' : '#dc2626',
                    fontWeight: '500',
                  }}>
                    {tx.points_delta >= 0 ? '+' : ''}{tx.points_delta}
                  </td>
                  <td style={{ padding: '0.5rem 0.25rem', color: '#6b7280' }}>
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
