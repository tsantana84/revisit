'use client'

import { useState, useEffect, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Manager {
  id: string
  user_id: string
  role: string
  created_at: string
  email?: string // populated from local state after creation
}

// ---------------------------------------------------------------------------
// Team management page — owner creates and views manager accounts
// ---------------------------------------------------------------------------

export default function TeamPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [managers, setManagers] = useState<Manager[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Fetch manager list
  // -------------------------------------------------------------------------

  const fetchManagers = useCallback(async () => {
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()
      if (!res.ok) {
        setListError(data.error ?? 'Erro ao carregar gerentes')
      } else {
        setManagers(data.staff ?? [])
      }
    } catch {
      setListError('Erro ao carregar gerentes')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchManagers()
  }, [fetchManagers])

  // -------------------------------------------------------------------------
  // Submit — create manager
  // -------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setSuccessMessage(null)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error ?? 'Erro ao criar gerente')
        return
      }

      // Success: clear form, show success, refresh list
      setSuccessMessage('Gerente criado com sucesso')
      setEmail('')
      setPassword('')

      // Refresh list and annotate the newly created manager with their email
      await fetchManagers()
      if (data.manager) {
        setManagers((prev) =>
          prev.map((m) =>
            m.user_id === data.manager.id ? { ...m, email: data.manager.email } : m
          )
        )
      }
    } catch {
      setErrorMessage('Erro ao criar gerente')
    } finally {
      setLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem', color: '#111827' }}>
        Equipe
      </h1>

      {/* Create manager form */}
      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Adicionar Gerente
        </h2>

        <form
          onSubmit={handleSubmit}
          style={{
            backgroundColor: '#ffffff',
            padding: '1.5rem',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="email" style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="password" style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Mínimo 8 caracteres</span>
          </div>

          {successMessage && (
            <p style={{ fontSize: '0.875rem', color: '#059669', backgroundColor: '#d1fae5', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
              {successMessage}
            </p>
          )}

          {errorMessage && (
            <p style={{ fontSize: '0.875rem', color: '#dc2626', backgroundColor: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '4px' }}>
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? '#9ca3af' : '#111827',
              color: '#ffffff',
              padding: '0.625rem 1rem',
              borderRadius: '6px',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            {loading ? 'Criando...' : 'Criar Gerente'}
          </button>
        </form>
      </section>

      {/* Manager list */}
      <section>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Gerentes
        </h2>

        {listLoading ? (
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Carregando...</p>
        ) : listError ? (
          <p style={{ fontSize: '0.875rem', color: '#dc2626' }}>{listError}</p>
        ) : managers.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Nenhum gerente cadastrado</p>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.875rem',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th
                  style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: '600', color: '#374151' }}
                >
                  Identificador
                </th>
                <th
                  style={{ textAlign: 'left', padding: '0.75rem 1rem', fontWeight: '600', color: '#374151' }}
                >
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody>
              {managers.map((manager, index) => (
                <tr
                  key={manager.id}
                  style={{ borderBottom: index < managers.length - 1 ? '1px solid #e5e7eb' : 'none' }}
                >
                  <td style={{ padding: '0.75rem 1rem', color: '#374151' }}>
                    {manager.email ?? manager.user_id.slice(0, 8) + '...'}
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: '#6b7280' }}>
                    {new Date(manager.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
