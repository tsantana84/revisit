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

export function BrandingForm({ restaurant }: BrandingFormProps) {
  const [state, action, pending] = useActionState<BrandingState, FormData>(
    updateBranding,
    undefined
  )

  return (
    <form action={action}>
      {state?.message && !state?.errors && (
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

      <div className="mb-4">
        <label htmlFor="program_name" className="block text-sm font-medium text-db-text-secondary mb-1">
          Nome do programa
        </label>
        <input
          id="program_name"
          name="program_name"
          type="text"
          defaultValue={restaurant.program_name ?? ''}
          className="db-input w-full"
          maxLength={100}
          required
        />
        {state?.errors?.program_name && (
          <p className="text-db-error text-xs mt-1">{state.errors.program_name[0]}</p>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label htmlFor="primary_color" className="block text-sm font-medium text-db-text-secondary mb-1">
            Cor primária
          </label>
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            defaultValue={restaurant.primary_color}
            className="w-full h-10 rounded-lg border border-db-border bg-db-surface cursor-pointer"
          />
          {state?.errors?.primary_color && (
            <p className="text-db-error text-xs mt-1">{state.errors.primary_color[0]}</p>
          )}
        </div>

        <div className="flex-1">
          <label htmlFor="secondary_color" className="block text-sm font-medium text-db-text-secondary mb-1">
            Cor secundária
          </label>
          <input
            id="secondary_color"
            name="secondary_color"
            type="color"
            defaultValue={restaurant.secondary_color}
            className="w-full h-10 rounded-lg border border-db-border bg-db-surface cursor-pointer"
          />
          {state?.errors?.secondary_color && (
            <p className="text-db-error text-xs mt-1">{state.errors.secondary_color[0]}</p>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="earn_rate" className="block text-sm font-medium text-db-text-secondary mb-1">
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
          className="db-input w-full"
        />
        {state?.errors?.earn_rate && (
          <p className="text-db-error text-xs mt-1">{state.errors.earn_rate[0]}</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="reward_type" className="block text-sm font-medium text-db-text-secondary mb-1">
          Tipo de recompensa
        </label>
        <select
          id="reward_type"
          name="reward_type"
          defaultValue={restaurant.reward_type}
          className="db-input w-full"
        >
          <option value="cashback">Cashback</option>
          <option value="free_product">Produto Grátis</option>
          <option value="progressive_discount">Desconto Progressivo</option>
        </select>
        {state?.errors?.reward_type && (
          <p className="text-db-error text-xs mt-1">{state.errors.reward_type[0]}</p>
        )}
      </div>

      <div className="mb-4">
        <label htmlFor="point_expiry_days" className="block text-sm font-medium text-db-text-secondary mb-1">
          Dias para expirar pontos
        </label>
        <input
          id="point_expiry_days"
          name="point_expiry_days"
          type="number"
          defaultValue={restaurant.point_expiry_days ?? ''}
          min={0}
          placeholder="Deixe vazio para nunca expirar"
          className="db-input w-full"
        />
        {state?.errors?.point_expiry_days && (
          <p className="text-db-error text-xs mt-1">{state.errors.point_expiry_days[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-db-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-db-accent-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {pending ? 'Salvando...' : 'Salvar configurações'}
      </button>
    </form>
  )
}
