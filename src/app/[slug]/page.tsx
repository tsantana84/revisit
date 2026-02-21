import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { LandingPageClient } from './LandingPageClient'

type Props = {
  params: Promise<{ slug: string }>
}

// ---------------------------------------------------------------------------
// Rank colors mapped by sort_order (1=Bronze, 2=Prata, 3=Gold, 4=VIP)
// ---------------------------------------------------------------------------
const RANK_COLORS: Record<number, string> = {
  1: '#CD7F32', // Bronze
  2: '#C0C0C0', // Prata
  3: '#FFD700', // Gold
  4: '#9b59b6', // VIP
}

function getRankColor(sortOrder: number): string {
  return RANK_COLORS[sortOrder] ?? '#888888'
}

// ---------------------------------------------------------------------------
// generateMetadata — white-label SEO, no REVISIT string in output
// ---------------------------------------------------------------------------
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params

  const supabase = createServiceClient()
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, program_name')
    .eq('slug', slug)
    .is('deleted_at', null)
    .single()

  if (!restaurant) {
    return { title: 'Não encontrado' }
  }

  const title = restaurant.program_name ?? restaurant.name

  return {
    title,
    description: `Ganhe pontos toda vez que visitar ${restaurant.name} e troque por recompensas!`,
  }
}

