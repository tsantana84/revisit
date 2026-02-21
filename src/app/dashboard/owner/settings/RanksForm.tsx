'use client'

import { useState, useActionState } from 'react'
import { updateRanks, type RanksState } from '@/lib/actions/restaurant'

interface Rank {
  id: string
  name: string
  min_visits: number
  multiplier: number
  discount_pct: number
  sort_order: number
}

interface RanksFormProps {
  ranks: Rank[]
}

interface RankRow {
  id: string
  name: string
  min_visits: number
  multiplier: number
  discount_pct: number
}

let nextTempId = 1

function makeTempId() {
  return `new-${nextTempId++}`
}

export function RanksForm({ ranks }: RanksFormProps) {
  const [rows, setRows] = useState<RankRow[]>(
    ranks.length > 0
      ? ranks.map((r) => ({
          id: r.id || makeTempId(),
          name: r.name,
          min_visits: r.min_visits,
          multiplier: r.multiplier,
          discount_pct: r.discount_pct ?? 0,
        }))
      : [{ id: makeTempId(), name: 'Bronze', min_visits: 0, multiplier: 1, discount_pct: 0 }]
  )

  const [state, action, pending] = useActionState<RanksState, FormData>(
    updateRanks,
    undefined
  )

  function addRank() {
    setRows((prev) => [
      ...prev,
      { id: makeTempId(), name: '', min_visits: 0, multiplier: 1, discount_pct: 0 },
    ])
  }

  function removeRank(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRow(id: string, field: keyof RankRow, value: string | number) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  function handleSubmit(formData: FormData) {
    formData.set('ranks_json', JSON.stringify(rows))
    return action(formData)
  }

  return (
    <form action={handleSubmit}>
      {state?.message && (
        <p
          className={`px-3 py-2.5 rounded-lg mb-4 text-sm ${
            state.success
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-db-success'
              : 'bg-red-500/10 border border-red-500/20 text-db-error'
          }`}
        >
          {state.message}
        </p>
      )}

      {state?.errors && state.errors.length > 0 && (
        <ul className="text-db-error text-xs mb-4 pl-4 list-disc">
          {state.errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      <div className="mb-4 overflow-x-auto">
        {/* Header row */}
        <div className="grid grid-cols-[1fr_140px_140px_120px_80px] gap-2 mb-2 min-w-[600px]">
          <span className="text-xs font-medium text-db-text-muted uppercase tracking-wider">
            Nome do nível
          </span>
          <span className="text-xs font-medium text-db-text-muted uppercase tracking-wider">
            Visitas mín.
          </span>
          <span className="text-xs font-medium text-db-text-muted uppercase tracking-wider">
            Multiplicador
          </span>
          <span className="text-xs font-medium text-db-text-muted uppercase tracking-wider">
            Desconto (%)
          </span>
          <span />
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_140px_140px_120px_80px] gap-2 mb-2 items-center min-w-[600px]"
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => updateRow(row.id, 'name', e.target.value)}
              placeholder="Nome"
              className="db-input"
              required
            />
            <input
              type="number"
              value={row.min_visits}
              onChange={(e) => updateRow(row.id, 'min_visits', parseInt(e.target.value) || 0)}
              min={0}
              step={1}
              className="db-input"
              aria-label="Visitas mínimas"
            />
            <input
              type="number"
              value={row.multiplier}
              onChange={(e) => updateRow(row.id, 'multiplier', parseFloat(e.target.value) || 1)}
              min={0.1}
              max={10}
              step={0.1}
              className="db-input"
              aria-label="Multiplicador"
            />
            <input
              type="number"
              value={row.discount_pct}
              onChange={(e) =>
                updateRow(row.id, 'discount_pct', parseFloat(e.target.value) || 0)
              }
              min={0}
              max={100}
              step={0.1}
              className="db-input"
              aria-label="Desconto (%)"
            />
            <button
              type="button"
              onClick={() => removeRank(row.id)}
              disabled={rows.length <= 1}
              className={`px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                rows.length <= 1
                  ? 'border-db-border text-db-text-muted cursor-not-allowed opacity-40'
                  : 'border-red-500/30 text-db-error hover:bg-red-500/10'
              }`}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={addRank}
          className="rounded-lg border border-db-border px-4 py-2 text-sm text-db-text-secondary transition-colors hover:bg-white/[0.03] cursor-pointer"
        >
          Adicionar nível
        </button>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-db-accent px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-db-accent-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {pending ? 'Salvando...' : 'Salvar níveis'}
        </button>
      </div>
    </form>
  )
}
