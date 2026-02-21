'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import { login } from '@/lib/actions/auth'
import { Suspense } from 'react'

function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const searchParams = useSearchParams()
  const signupSuccess = searchParams.get('signup') === 'success'

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
        Entrar
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
          {pending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem' }}>
        Não tem conta?{' '}
        <a href="/signup" style={{ color: '#000000', fontWeight: '500' }}>
          Criar conta
        </a>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
