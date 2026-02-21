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

const inputStyle: React.CSSProperties = {
  padding: '0.375rem 0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '0.875rem',
  width: '100%',
  boxSizing: 'border-box',
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
          style={{
            padding: '0.75rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            backgroundColor: state.success ? '#d1fae5' : '#fee2e2',
            color: state.success ? '#065f46' : '#dc2626',
            fontSize: '0.875rem',
          }}
        >
          {state.message}
        </p>
      )}

      {state?.errors && state.errors.length > 0 && (
        <ul style={{ color: '#dc2626', fontSize: '0.75rem', marginBottom: '1rem', paddingLeft: '1rem' }}>
          {state.errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}

      <div style={{ marginBottom: '1rem' }}>
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 140px 120px 80px',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
            Nome do nível
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
            Visitas mínimas
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
            Multiplicador
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>
            Desconto (%)
          </span>
          <span />
        </div>

        {rows.map((row) => (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 140px 120px 80px',
              gap: '0.5rem',
              marginBottom: '0.5rem',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              value={row.name}
              onChange={(e) => updateRow(row.id, 'name', e.target.value)}
              placeholder="Nome"
              style={inputStyle}
              required
            />
            <input
              type="number"
              value={row.min_visits}
              onChange={(e) => updateRow(row.id, 'min_visits', parseInt(e.target.value) || 0)}
              min={0}
              step={1}
              style={inputStyle}
              aria-label="Visitas mínimas"
            />
            <input
              type="number"
              value={row.multiplier}
              onChange={(e) => updateRow(row.id, 'multiplier', parseFloat(e.target.value) || 1)}
              min={0.1}
              max={10}
              step={0.1}
              style={inputStyle}
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
              style={inputStyle}
              aria-label="Desconto (%)"
            />
            <button
              type="button"
              onClick={() => removeRank(row.id)}
              disabled={rows.length <= 1}
              style={{
                backgroundColor: 'transparent',
                color: rows.length <= 1 ? '#d1d5db' : '#dc2626',
                border: '1px solid',
                borderColor: rows.length <= 1 ? '#d1d5db' : '#fca5a5',
                padding: '0.375rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: rows.length <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              Remover
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={addRank}
          style={{
            backgroundColor: 'transparent',
            color: '#374151',
            border: '1px solid #d1d5db',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            fontSize: '0.875rem',
            cursor: 'pointer',
          }}
        >
          Adicionar nível
        </button>

        <button
          type="submit"
          disabled={pending}
          style={{
            backgroundColor: '#111827',
            color: '#ffffff',
            padding: '0.5rem 1.25rem',
            border: 'none',
            borderRadius: '4px',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: pending ? 'not-allowed' : 'pointer',
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? 'Salvando...' : 'Salvar níveis'}
        </button>
      </div>
    </form>
  )
}
