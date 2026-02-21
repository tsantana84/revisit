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
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginTop: '1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#374151' }}>
          Distribuição por Nível
        </h2>
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
          Nenhum cliente cadastrado
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginTop: '1.5rem',
        position: 'relative',
      }}
    >
      <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#374151' }}>
        Distribuição por Nível
      </h2>
      <div style={{ position: 'relative' }}>
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
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        {/* Total count in center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -70%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827' }}>
            {total}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>clientes</div>
        </div>
      </div>
    </div>
  )
}
