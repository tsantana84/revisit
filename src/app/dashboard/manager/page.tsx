'use client'

import { useActionState, useState } from 'react'
import { lookupCustomer, registerSale } from '@/lib/actions/pos'
import { registerRedemption, checkRewardForCurrentManager } from '@/lib/actions/rewards'
import { validateCardNumber } from '@/lib/utils/card-number'
import type { LookupState, SaleState } from '@/lib/actions/pos'
import type { RedemptionState, RewardInfo } from '@/lib/actions/rewards'

// ---------------------------------------------------------------------------
// RewardSection — displayed after successful sale
// Calls checkRewardForCurrentManager which resolves restaurantId from JWT.
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
      <div
        style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginTop: '1rem',
        }}
      >
        <p style={{ color: '#16a34a', fontWeight: '600', margin: 0 }}>
          {redemptionState.message}
        </p>
        <p style={{ color: '#166534', margin: '0.25rem 0 0' }}>
          Saldo atualizado: {redemptionState.newBalance} pontos
        </p>
      </div>
    )
  }

  if (!rewardInfo) {
    return (
      <div style={{ marginTop: '1.25rem' }}>
        <button
          onClick={handleCheckReward}
          disabled={loading}
          style={{
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem',
          }}
        >
          {loading ? 'Verificando...' : 'Verificar Recompensa'}
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        backgroundColor: '#fefce8',
        border: '1px solid #fde68a',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginTop: '1rem',
      }}
    >
      <p style={{ fontWeight: '600', color: '#92400e', marginTop: 0, marginBottom: '0.5rem' }}>
        Recompensas disponíveis
      </p>

      {rewardInfo.type === 'cashback' && (
        <div>
          <p style={{ margin: 0, color: '#1c1917' }}>
            Crédito disponível:{' '}
            <strong>R$ {rewardInfo.availableCredit.toFixed(2)}</strong>
          </p>
          <p style={{ margin: '0.25rem 0 0', color: '#78716c', fontSize: '0.8rem' }}>
            Saldo: {rewardInfo.pointsBalance} pontos
          </p>
        </div>
      )}

      {rewardInfo.type === 'free_product' && rewardInfo.available && (
        <div>
          <p style={{ margin: '0 0 0.75rem', color: '#1c1917' }}>
            Recompensa disponível: <strong>{rewardInfo.rewardName}</strong>
          </p>
          <form action={redemptionAction}>
            <input type="hidden" name="card_number" value={cardNumber} />
            <input type="hidden" name="reward_config_id" value={rewardInfo.rewardId} />
            <input type="hidden" name="reward_type" value="free_product" />
            <button
              type="submit"
              disabled={redemptionPending}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: redemptionPending ? 'not-allowed' : 'pointer',
                fontWeight: '600',
              }}
            >
              {redemptionPending ? 'Resgatando...' : 'Resgatar'}
            </button>
          </form>
        </div>
      )}

      {rewardInfo.type === 'free_product' && !rewardInfo.available && (
        <p style={{ margin: 0, color: '#6b7280' }}>
          Sem recompensas disponíveis ainda.
        </p>
      )}

      {rewardInfo.type === 'progressive_discount' && (
        <p style={{ margin: 0, color: '#1c1917' }}>
          Desconto de{' '}
          <strong>{rewardInfo.discountPct}%</strong>{' '}
          ({rewardInfo.rankName}) — aplicar na compra
        </p>
      )}

      {rewardInfo.type === 'none' && (
        <p style={{ margin: 0, color: '#6b7280' }}>Nenhuma recompensa configurada.</p>
      )}

      {redemptionState?.step === 'error' && (
        <p style={{ color: '#dc2626', marginTop: '0.5rem', marginBottom: 0 }}>
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
    // Reload to clear all useActionState hooks — simplest reliable pattern
    window.location.reload()
  }

  // Determine current phase
  const showPhase3 = saleState?.step === 'success'
  const showPhase2 =
    !cancelled &&
    lookupState?.step === 'preview' &&
    saleState?.step !== 'success'

  // Client-side card validation feedback
  const cardInputHasError =
    cardInput.length >= 7 && !validateCardNumber(cardInput)

  // ---------------------------------------------------------------------------
  // Phase 3: Success
  // ---------------------------------------------------------------------------
  if (showPhase3 && saleState.step === 'success') {
    return (
      <div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            color: '#111827',
          }}
        >
          Registrar Venda
        </h1>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '2rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            maxWidth: '480px',
          }}
        >
          {/* Success banner */}
          <div
            style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
            }}
          >
            <p
              style={{
                color: '#16a34a',
                fontWeight: '700',
                fontSize: '1.1rem',
                margin: '0 0 0.25rem',
              }}
            >
              Venda registrada com sucesso!
            </p>
            <p style={{ color: '#166534', margin: 0 }}>
              {saleState.pointsEarned} pontos creditados para {saleState.customerName}
            </p>
          </div>

          {/* Current balance */}
          <p style={{ color: '#374151', marginBottom: '0.75rem' }}>
            Saldo atual: <strong>{saleState.newBalance} pontos</strong>
          </p>

          {/* Rank promotion notice */}
          {saleState.rankPromoted && saleState.newRankName && (
            <div
              style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fcd34d',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
              }}
            >
              <p style={{ color: '#92400e', fontWeight: '700', margin: 0 }}>
                Cliente promovido para {saleState.newRankName}!
              </p>
            </div>
          )}

          {/* Reward section — card number preserved from lookupState (still in hook state) */}
          {lookupState?.step === 'preview' && (
            <RewardSection cardNumber={lookupState.cardNumber} />
          )}

          <button
            onClick={handleNewSale}
            style={{
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '1rem',
              marginTop: '1.5rem',
              width: '100%',
            }}
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
      <div>
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            color: '#111827',
          }}
        >
          Registrar Venda
        </h1>

        {/* Customer info card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            marginBottom: '1rem',
            maxWidth: '480px',
          }}
        >
          <p
            style={{
              fontSize: '1.375rem',
              fontWeight: '700',
              color: '#111827',
              margin: '0 0 0.25rem',
            }}
          >
            {preview.customerName}
          </p>
          <span
            style={{
              display: 'inline-block',
              backgroundColor: '#dbeafe',
              color: '#1d4ed8',
              borderRadius: '9999px',
              padding: '0.2rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: '600',
              marginBottom: '0.75rem',
            }}
          >
            {preview.currentRank}
          </span>
          <p style={{ color: '#6b7280', margin: 0, fontSize: '0.9rem' }}>
            Saldo atual: {preview.pointsBalance} pontos
          </p>
        </div>

        {/* Confirmation form */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
            maxWidth: '480px',
          }}
        >
          <p style={{ color: '#111827', fontSize: '1rem', marginTop: 0 }}>
            Isso creditará{' '}
            <strong style={{ color: '#2563eb', fontSize: '1.1rem' }}>
              {preview.pointsPreview} pontos
            </strong>{' '}
            para <strong>{preview.customerName}</strong>. Confirmar?
          </p>

          <form action={saleAction}>
            <input type="hidden" name="card_number" value={preview.cardNumber} />
            <input type="hidden" name="amount_cents" value={preview.amountCents} />
            <input type="hidden" name="staff_id" value={preview.staffId} />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                disabled={salePending}
                style={{
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '6px',
                  cursor: salePending ? 'not-allowed' : 'pointer',
                  fontWeight: '700',
                  fontSize: '1rem',
                  flex: 1,
                }}
              >
                {salePending ? 'Processando...' : 'Confirmar Venda'}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                style={{
                  backgroundColor: 'transparent',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Cancelar
              </button>
            </div>
          </form>

          {saleState?.step === 'error' && (
            <p
              style={{
                color: '#dc2626',
                marginTop: '0.75rem',
                marginBottom: 0,
                fontSize: '0.9rem',
              }}
            >
              {saleState.message}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Phase 1: Card Lookup Form (default / after cancel / after error)
  // ---------------------------------------------------------------------------
  return (
    <div>
      <h1
        style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          color: '#111827',
        }}
      >
        Registrar Venda
      </h1>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
          maxWidth: '480px',
        }}
      >
        <form action={lookupAction}>
          {/* Card number */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="card_number"
              style={{
                display: 'block',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.4rem',
              }}
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
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: `1px solid ${cardInputHasError ? '#dc2626' : '#d1d5db'}`,
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            {cardInputHasError && (
              <p style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
                Formato inválido — use #XXXX-D (ex: #0001-9)
              </p>
            )}
          </div>

          {/* Sale value */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label
              htmlFor="amount"
              style={{
                display: 'block',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.4rem',
              }}
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
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '1rem',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={lookupPending || cardInputHasError}
            style={{
              backgroundColor: lookupPending || cardInputHasError ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '6px',
              cursor: lookupPending || cardInputHasError ? 'not-allowed' : 'pointer',
              fontWeight: '700',
              fontSize: '1rem',
              width: '100%',
            }}
          >
            {lookupPending ? 'Buscando...' : 'Buscar Cliente'}
          </button>
        </form>

        {lookupState?.step === 'error' && (
          <p
            style={{
              color: '#dc2626',
              marginTop: '0.75rem',
              marginBottom: 0,
              fontSize: '0.9rem',
            }}
          >
            {lookupState.message}
          </p>
        )}
      </div>
    </div>
  )
}
