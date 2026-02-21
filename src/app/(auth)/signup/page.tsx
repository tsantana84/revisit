'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { signup } from '@/lib/actions/auth'
import { Suspense } from 'react'

function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined)
  const searchParams = useSearchParams()
  const signupSuccess = searchParams.get('signup') === 'success'

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
        Criar conta
      </h1>

      {signupSuccess && (
        <div
          role="status"
          style={{
            backgroundColor: '#d1fae5',
            color: '#065f46',
            padding: '0.75rem',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          Conta criada com sucesso! Faça login para continuar.
        </div>
      )}

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

        <div>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          {state?.errors?.email && (
            <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {state.errors.email[0]}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px', boxSizing: 'border-box' }}
          />
          {state?.errors?.password && (
            <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {state.errors.password[0]}
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
          {pending ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>

      <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
        Já tem uma conta?{' '}
        <a href="/login" style={{ color: '#000000', fontWeight: '500' }}>
          Entrar
        </a>
      </p>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  )
}
