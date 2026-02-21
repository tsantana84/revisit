'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface PeriodSelectorProps {
  current: string
}

const PERIODS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Todos' },
]

export default function PeriodSelector({ current }: PeriodSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = (value: string) => {
    startTransition(() => {
      router.push(`/dashboard/owner/analytics?period=${value}`)
    })
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
      {PERIODS.map((p) => {
        const isActive = current === p.value
        return (
          <button
            key={p.value}
            onClick={() => handleClick(p.value)}
            disabled={isPending}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              backgroundColor: isActive ? '#3b82f6' : 'transparent',
              color: isActive ? '#ffffff' : '#3b82f6',
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontWeight: isActive ? '600' : '400',
              opacity: isPending ? 0.7 : 1,
              fontSize: '0.875rem',
            }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
