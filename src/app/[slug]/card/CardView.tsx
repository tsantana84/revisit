// ---------------------------------------------------------------------------
// CardView — Server Component
// Renders loyalty card visual, stats row, and transaction history
// ---------------------------------------------------------------------------

const RANK_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: '#CD7F32', text: '#ffffff' },
  2: { bg: '#C0C0C0', text: '#1a1a1a' },
  3: { bg: '#FFD700', text: '#1a1a1a' },
  4: { bg: '#9b59b6', text: '#ffffff' },
}

function getRankBadgeStyle(sortOrder: number) {
  return RANK_COLORS[sortOrder] ?? { bg: '#888', text: '#fff' }
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  earn: { label: 'Compra', color: 'text-green-600 bg-green-50' },
  redeem: { label: 'Resgate', color: 'text-red-600 bg-red-50' },
  adjustment: { label: 'Ajuste', color: 'text-blue-600 bg-blue-50' },
  expiry: { label: 'Expirado', color: 'text-orange-600 bg-orange-50' },
}

function formatPoints(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

interface Rank {
  name: string
  sort_order: number
  multiplier: number
  discount_pct: number
}

interface Transaction {
  points_delta: number
  balance_after: number
  transaction_type: string
  created_at: string
}

interface CardViewProps {
  customer: {
    name: string
    card_number: string
    points_balance: number
    visit_count: number
    total_spend: number
  }
  rank: Rank | null
  transactions: Transaction[]
  restaurant: {
    card_image_url?: string | null
  }
}

export function CardView({ customer, rank, transactions, restaurant }: CardViewProps) {
  const rankStyle = rank ? getRankBadgeStyle(rank.sort_order) : null

  return (
    <div className="w-full max-w-[420px] mx-auto">
      {/* ---- Loyalty Card Visual ---- */}
      <div
        className={`w-full aspect-[1.586] rounded-2xl overflow-hidden relative ${
          restaurant.card_image_url ? '' : 'bg-primary-gradient shadow-primary'
        }`}
        style={restaurant.card_image_url ? {
          backgroundImage: `url(${restaurant.card_image_url})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {restaurant.card_image_url && (
          <>
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </>
        )}
        <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full border border-white/10" />
        <div className="absolute -bottom-8 right-8 w-20 h-20 rounded-full border border-white/[0.06]" />

        <div className="absolute inset-0 p-6 flex flex-col justify-between">
          <div>
            {rank && (
              <div
                className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest uppercase backdrop-blur-sm"
                style={{ background: `${rankStyle!.bg}33`, color: rankStyle!.text }}
              >
                {rank.name}
              </div>
            )}
          </div>

          <div>
            <div className="text-xl font-extrabold mb-1 tracking-tight text-white" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
              {customer.name}
            </div>
            <div className="text-sm text-white/70 mb-4 font-light">
              {formatPoints(customer.points_balance)} pontos
            </div>
            <div className="text-[20px] font-bold tracking-[3px] font-mono text-white/80">
              {customer.card_number}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Stats Row ---- */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { label: 'Visitas', value: String(customer.visit_count) },
          { label: 'Gasto total', value: formatBRL(customer.total_spend) },
          { label: 'Nível', value: rank?.name ?? '—' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-secondary/60 rounded-xl p-3.5 text-center">
            <div className="text-lg font-extrabold text-text-primary">{stat.value}</div>
            <div className="text-[11px] text-text-muted font-medium mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ---- Transaction History ---- */}
      {transactions.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Últimas transações</h3>
          <div className="flex flex-col gap-2">
            {transactions.map((tx, i) => {
              const typeInfo = TYPE_LABELS[tx.transaction_type] ?? { label: tx.transaction_type, color: 'text-gray-600 bg-gray-50' }
              const isPositive = tx.points_delta >= 0
              return (
                <div key={i} className="flex items-center gap-3 bg-surface-secondary/40 rounded-xl px-4 py-3">
                  <div className="text-[12px] text-text-muted font-medium w-[52px] shrink-0">
                    {formatDate(tx.created_at)}
                  </div>
                  <div className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 ${typeInfo.color}`}>
                    {typeInfo.label}
                  </div>
                  <div className="ml-auto text-right">
                    <div className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
                      {isPositive ? '+' : ''}{formatPoints(tx.points_delta)}
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {formatPoints(tx.balance_after)} pts
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
