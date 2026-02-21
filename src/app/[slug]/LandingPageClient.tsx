'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { RegistrationModal } from './RegistrationModal'

interface LandingPageClientProps {
  restaurantName: string
  primaryColor: string
  cardImageUrl?: string | null
  slot: 'hero-cta' | 'footer-cta'
}

export function LandingPageClient({
  restaurantName,
  primaryColor,
  cardImageUrl,
  slot,
}: LandingPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const slug = pathname.split('/')[1]

  useEffect(() => {
    const saved = localStorage.getItem(`revisit:card:${slug}`)
    if (saved) {
      router.replace(`/${slug}/card?n=${encodeURIComponent(saved)}`)
    }
  }, [slug, router])

  return (
    <>
      <button
        id={slot === 'hero-cta' ? 'cta-register' : 'cta-register-footer'}
        onClick={() => setIsModalOpen(true)}
        className="group relative bg-white text-[var(--primary)] font-bold rounded-full px-10 py-4 text-base tracking-wide shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_20px_rgba(0,0,0,0.15)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.3),0_8px_30px_rgba(0,0,0,0.25)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
      >
        <span className="relative z-10 flex items-center gap-2">
          Cadastre-se Grátis
          <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </button>

      <RegistrationModal
        restaurantName={restaurantName}
        primaryColor={primaryColor}
        cardImageUrl={cardImageUrl}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  )
}
