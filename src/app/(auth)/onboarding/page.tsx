'use client'

import { useActionState } from 'react'
import { completeOnboarding } from '@/lib/actions/auth'

export default function OnboardingPage() {
  const [state, action, pending] = useActionState(completeOnboarding, undefined)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: '400px', width: '100%', padding: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
          Bem-vindo ao Revisit!
        </h1>
        <p style={{ marginBottom: '1.5rem', color: '#6b7280', fontSize: '0.875rem' }}>
          Para começar, informe o nome do seu restaurante.
        </p>

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label htmlFor="restaurantName" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
              Nome do Restaurante
            </label>
            <input
              id="restaurantName"
              name="restaurantName"
              type="text"
              required
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
            />
            {state?.errors?.restaurantName && (
              <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {state.errors.restaurantName[0]}
              </p>
            )}
          </div>

          {state?.message && (
            <p role="alert" style={{ color: '#dc2626', fontSize: '0.875rem' }}>
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '0.75rem',
              borderRadius: '4px',
              border: 'none',
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.6 : 1,
              fontWeight: '500',
            }}
          >
            {pending ? 'Configurando...' : 'Começar'}
          </button>
        </form>
      </div>
    </div>
  )
}
