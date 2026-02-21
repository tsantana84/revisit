'use client'

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface RankDataPoint {
  name: string
  value: number
}

interface RankDonutChartProps {
  data: RankDataPoint[]
}

const RANK_COLORS: Record<string, string> = {
  Bronze: '#CD7F32',
  Prata: '#C0C0C0',
  Gold: '#FFD700',
  VIP: '#9b59b6',
}

const DEFAULT_COLOR = '#8884d8'

export default function RankDonutChart({ data }: RankDonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="db-card p-6 mt-6">
        <h2 className="text-base font-semibold text-db-text mb-4">
          Distribuição por Nível
        </h2>
        <p className="text-db-text-muted text-center py-8">
          Nenhum cliente cadastrado
        </p>
      </div>
    )
  }

  return (
    <div className="db-card p-6 mt-6 relative">
      <h2 className="text-base font-semibold text-db-text mb-4">
        Distribuição por Nível
      </h2>
      <div className="relative">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={110}
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={RANK_COLORS[entry.name] ?? DEFAULT_COLOR}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number | string | undefined) => [`${value ?? 0} clientes`, '']}
              contentStyle={{
                backgroundColor: '#111113',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#f4f4f5',
              }}
              itemStyle={{ color: '#f4f4f5' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        {/* Total count in center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[70%] text-center pointer-events-none">
          <div className="text-2xl font-bold text-db-text">{total}</div>
          <div className="text-xs text-db-text-muted">clientes</div>
        </div>
      </div>
    </div>
  )
}
