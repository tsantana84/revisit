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
          className={`px-3 py-2.5 rounded-lg mb-4 text-sm ${
            state.success
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-db-success'
              : 'bg-red-500/10 border border-red-500/20 text-db-error'
          }`}
        >
          {state.message}
        </p>
      )}

      {logoUrl && (
        <div className="mb-4">
          <p className="text-sm text-db-text-muted mb-2">
            Logo atual:
          </p>
          <img
            src={logoUrl}
            alt={programName ?? 'Logo'}
            className="max-w-[200px] max-h-[100px] object-contain border border-db-border rounded-lg p-2"
          />
        </div>
      )}

      <div className="mb-4">
        <label
          htmlFor="logo"
          className="block text-sm font-medium text-db-text-secondary mb-1"
        >
          Enviar novo logo
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/svg+xml"
          className="text-sm text-db-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-db-accent/20 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-db-accent file:cursor-pointer hover:file:bg-db-accent/30"
        />
        <p className="text-xs text-db-text-muted mt-1">
          JPEG, PNG, WebP ou SVG. Máximo 1MB.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-db-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-db-accent-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {pending ? 'Enviando...' : 'Atualizar logo'}
      </button>
    </form>
  )
}
