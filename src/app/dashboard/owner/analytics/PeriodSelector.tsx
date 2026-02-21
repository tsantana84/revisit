'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

interface PeriodSelectorProps {
  current: string
  basePath?: string
}

const PERIODS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'all', label: 'Todos' },
]

export default function PeriodSelector({ current, basePath = '/dashboard/owner/analytics' }: PeriodSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleClick = (value: string) => {
    startTransition(() => {
      router.push(`${basePath}?period=${value}`)
    })
  }

  return (
    <div className="flex gap-2 mb-6">
      {PERIODS.map((p) => {
        const isActive = current === p.value
        return (
          <button
            key={p.value}
            onClick={() => handleClick(p.value)}
            disabled={isPending}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${
              isActive
                ? 'bg-db-accent text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                : 'text-db-text-muted hover:text-db-text-secondary bg-white/[0.03] hover:bg-white/[0.06]'
            } ${isPending ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
