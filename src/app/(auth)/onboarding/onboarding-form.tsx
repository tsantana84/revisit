'use client'

import { useActionState } from 'react'
import { completeOnboarding } from '@/lib/actions/auth'

export default function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, undefined)

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-[var(--color-db-text)]">
        Bem-vindo ao Revisit!
      </h2>
      <p className="mb-6 text-sm text-[var(--color-db-text-muted)]">
        Para começar, informe o nome do seu restaurante.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="restaurantName"
            className="mb-1 block text-sm font-medium text-[var(--color-db-text-secondary)]"
          >
            Nome do Restaurante
          </label>
          <input
            id="restaurantName"
            name="restaurantName"
            type="text"
            required
            className="db-input w-full"
          />
          {state?.errors?.restaurantName && (
            <p className="mt-1 text-sm text-[var(--color-db-error)]">
              {state.errors.restaurantName[0]}
            </p>
          )}
        </div>

        {state?.message && (
          <p role="alert" className="text-sm text-[var(--color-db-error)]">
            {state.message}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-linear-to-r from-indigo-500 to-violet-500 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Configurando...' : 'Começar'}
        </button>
      </form>
    </div>
  )
}
