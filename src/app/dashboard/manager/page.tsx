'use client'

import { useActionState, useState } from 'react'
import { lookupCustomer, registerSale } from '@/lib/actions/pos'
import { registerRedemption, checkRewardForCurrentManager } from '@/lib/actions/rewards'
import { validateCardNumber } from '@/lib/utils/card-number'
import type { LookupState, SaleState } from '@/lib/actions/pos'
import type { RedemptionState, RewardInfo } from '@/lib/actions/rewards'

// ---------------------------------------------------------------------------
// RewardSection — displayed after successful sale
// ---------------------------------------------------------------------------

function RewardSection({ cardNumber }: { cardNumber: string }) {
  const [rewardInfo, setRewardInfo] = useState<RewardInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [redemptionState, redemptionAction, redemptionPending] = useActionState<
    RedemptionState,
    FormData
  >(registerRedemption, undefined)

  async function handleCheckReward() {
    setLoading(true)
    try {
      const info = await checkRewardForCurrentManager(cardNumber)
      setRewardInfo(info)
    } catch {
      setRewardInfo({ type: 'none' })
    } finally {
      setLoading(false)
    }
  }

  if (redemptionState?.step === 'success') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mt-4">
        <p className="text-db-success font-semibold m-0">
          {redemptionState.message}
        </p>
        <p className="text-emerald-300 mt-1 mb-0">
          Saldo atualizado: {redemptionState.newBalance} pontos
        </p>
      </div>
    )
  }

  if (!rewardInfo) {
    return (
      <div className="mt-5">
        <button
          onClick={handleCheckReward}
          disabled={loading}
          className="rounded-lg border border-db-border bg-white/[0.03] px-4 py-2.5 text-sm text-db-text-secondary transition-colors hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
        >
          {loading ? 'Verificando...' : 'Verificar Recompensa'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mt-4">
      <p className="font-semibold text-amber-300 mt-0 mb-2">
        Recompensas disponíveis
      </p>

      {rewardInfo.type === 'cashback' && (
        <div>
          <p className="m-0 text-db-text">
            Crédito disponível:{' '}
            <strong>R$ {rewardInfo.availableCredit.toFixed(2)}</strong>
          </p>
          <p className="mt-1 mb-0 text-db-text-muted text-sm">
            Saldo: {rewardInfo.pointsBalance} pontos
          </p>
        </div>
      )}

      {rewardInfo.type === 'free_product' && rewardInfo.available && (
        <div>
          <p className="mb-3 mt-0 text-db-text">
            Recompensa disponível: <strong>{rewardInfo.rewardName}</strong>
          </p>
          <form action={redemptionAction}>
            <input type="hidden" name="card_number" value={cardNumber} />
            <input type="hidden" name="reward_config_id" value={rewardInfo.rewardId} />
            <input type="hidden" name="reward_type" value="free_product" />
            <button
              type="submit"
              disabled={redemptionPending}
              className="rounded-lg bg-db-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-db-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {redemptionPending ? 'Resgatando...' : 'Resgatar'}
            </button>
          </form>
        </div>
      )}

      {rewardInfo.type === 'free_product' && !rewardInfo.available && (
        <p className="m-0 text-db-text-muted">
          Sem recompensas disponíveis ainda.
        </p>
      )}

      {rewardInfo.type === 'progressive_discount' && (
        <p className="m-0 text-db-text">
          Desconto de{' '}
          <strong>{rewardInfo.discountPct}%</strong>{' '}
          ({rewardInfo.rankName}) — aplicar na compra
        </p>
      )}

      {rewardInfo.type === 'none' && (
        <p className="m-0 text-db-text-muted">Nenhuma recompensa configurada.</p>
      )}

      {redemptionState?.step === 'error' && (
        <p className="text-db-error mt-2 mb-0">
          {redemptionState.message}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manager POS Page
// ---------------------------------------------------------------------------

export default function ManagerDashboardPage() {
  const [cardInput, setCardInput] = useState('')
  const [cancelled, setCancelled] = useState(false)

  const [lookupState, lookupAction, lookupPending] = useActionState<LookupState, FormData>(
    lookupCustomer,
    undefined
  )
  const [saleState, saleAction, salePending] = useActionState<SaleState, FormData>(
    registerSale,
    undefined
  )

  function handleCancel() {
    setCancelled(true)
    setCardInput('')
  }

  function handleNewSale() {
    window.location.reload()
  }

  const showPhase3 = saleState?.step === 'success'
  const showPhase2 =
    !cancelled &&
    lookupState?.step === 'preview' &&
    saleState?.step !== 'success'

  const cardInputHasError =
    cardInput.length >= 7 && !validateCardNumber(cardInput)

  // ---------------------------------------------------------------------------
  // Phase 3: Success
  // ---------------------------------------------------------------------------
  if (showPhase3 && saleState.step === 'success') {
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-db-text mb-6">
          Registrar Venda
        </h1>

        <div className="db-card p-8">
          {/* Success banner */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-5">
            <p className="text-db-success font-bold text-lg mb-1">
              Venda registrada com sucesso!
            </p>
            <p className="text-emerald-300 m-0">
              {saleState.pointsEarned} pontos creditados para {saleState.customerName}
            </p>
          </div>

          {/* Current balance */}
          <p className="text-db-text-secondary mb-3">
            Saldo atual: <strong className="text-db-text">{saleState.newBalance} pontos</strong>
          </p>

          {/* Rank promotion notice */}
          {saleState.rankPromoted && saleState.newRankName && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
              <p className="text-amber-300 font-bold m-0">
                Cliente promovido para {saleState.newRankName}!
              </p>
            </div>
          )}

          {/* Reward section */}
          {lookupState?.step === 'preview' && (
            <RewardSection cardNumber={lookupState.cardNumber} />
          )}

          <button
            onClick={handleNewSale}
            className="w-full mt-6 rounded-xl bg-db-accent px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-db-accent-hover cursor-pointer min-h-[44px]"
          >
            Nova Venda
          </button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Sale Confirmation
  // ---------------------------------------------------------------------------
  if (showPhase2 && lookupState?.step === 'preview') {
    const preview = lookupState
    return (
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-db-text mb-6">
          Registrar Venda
        </h1>

        {/* Customer info card */}
        <div className="db-card p-6 mb-4">
          <p className="text-xl font-bold text-db-text mb-1">
            {preview.customerName}
          </p>
          <span className="inline-block bg-db-accent/20 text-db-accent rounded-full px-3 py-0.5 text-xs font-semibold mb-3">
            {preview.currentRank}
          </span>
          <p className="text-db-text-muted text-sm m-0">
            Saldo atual: {preview.pointsBalance} pontos
          </p>
        </div>

        {/* Confirmation form */}
        <div className="db-card p-6">
          <p className="text-db-text mb-4">
            Isso creditará{' '}
            <strong className="text-db-accent text-lg">
              {preview.pointsPreview} pontos
            </strong>{' '}
            para <strong>{preview.customerName}</strong>. Confirmar?
          </p>

          <form action={saleAction}>
            <input type="hidden" name="card_number" value={preview.cardNumber} />
            <input type="hidden" name="amount_cents" value={preview.amountCents} />
            <input type="hidden" name="staff_id" value={preview.staffId} />

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={salePending}
                className="flex-1 rounded-xl bg-db-accent px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-db-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer min-h-[44px]"
              >
                {salePending ? 'Processando...' : 'Confirmar Venda'}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="rounded-xl border border-db-border px-5 py-3.5 text-base font-semibold text-db-text-muted transition-colors hover:bg-white/[0.03] cursor-pointer min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </form>

          {saleState?.step === 'error' && (
            <p className="text-db-error mt-3 mb-0 text-sm">
              {saleState.message}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Card Lookup Form
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-db-text mb-6">
        Registrar Venda
      </h1>

      <div className="db-card p-6">
        <form action={lookupAction}>
          {/* Card number */}
          <div className="mb-4">
            <label
              htmlFor="card_number"
              className="block font-semibold text-db-text-secondary mb-1.5"
            >
              Número do cartão
            </label>
            <input
              id="card_number"
              name="card_number"
              type="text"
              placeholder="#0000-0"
              value={cardInput}
              onChange={(e) => {
                setCardInput(e.target.value)
                if (cancelled) setCancelled(false)
              }}
              className={`db-input w-full text-lg font-mono min-h-[44px] ${
                cardInputHasError ? 'border-db-error' : ''
              }`}
            />
            {cardInputHasError && (
              <p className="text-db-error text-sm mt-1">
                Formato inválido — use #XXXX-D (ex: #0001-9)
              </p>
            )}
          </div>

          {/* Sale value */}
          <div className="mb-5">
            <label
              htmlFor="amount"
              className="block font-semibold text-db-text-secondary mb-1.5"
            >
              Valor da venda (R$)
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              className="db-input w-full text-lg min-h-[44px]"
            />
          </div>

          <button
            type="submit"
            disabled={lookupPending || cardInputHasError}
            className="w-full rounded-xl bg-db-accent px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-db-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            {lookupPending ? 'Buscando...' : 'Buscar Cliente'}
          </button>
        </form>

        {lookupState?.step === 'error' && (
          <p className="text-db-error mt-3 mb-0 text-sm">
            {lookupState.message}
          </p>
        )}
      </div>
    </div>
  )
}
