'use client'

import { useActionState, useState } from 'react'
import { saveCardImage, removeCardImage, type CardDesignState } from '@/lib/actions/restaurant'

interface CardDesignFormProps {
  cardImageUrl: string | null
  primaryColor: string
  secondaryColor: string
}

function CardPreview({ imageUrl, restaurantName }: { imageUrl: string; restaurantName?: string }) {
  return (
    <div
      className="w-full aspect-[1.586] rounded-2xl overflow-hidden relative"
      style={{
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute inset-0 p-6 flex flex-col justify-between">
        <div>
          <div className="inline-block bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest uppercase text-white mb-3">
            {restaurantName ?? 'Bronze'}
          </div>
          <div
            className="text-xl font-extrabold text-white tracking-tight"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
          >
            João Silva
          </div>
          <div
            className="text-sm text-white/70 font-light"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
          >
            1.250 pontos
          </div>
        </div>
        <div
          className="text-[20px] font-bold tracking-[3px] font-mono text-white/80"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
        >
          #0001-9
        </div>
      </div>
    </div>
  )
}

export function CardDesignForm({ cardImageUrl, primaryColor, secondaryColor }: CardDesignFormProps) {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  const [saveState, saveAction, isSaving] = useActionState<CardDesignState, FormData>(saveCardImage, undefined)
  const [removeState, removeAction, isRemoving] = useActionState<CardDesignState, FormData>(removeCardImage, undefined)

  async function handleGenerate() {
    if (prompt.trim().length < 5) {
      setError('O prompt deve ter pelo menos 5 caracteres')
      return
    }

    setGenerating(true)
    setError(null)
    setPreviewUrl(null)

    try {
      const res = await fetch('/api/generate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), primaryColor, secondaryColor }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao gerar imagem')
        return
      }

      setPreviewUrl(data.url)
      setShowPrompt(false)
    } catch {
      setError('Erro de conexão ao gerar imagem')
    } finally {
      setGenerating(false)
    }
  }

  // Show saved card
  if (cardImageUrl && !previewUrl && !showPrompt) {
    return (
      <div className="db-card p-6 space-y-4">
        <p className="text-sm text-db-text-muted mb-2">Design atual do cartão:</p>
        <CardPreview imageUrl={cardImageUrl} />

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowPrompt(true)}
            className="text-sm text-db-accent hover:underline cursor-pointer"
            disabled={generating}
          >
            Gerar novo design
          </button>
          <form action={removeAction}>
            <button
              type="submit"
              disabled={isRemoving}
              className="text-sm text-red-400 hover:underline cursor-pointer disabled:opacity-40"
            >
              {isRemoving ? 'Removendo...' : 'Remover'}
            </button>
          </form>
        </div>

        {removeState?.message && !removeState.success && (
          <p className="text-sm text-red-400">{removeState.message}</p>
        )}
        {removeState?.success && (
          <p className="text-sm text-green-400">{removeState.message}</p>
        )}
      </div>
    )
  }

  // Show preview of generated image
  if (previewUrl) {
    return (
      <div className="db-card p-6 space-y-4">
        <p className="text-sm text-db-text-muted mb-2">Pré-visualização:</p>
        <CardPreview imageUrl={previewUrl} />

        <div className="flex gap-3 pt-2">
          <form action={saveAction}>
            <input type="hidden" name="imageUrl" value={previewUrl} />
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-db-accent text-white rounded-lg text-sm font-semibold cursor-pointer hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isSaving ? 'Salvando...' : 'Salvar Design'}
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setPreviewUrl(null)
              setShowPrompt(true)
              setError(null)
            }}
            className="px-5 py-2.5 bg-db-surface-secondary text-db-text-secondary rounded-lg text-sm font-semibold cursor-pointer hover:opacity-80 transition-opacity"
          >
            Gerar Novamente
          </button>
        </div>

        {saveState?.message && !saveState.success && (
          <p className="text-sm text-red-400">{saveState.message}</p>
        )}
        {saveState?.success && (
          <p className="text-sm text-green-400">{saveState.message}</p>
        )}
      </div>
    )
  }

  // Generating state — skeleton card
  if (generating) {
    return (
      <div className="db-card p-6 space-y-4">
        <div className="w-full aspect-[1.586] rounded-2xl overflow-hidden relative bg-db-surface-secondary animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-transparent" />
          <div className="absolute inset-0 p-6 flex flex-col justify-between">
            <div>
              <div className="h-5 w-16 rounded-full bg-white/10 mb-3" />
              <div className="h-6 w-32 rounded bg-white/10 mb-2" />
              <div className="h-4 w-20 rounded bg-white/10" />
            </div>
            <div className="h-6 w-36 rounded bg-white/10" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-db-text-muted">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Gerando design com IA... isso pode levar até 20 segundos
          </div>
        </div>
      </div>
    )
  }

  const templates = [
    { label: 'Japonês', prompt: 'Estética elegante de restaurante japonês com padrões de carpas koi, texturas de bambu e gradientes de tinta nanquim' },
    { label: 'Italiano', prompt: 'Visual acolhedor de trattoria italiana com tons de terracota, padrões de ramos de oliveira e texturas rústicas mediterrâneas' },
    { label: 'Churrascaria', prompt: 'Estética premium de churrascaria com texturas de couro escuro, brilho de brasas e gradientes de carvão defumado' },
    { label: 'Padaria', prompt: 'Padaria artesanal aconchegante com tons dourados, texturas de farinha e padrões de grãos de trigo' },
    { label: 'Cafeteria', prompt: 'Cafeteria moderna com gradientes de espresso, desenhos de latte art e tons quentes de marrom' },
    { label: 'Pizzaria', prompt: 'Pizzaria vibrante com brilho de forno a lenha, detalhes em vermelho tomate e texturas de tijolo rústico' },
    { label: 'Hamburgueria', prompt: 'Estética ousada de hamburgueria com grelhas esfumaçadas, brilhos neon e texturas industriais escuras' },
    { label: 'Frutos do Mar', prompt: 'Restaurante de frutos do mar com gradientes azul profundo, padrões de ondas e detalhes de pérola e coral' },
  ]

  // Prompt input
  return (
    <div className="db-card p-6 space-y-4">
      <p className="text-sm text-db-text-muted">
        Escolha um modelo ou descreva o visual desejado para o cartão de fidelidade.
      </p>

      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setPrompt(t.prompt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              prompt === t.prompt
                ? 'bg-db-accent text-white border-db-accent'
                : 'bg-db-surface-secondary text-db-text-secondary border-db-border hover:border-db-accent/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ou descreva seu próprio estilo..."
        rows={3}
        maxLength={500}
        className="db-input w-full resize-none"
        disabled={generating}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || prompt.trim().length < 5}
          className="px-5 py-2.5 bg-db-accent text-white rounded-lg text-sm font-semibold cursor-pointer hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          Gerar Design
        </button>
        <span className="text-xs text-db-text-muted">{prompt.length}/500</span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
