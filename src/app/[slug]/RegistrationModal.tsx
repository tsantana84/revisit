'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { registerCustomer } from '@/lib/actions/customer'

// ---------------------------------------------------------------------------
// Phone formatting
// ---------------------------------------------------------------------------

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length > 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return digits
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RegistrationModalProps {
  restaurantName: string
  primaryColor: string
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Submit button with pending state
// ---------------------------------------------------------------------------

function SubmitButton({ primaryColor, isPending }: { primaryColor: string; isPending: boolean }) {
  return (
    <button
      type="submit"
      disabled={isPending}
      style={{
        backgroundColor: isPending ? '#999' : primaryColor,
        color: '#ffffff',
        border: 'none',
        borderRadius: '8px',
        padding: '14px 24px',
        fontSize: '17px',
        fontWeight: '700',
        cursor: isPending ? 'not-allowed' : 'pointer',
        width: '100%',
        transition: 'background-color 0.2s',
      }}
    >
      {isPending ? 'Cadastrando...' : 'Cadastrar'}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Registration Modal
// ---------------------------------------------------------------------------

export function RegistrationModal({
  restaurantName,
  primaryColor,
  isOpen,
  onClose,
}: RegistrationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, action, isPending] = useActionState(registerCustomer, undefined)
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [isIOS, setIsIOS] = useState(false)

  // Open / close dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  // iOS detection (only after mount — navigator is not available on server)
  useEffect(() => {
    const ua = navigator.userAgent
    setIsIOS(/iPhone|iPad|iPod/.test(ua))
  }, [])

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const digits = raw.replace(/\D/g, '').slice(0, 11)
    setPhoneDigits(digits)
    setPhoneDisplay(formatPhone(raw))
  }

  function handleClose() {
    // Reset phone display when closing
    setPhoneDisplay('')
    setPhoneDigits('')
    onClose()
  }

  const isSuccess = state?.step === 'success'
  const isError = state?.step === 'error'

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      style={{
        border: 'none',
        borderRadius: '16px',
        padding: 0,
        width: '100%',
        maxWidth: '440px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        // Remove default dialog styles
        background: 'transparent',
      }}
    >
      {/* Backdrop click closes modal */}
      <style>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(2px);
        }
        dialog[open] {
          animation: dialog-in 0.2s ease-out;
        }
        @keyframes dialog-in {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: primaryColor,
            color: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: '800' }}>
              {isSuccess ? 'Bem-vindo!' : 'Cadastre-se'}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '2px' }}>
              {restaurantName}
            </div>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fechar"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: '700',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          {/* ---------- SUCCESS: Card Preview ---------- */}
          {isSuccess && (
            <div>
              {/* Visual card */}
              <div
                style={{
                  backgroundColor: primaryColor,
                  borderRadius: '14px',
                  padding: '24px',
                  color: '#ffffff',
                  marginBottom: '24px',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: `0 8px 24px ${primaryColor}66`,
                }}
              >
                {/* Decorative circles */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    right: '-20px',
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-30px',
                    right: '40px',
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.07)',
                  }}
                />

                <div style={{ position: 'relative' }}>
                  {/* Rank badge */}
                  <div
                    style={{
                      display: 'inline-block',
                      background: 'rgba(255,255,255,0.2)',
                      borderRadius: '20px',
                      padding: '3px 12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      letterSpacing: '0.5px',
                      marginBottom: '16px',
                    }}
                  >
                    {state.rankName.toUpperCase()}
                  </div>

                  {/* Customer name */}
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      marginBottom: '4px',
                      letterSpacing: '-0.3px',
                    }}
                  >
                    {state.customerName}
                  </div>

                  {/* Points */}
                  <div
                    style={{
                      fontSize: '14px',
                      opacity: 0.8,
                      marginBottom: '20px',
                    }}
                  >
                    0 pontos
                  </div>

                  {/* Card number */}
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: '700',
                      letterSpacing: '2px',
                      fontFamily: 'monospace',
                    }}
                  >
                    {state.cardNumber}
                  </div>
                </div>
              </div>

              {/* iOS: Apple Wallet button */}
              {isIOS ? (
                <a
                  href={`/api/pass/${state.cardNumber}`}
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    marginBottom: '16px',
                  }}
                >
                  {/* Official Apple Wallet badge look-alike */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '16px',
                      fontWeight: '700',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>🍎</span>
                    Adicionar a Apple Wallet
                  </div>
                </a>
              ) : (
                <div
                  style={{
                    backgroundColor: '#f0f0f0',
                    borderRadius: '10px',
                    padding: '16px',
                    textAlign: 'center',
                    marginBottom: '16px',
                    fontSize: '15px',
                    color: '#333',
                  }}
                >
                  <div style={{ fontWeight: '700', marginBottom: '4px' }}>Seu numero de cartao:</div>
                  <div
                    style={{
                      fontSize: '22px',
                      fontWeight: '800',
                      letterSpacing: '2px',
                      fontFamily: 'monospace',
                      color: primaryColor,
                    }}
                  >
                    {state.cardNumber}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', marginTop: '6px' }}>
                    Guarde seu numero: {state.cardNumber}
                  </div>
                </div>
              )}

              {/* Existing customer notice */}
              {state.isExisting && (
                <div
                  style={{
                    backgroundColor: '#fff8e1',
                    border: '1px solid #ffe082',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    color: '#6d4c00',
                    marginBottom: '16px',
                    textAlign: 'center',
                  }}
                >
                  Voce ja tinha um cadastro — mostrando seu cartao existente.
                </div>
              )}

              <button
                onClick={handleClose}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: '#f0f0f0',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  color: '#333',
                }}
              >
                Fechar
              </button>
            </div>
          )}

          {/* ---------- FORM ---------- */}
          {!isSuccess && (
            <form action={action}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Error banner */}
                {isError && (
                  <div
                    style={{
                      backgroundColor: '#fde8e8',
                      border: '1px solid #f5c6c6',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      color: '#b00020',
                    }}
                  >
                    {state.message}
                  </div>
                )}

                {/* Name field */}
                <div>
                  <label
                    htmlFor="reg-name"
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#444',
                      marginBottom: '6px',
                    }}
                  >
                    Seu nome
                  </label>
                  <input
                    id="reg-name"
                    name="name"
                    type="text"
                    placeholder="Ex: Maria Silva"
                    required
                    autoComplete="name"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${isError && state.fieldErrors?.name ? '#e53935' : '#ddd'}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#1a1a1a',
                    }}
                  />
                  {isError && state.fieldErrors?.name && (
                    <div style={{ color: '#e53935', fontSize: '13px', marginTop: '4px' }}>
                      {state.fieldErrors.name}
                    </div>
                  )}
                </div>

                {/* Phone field */}
                <div>
                  <label
                    htmlFor="reg-phone-display"
                    style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#444',
                      marginBottom: '6px',
                    }}
                  >
                    Celular
                  </label>
                  {/* Visible formatted input */}
                  <input
                    id="reg-phone-display"
                    type="tel"
                    placeholder="(11) 99999-1234"
                    value={phoneDisplay}
                    onChange={handlePhoneChange}
                    autoComplete="tel"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      border: `1.5px solid ${isError && state.fieldErrors?.phone ? '#e53935' : '#ddd'}`,
                      borderRadius: '8px',
                      fontSize: '16px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#1a1a1a',
                    }}
                  />
                  {/* Hidden input with raw digits — what Server Action reads */}
                  <input type="hidden" name="phone" value={phoneDigits} />
                  {isError && state.fieldErrors?.phone && (
                    <div style={{ color: '#e53935', fontSize: '13px', marginTop: '4px' }}>
                      {state.fieldErrors.phone}
                    </div>
                  )}
                </div>

                <SubmitButton primaryColor={primaryColor} isPending={isPending} />

                <p
                  style={{
                    fontSize: '12px',
                    color: '#999',
                    textAlign: 'center',
                    margin: 0,
                  }}
                >
                  Apenas nome e telefone — rapido e simples!
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </dialog>
  )
}
