'use client'

import { useState, useEffect, useCallback } from 'react'

interface Manager {
  id: string
  user_id: string
  role: string
  created_at: string
  email?: string
}

export default function TeamPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [managers, setManagers] = useState<Manager[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

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

      setSuccessMessage('Gerente criado com sucesso')
      setEmail('')
      setPassword('')

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

  return (
    <div className="max-w-[640px]">
      <h1 className="text-2xl font-bold text-db-text mb-8">
        Equipe
      </h1>

      {/* Create manager form */}
      <section className="mb-12">
        <h2 className="text-lg font-semibold text-db-text-secondary mb-4">
          Adicionar Gerente
        </h2>

        <form
          onSubmit={handleSubmit}
          className="db-card p-6 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-db-text-secondary">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
              className="db-input"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-db-text-secondary">
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="db-input"
            />
            <span className="text-xs text-db-text-muted">Mínimo 8 caracteres</span>
          </div>

          {successMessage && (
            <p className="text-sm text-db-success bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
              {successMessage}
            </p>
          )}

          {errorMessage && (
            <p className="text-sm text-db-error bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="self-start rounded-lg bg-db-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-db-accent-hover disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Criando...' : 'Criar Gerente'}
          </button>
        </form>
      </section>

      {/* Manager list */}
      <section>
        <h2 className="text-lg font-semibold text-db-text-secondary mb-4">
          Gerentes
        </h2>

        {listLoading ? (
          <p className="text-sm text-db-text-muted">Carregando...</p>
        ) : listError ? (
          <p className="text-sm text-db-error">{listError}</p>
        ) : managers.length === 0 ? (
          <p className="text-sm text-db-text-muted">Nenhum gerente cadastrado</p>
        ) : (
          <div className="db-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-db-border">
                  <th className="text-left px-4 py-3 font-medium text-db-text-muted text-xs uppercase tracking-wider">
                    Identificador
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-db-text-muted text-xs uppercase tracking-wider">
                    Criado em
                  </th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager) => (
                  <tr
                    key={manager.id}
                    className="border-b border-db-border last:border-b-0 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 text-db-text">
                      {manager.email ?? manager.user_id.slice(0, 8) + '...'}
                    </td>
                    <td className="px-4 py-3 text-db-text-muted">
                      {new Date(manager.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
