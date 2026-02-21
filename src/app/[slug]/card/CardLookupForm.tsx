'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateCardNumber } from '@/lib/utils/card-number'

function formatCardInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 5)
  if (digits.length > 4) return `#${digits.slice(0, 4)}-${digits.slice(4)}`
  if (digits.length > 0) return `#${digits}`
  return ''
}

export function CardLookupForm() {
  const router = useRouter()
  const [display, setDisplay] = useState('')
  const [error, setError] = useState('')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCardInput(e.target.value)
    setDisplay(formatted)
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = display.trim()
    if (!validateCardNumber(value)) {
      setError('Número de cartão inválido. Use o formato #XXXX-X')
      return
    }
    router.push(`?n=${encodeURIComponent(value)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-[380px] mx-auto">
      <div className="mb-4">
        <label htmlFor="card-number" className="block text-sm font-semibold text-text-primary mb-2">
          Número do cartão
        </label>
        <input
          id="card-number"
          type="text"
          inputMode="numeric"
          placeholder="#0001-9"
          value={display}
          onChange={handleChange}
          autoFocus
          className={`w-full px-4 py-3.5 border-[1.5px] rounded-xl text-base text-text-primary outline-none transition-all duration-200 bg-surface-secondary/50 placeholder:text-text-muted/50 text-center text-xl font-mono tracking-[3px] ${
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
              : 'border-transparent focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10 focus:bg-white'
          }`}
        />
        {error && (
          <div className="text-red-500 text-[13px] mt-1.5 ml-1">{error}</div>
        )}
      </div>

      <button
        type="submit"
        className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base cursor-pointer hover:opacity-90 transition-all duration-200"
      >
        Consultar
      </button>
    </form>
  )
}
