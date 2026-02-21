'use client'

import { useState } from 'react'
import { RegistrationModal } from './RegistrationModal'

interface LandingPageClientProps {
  restaurantName: string
  primaryColor: string
  /** 'hero-cta' renders the primary hero button; 'footer-cta' renders the footer button */
  slot: 'hero-cta' | 'footer-cta'
}

/**
 * Client wrapper that manages modal open/close state and renders the CTA button
 * for the given slot. The RegistrationModal is only rendered once (from the hero
 * slot) — the footer slot just triggers opening it.
 *
 * Because this component is embedded twice in the Server Component tree, each
 * instance manages its own isOpen state independently. The modal is lightweight
 * enough that two instances sharing state via a common ancestor is unnecessary
 * complexity for a POC.
 */
export function LandingPageClient({
  restaurantName,
  primaryColor,
  slot,
}: LandingPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const buttonStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    color: primaryColor,
    border: 'none',
    borderRadius: '8px',
    padding: '16px 40px',
    fontSize: '18px',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.2px',
    ...(slot === 'footer-cta' ? { marginBottom: '0' } : {}),
  }

  return (
    <>
      <button
        id={slot === 'hero-cta' ? 'cta-register' : 'cta-register-footer'}
        onClick={() => setIsModalOpen(true)}
        style={buttonStyle}
      >
        Cadastre-se Gratis
      </button>

      <RegistrationModal
        restaurantName={restaurantName}
        primaryColor={primaryColor}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
