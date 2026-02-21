'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
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
  cardImageUrl?: string | null
  isOpen: boolean
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Registration Modal
// ---------------------------------------------------------------------------

export function RegistrationModal({
  restaurantName,
  primaryColor,
  cardImageUrl,
  isOpen,
  onClose,
}: RegistrationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, action, isPending] = useActionState(registerCustomer, undefined)
  const [phoneDisplay, setPhoneDisplay] = useState('')
  const [phoneDigits, setPhoneDigits] = useState('')
  const [isIOS, setIsIOS] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const slug = pathname.split('/')[1]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

  // Save card number to localStorage + redirect existing customers
  useEffect(() => {
    if (state?.step === 'success') {
      localStorage.setItem(`revisit:card:${slug}`, state.cardNumber)
      if (state.isExisting) {
        router.push(`/${slug}/card?n=${encodeURIComponent(state.cardNumber)}`)
      }
    }
  }, [state, slug, router])

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
    setPhoneDisplay('')
    setPhoneDigits('')
    onClose()
  }

  const isSuccess = state?.step === 'success'
  const isError = state?.step === 'error'

  const inputClasses = (hasError: boolean) =>
    `w-full px-4 py-3.5 border-[1.5px] rounded-xl text-base text-text-primary outline-none transition-all duration-200 bg-surface-secondary/50 placeholder:text-text-muted/50 ${
      hasError
        ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
        : 'border-transparent focus:border-[var(--primary)] focus:ring-4 focus:ring-[var(--primary)]/10 focus:bg-white'
    }`

  return (
    <dialog
      ref={dialogRef}
      onClose={handleClose}
      className="rounded-3xl w-full max-w-[420px] shadow-2xl border-none p-0 mx-auto bg-transparent backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary text-white px-7 py-6 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full border border-white/10" />
          <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full border border-white/[0.06]" />

          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-xl font-extrabold tracking-tight">
                {isSuccess ? 'Bem-vindo!' : 'Cadastre-se'}
              </div>
              <div className="text-[13px] text-white/50 mt-1 font-light">
                {restaurantName}
              </div>
            </div>
            <button
              onClick={handleClose}
              aria-label="Fechar"
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-lg flex items-center justify-center cursor-pointer transition-all duration-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-7">
          {/* ---------- SUCCESS: Card Preview ---------- */}
          {isSuccess && (
            <div>
              {/* Visual card */}
              <div
                className={`rounded-2xl p-6 text-white mb-6 relative overflow-hidden ${
                  cardImageUrl ? '' : 'bg-primary-gradient shadow-primary'
                }`}
                style={cardImageUrl ? {
                  backgroundImage: `url(${cardImageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : undefined}
              >
                {cardImageUrl && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                  </>
                )}
                <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full border border-white/10" />
                <div className="absolute -bottom-8 right-8 w-20 h-20 rounded-full border border-white/[0.06]" />

                <div className="relative">
                  <div className="inline-block bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-semibold tracking-widest uppercase mb-5">
                    {state.rankName}
                  </div>

                  <div className="text-xl font-extrabold mb-1 tracking-tight">
                    {state.customerName}
                  </div>

                  <div className="text-sm text-white/50 mb-6 font-light">
                    0 pontos
                  </div>

                  <div className="text-[20px] font-bold tracking-[3px] font-mono text-white/80">
                    {state.cardNumber}
                  </div>
                </div>
              </div>

              {/* iOS: Apple Wallet button */}
              {isIOS ? (
                <a href={`/api/pass/${state.cardNumber}`} className="block text-center mb-4">
                  <div className="inline-flex items-center gap-2.5 bg-black text-white rounded-xl px-6 py-3.5 text-[15px] font-bold cursor-pointer hover:bg-gray-900 transition-colors">
                    <span className="text-lg">🍎</span>
                    Adicionar a Apple Wallet
                  </div>
                </a>
              ) : (
                <div className="bg-surface-secondary rounded-2xl p-5 text-center mb-4">
                  <div className="text-sm font-semibold mb-2 text-text-secondary">Seu numero de cartao</div>
                  <div className="text-2xl font-extrabold tracking-[3px] font-mono text-primary">
                    {state.cardNumber}
                  </div>
                  <div className="text-[12px] text-text-muted mt-2 font-light">
                    Guarde seu numero: {state.cardNumber}
                  </div>
                </div>
              )}

              <div className="text-center mb-4">
                <a
                  href={`/${slug}/card?n=${encodeURIComponent(state.cardNumber)}`}
                  className="text-sm text-primary font-medium hover:underline"
                >
                  Consulte seu saldo a qualquer momento
                </a>
              </div>

              {state.isExisting && (
                <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3.5 text-sm text-amber-700 mb-4 text-center">
                  Voce ja tinha um cadastro — mostrando seu cartao existente.
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full bg-surface-secondary text-text-secondary rounded-xl py-3.5 text-[15px] font-semibold cursor-pointer hover:bg-surface-tertiary transition-colors"
              >
                Fechar
              </button>
            </div>
          )}

          {/* ---------- FORM ---------- */}
          {!isSuccess && (
            <form action={action}>
              <div className="flex flex-col gap-5">
                {isError && (
                  <div className="bg-red-50 border border-red-200/60 rounded-xl p-3.5 text-sm text-red-600">
                    {state.message}
                  </div>
                )}

                <div>
                  <label htmlFor="reg-name" className="block text-sm font-semibold text-text-primary mb-2">
                    Seu nome
                  </label>
                  <input
                    id="reg-name"
                    name="name"
                    type="text"
                    placeholder="Ex: Maria Silva"
                    required
                    autoComplete="name"
                    className={inputClasses(isError && !!state.fieldErrors?.name)}
                  />
                  {isError && state.fieldErrors?.name && (
                    <div className="text-red-500 text-[13px] mt-1.5 ml-1">
                      {state.fieldErrors.name}
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-phone-display" className="block text-sm font-semibold text-text-primary mb-2">
                    Celular
                  </label>
                  <input
                    id="reg-phone-display"
                    type="tel"
                    placeholder="(11) 99999-1234"
                    value={phoneDisplay}
                    onChange={handlePhoneChange}
                    autoComplete="tel"
                    className={inputClasses(isError && !!state.fieldErrors?.phone)}
                  />
                  <input type="hidden" name="phone" value={phoneDigits} />
                  {isError && state.fieldErrors?.phone && (
                    <div className="text-red-500 text-[13px] mt-1.5 ml-1">
                      {state.fieldErrors.phone}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl text-base cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 mt-1"
                >
                  {isPending ? 'Cadastrando...' : 'Cadastrar'}
                </button>

                <p className="text-[12px] text-text-muted text-center font-light">
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
