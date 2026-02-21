'use client'

import { useActionState } from 'react'
import { uploadLogo, type LogoState } from '@/lib/actions/restaurant'

interface LogoFormProps {
  logoUrl: string | null
  programName: string | null
}

export function LogoForm({ logoUrl, programName }: LogoFormProps) {
  const [state, action, pending] = useActionState<LogoState, FormData>(
    uploadLogo,
    undefined
  )

  return (
    <form action={action}>
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

      {logoUrl && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            Logo atual:
          </p>
          <img
            src={logoUrl}
            alt={programName ?? 'Logo'}
            style={{
              maxWidth: '200px',
              maxHeight: '100px',
              objectFit: 'contain',
              border: '1px solid #e5e7eb',
              borderRadius: '4px',
              padding: '0.5rem',
            }}
          />
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="logo"
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            marginBottom: '0.25rem',
            color: '#374151',
          }}
        >
          Enviar novo logo
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          style={{ fontSize: '0.875rem' }}
        />
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
          JPEG, PNG, WebP ou SVG. Máximo 1MB.
        </p>
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
        {pending ? 'Enviando...' : 'Atualizar logo'}
      </button>
    </form>
  )
}
