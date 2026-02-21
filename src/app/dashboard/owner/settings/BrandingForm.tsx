'use client'

import { useActionState } from 'react'
import { updateBranding, type BrandingState } from '@/lib/actions/restaurant'

interface Restaurant {
  id: string
  program_name: string | null
  primary_color: string
  secondary_color: string
  logo_url: string | null
  earn_rate: number
  reward_type: 'cashback' | 'free_product' | 'progressive_discount'
  point_expiry_days: number | null
}

interface BrandingFormProps {
  restaurant: Restaurant
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db',
  borderRadius: '4px',
  fontSize: '0.875rem',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.875rem',
  fontWeight: '500',
  marginBottom: '0.25rem',
  color: '#374151',
}

const errorStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '0.75rem',
  marginTop: '0.25rem',
}

const fieldStyle: React.CSSProperties = {
  marginBottom: '1rem',
}

export function BrandingForm({ restaurant }: BrandingFormProps) {
  const [state, action, pending] = useActionState<BrandingState, FormData>(
    updateBranding,
    undefined
  )

  return (
    <form action={action}>
      {state?.message && !state?.errors && (
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

      <div style={fieldStyle}>
        <label htmlFor="program_name" style={labelStyle}>
          Nome do programa
        </label>
        <input
          id="program_name"
          name="program_name"
          type="text"
          defaultValue={restaurant.program_name ?? ''}
          style={inputStyle}
          maxLength={100}
          required
        />
        {state?.errors?.program_name && (
          <p style={errorStyle}>{state.errors.program_name[0]}</p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="primary_color" style={labelStyle}>
            Cor primária
          </label>
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            defaultValue={restaurant.primary_color}
            style={{ width: '100%', height: '2.5rem', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
          />
          {state?.errors?.primary_color && (
            <p style={errorStyle}>{state.errors.primary_color[0]}</p>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <label htmlFor="secondary_color" style={labelStyle}>
            Cor secundária
          </label>
          <input
            id="secondary_color"
            name="secondary_color"
            type="color"
            defaultValue={restaurant.secondary_color}
            style={{ width: '100%', height: '2.5rem', borderRadius: '4px', border: '1px solid #d1d5db', cursor: 'pointer' }}
          />
          {state?.errors?.secondary_color && (
            <p style={errorStyle}>{state.errors.secondary_color[0]}</p>
          )}
        </div>
      </div>

      <div style={fieldStyle}>
        <label htmlFor="earn_rate" style={labelStyle}>
          Pontos por R$1 gasto
        </label>
        <input
          id="earn_rate"
          name="earn_rate"
          type="number"
          defaultValue={restaurant.earn_rate}
          min={1}
          max={100}
          step={1}
          style={inputStyle}
        />
        {state?.errors?.earn_rate && (
          <p style={errorStyle}>{state.errors.earn_rate[0]}</p>
        )}
      </div>

      <div style={fieldStyle}>
        <label htmlFor="reward_type" style={labelStyle}>
          Tipo de recompensa
        </label>
        <select
          id="reward_type"
          name="reward_type"
          defaultValue={restaurant.reward_type}
          style={inputStyle}
        >
          <option value="cashback">Cashback</option>
          <option value="free_product">Produto Grátis</option>
          <option value="progressive_discount">Desconto Progressivo</option>
        </select>
        {state?.errors?.reward_type && (
          <p style={errorStyle}>{state.errors.reward_type[0]}</p>
        )}
      </div>

      <div style={fieldStyle}>
        <label htmlFor="point_expiry_days" style={labelStyle}>
          Dias para expirar pontos
        </label>
        <input
          id="point_expiry_days"
          name="point_expiry_days"
          type="number"
          defaultValue={restaurant.point_expiry_days ?? ''}
          min={0}
          placeholder="Deixe vazio para nunca expirar"
          style={inputStyle}
        />
        {state?.errors?.point_expiry_days && (
          <p style={errorStyle}>{state.errors.point_expiry_days[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        style={{
          backgroundColor: '#111827',
          color: '#ffffff',
          padding: '0.625rem 1.25rem',
          border: 'none',
          borderRadius: '4px',
          fontSize: '0.875rem',
          fontWeight: '500',
          cursor: pending ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </form>
  )
}