// ---------------------------------------------------------------------------
// Landing page — fully branded as the restaurant, no REVISIT branding
// ---------------------------------------------------------------------------
export default async function TenantPage() {
  const headersList = await headers()
  const restaurantId = headersList.get('x-restaurant-id')

  if (!restaurantId) {
    notFound()
  }

  const supabase = createServiceClient()

  // Fetch restaurant branding and configuration
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, program_name, primary_color, secondary_color, logo_url, earn_rate, reward_type')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!restaurant) {
    notFound()
  }

  // Fetch ranks for this restaurant ordered by sort_order
  const { data: ranks } = await supabase
    .from('ranks')
    .select('id, name, min_visits, multiplier, discount_pct, sort_order')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const displayName = restaurant.program_name ?? restaurant.name
  const primaryColor = restaurant.primary_color ?? '#000000'
  const activeRanks = ranks ?? []

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#1a1a1a' }}>

      {/* ---------------------------------------------------------------- */}
      {/* HERO SECTION                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section
        style={{
          backgroundColor: primaryColor,
          color: '#ffffff',
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Logo or fallback text */}
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              style={{
                maxHeight: '80px',
                maxWidth: '240px',
                objectFit: 'contain',
                marginBottom: '24px',
              }}
            />
          ) : (
            <div
              style={{
                fontSize: '28px',
                fontWeight: '800',
                marginBottom: '24px',
                letterSpacing: '-0.5px',
              }}
            >
              {restaurant.name}
            </div>
          )}

          <h1
            style={{
              fontSize: '36px',
              fontWeight: '800',
              margin: '0 0 16px',
              lineHeight: '1.2',
            }}
          >
            {displayName}
          </h1>

          <p
            style={{
              fontSize: '20px',
              margin: '0 0 36px',
              opacity: 0.9,
              lineHeight: '1.5',
            }}
          >
            Ganhe pontos toda vez que nos visitar!
          </p>

          {/* Hero CTA — handled by LandingPageClient */}
          <LandingPageClient
            restaurantName={restaurant.name}
            primaryColor={primaryColor}
            slot="hero-cta"
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* HOW IT WORKS                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section style={{ backgroundColor: '#ffffff', padding: '60px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: '800',
              marginBottom: '8px',
              color: '#1a1a1a',
            }}
          >
            Como funciona?
          </h2>
          <p style={{ color: '#666', marginBottom: '40px', fontSize: '16px' }}>
            Simples e rapido — em 3 passos voce ja ta ganhando pontos!
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              justifyContent: 'center',
            }}
          >
            {[
              {
                step: '1',
                title: 'Cadastre-se',
                desc: 'Informe seu nome e telefone. So isso — pronto!',
              },
              {
                step: '2',
                title: 'Compre e acumule pontos',
                desc: `A cada visita voce ganha ${restaurant.earn_rate ?? 2} pontos por real gasto.`,
              },
              {
                step: '3',
                title: 'Troque por recompensas',
                desc: 'Use seus pontos para ganhar descontos e premios exclusivos.',
              },
            ].map((item) => (
              <div
                key={item.step}
                style={{
                  flex: '1 1 180px',
                  maxWidth: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: primaryColor,
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: '800',
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                  {item.title}
                </h3>
                <p style={{ color: '#666', fontSize: '15px', margin: 0, textAlign: 'center' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* RANK PROGRESSION                                                   */}
      {/* ---------------------------------------------------------------- */}
      {activeRanks.length > 0 && (
        <section
          style={{
            backgroundColor: '#f8f8f8',
            padding: '60px 24px',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h2
              style={{
                fontSize: '28px',
                fontWeight: '800',
                marginBottom: '8px',
                color: '#1a1a1a',
              }}
            >
              Niveis de fidelidade
            </h2>
            <p style={{ color: '#666', marginBottom: '40px', fontSize: '16px' }}>
              Quanto mais voce visita, mais beneficios voce desbloqueia!
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                justifyContent: 'center',
              }}
            >
              {activeRanks.map((rank) => {
                const rankColor = getRankColor(rank.sort_order)
                return (
                  <div
                    key={rank.id}
                    style={{
                      flex: '1 1 160px',
                      maxWidth: '180px',
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: `3px solid ${rankColor}`,
                      padding: '24px 16px',
                      textAlign: 'center',
                    }}
                  >
                    {/* Rank badge */}
                    <div
                      style={{
                        display: 'inline-block',
                        backgroundColor: rankColor,
                        color: rank.sort_order === 2 ? '#333' : '#ffffff',
                        borderRadius: '20px',
                        padding: '4px 16px',
                        fontSize: '14px',
                        fontWeight: '700',
                        marginBottom: '12px',
                        letterSpacing: '0.3px',
                      }}
                    >
                      {rank.name}
                    </div>

                    <p
                      style={{
                        fontSize: '13px',
                        color: '#666',
                        margin: '0 0 8px',
                      }}
                    >
                      A partir de{' '}
                      <strong style={{ color: '#1a1a1a' }}>
                        {rank.min_visits} visita{rank.min_visits !== 1 ? 's' : ''}
                      </strong>
                    </p>

                    <p
                      style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: rankColor,
                        margin: 0,
                      }}
                    >
                      {rank.multiplier}x pontos
                    </p>

                    {rank.discount_pct > 0 && (
                      <p
                        style={{
                          fontSize: '13px',
                          color: '#666',
                          margin: '4px 0 0',
                        }}
                      >
                        {rank.discount_pct}% de desconto
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* BENEFITS SECTION                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section style={{ backgroundColor: '#ffffff', padding: '60px 24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: '800',
              marginBottom: '8px',
              color: '#1a1a1a',
            }}
          >
            Por que participar?
          </h2>
          <p style={{ color: '#666', marginBottom: '36px', fontSize: '16px' }}>
            Vantagens reais para os nossos clientes fieis.
          </p>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'left',
            }}
          >
            {[
              { icon: '⭐', text: 'Pontos em toda compra — sem complicacao' },
              { icon: '🎁', text: 'Descontos exclusivos para membros do programa' },
              { icon: '🚀', text: 'Quanto mais visitas, maiores os beneficios' },
              { icon: '📱', text: 'Cartao digital direto no seu iPhone — sem papel' },
            ].map((benefit) => (
              <li
                key={benefit.text}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  backgroundColor: '#f8f8f8',
                  borderRadius: '10px',
                  padding: '16px 20px',
                  fontSize: '16px',
                }}
              >
                <span style={{ fontSize: '24px' }}>{benefit.icon}</span>
                <span style={{ color: '#333', fontWeight: '500' }}>{benefit.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FOOTER CTA                                                         */}
      {/* ---------------------------------------------------------------- */}
      <section
        style={{
          backgroundColor: primaryColor,
          color: '#ffffff',
          padding: '60px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2
            style={{
              fontSize: '28px',
              fontWeight: '800',
              margin: '0 0 12px',
            }}
          >
            Pronto para comecar?
          </h2>
          <p style={{ fontSize: '18px', margin: '0 0 32px', opacity: 0.9 }}>
            Cadastre-se agora e ganhe pontos na sua proxima visita!
          </p>

          {/* Footer CTA — handled by LandingPageClient */}
          <LandingPageClient
            restaurantName={restaurant.name}
            primaryColor={primaryColor}
            slot="footer-cta"
          />

          <p
            style={{
              fontSize: '14px',
              opacity: 0.7,
              margin: '32px 0 0',
            }}
          >
            {restaurant.name} — Programa de Fidelidade
          </p>
        </div>
      </section>
    </div>
  )
}
