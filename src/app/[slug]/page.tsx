import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import { LandingPageClient } from './LandingPageClient'

type Props = {
  params: Promise<{ slug: string }>
}

const RANK_COLORS: Record<number, { bg: string; text: string; glow: string }> = {
  1: { bg: '#CD7F32', text: '#ffffff', glow: 'rgba(205,127,50,0.25)' },
  2: { bg: '#C0C0C0', text: '#1a1a1a', glow: 'rgba(192,192,192,0.25)' },
  3: { bg: '#FFD700', text: '#1a1a1a', glow: 'rgba(255,215,0,0.25)' },
  4: { bg: '#9b59b6', text: '#ffffff', glow: 'rgba(155,89,182,0.25)' },
}

function getRankStyle(sortOrder: number) {
  return RANK_COLORS[sortOrder] ?? { bg: '#888', text: '#fff', glow: 'rgba(136,136,136,0.25)' }
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`
}

// ---------------------------------------------------------------------------
// generateMetadata — white-label SEO
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
// Landing page
// ---------------------------------------------------------------------------
export default async function TenantPage() {
  const headersList = await headers()
  const restaurantId = headersList.get('x-restaurant-id')

  if (!restaurantId) {
    notFound()
  }

  const supabase = createServiceClient()

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, program_name, primary_color, secondary_color, logo_url, earn_rate, reward_type, card_image_url')
    .eq('id', restaurantId)
    .is('deleted_at', null)
    .single()

  if (!restaurant) {
    notFound()
  }

  const { data: ranks } = await supabase
    .from('ranks')
    .select('id, name, min_visits, multiplier, discount_pct, sort_order')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  const displayName = restaurant.program_name ?? restaurant.name
  const primaryColor = restaurant.primary_color ?? '#2563eb'
  const primaryRgb = hexToRgb(primaryColor)
  const activeRanks = ranks ?? []

  return (
    <div
      className="text-text-primary overflow-hidden bg-white"
      style={{ '--primary': primaryColor, '--primary-rgb': primaryRgb } as React.CSSProperties}
    >

      {/* ================================================================ */}
      {/* HERO — tall, immersive, with layered decorative elements         */}
      {/* ================================================================ */}
      <section className="bg-primary-gradient text-white relative overflow-hidden min-h-[85vh] flex items-center justify-center">
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'1\'/%3E%3C/svg%3E")' }} />

        {/* Large decorative rings */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full border border-white/[0.07]" />
        <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full border border-white/[0.05]" />
        <div className="absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full border border-white/[0.06]" />
        {/* Soft radial glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.03] blur-3xl" />

        <div className="max-w-[600px] mx-auto relative z-10 text-center px-6 py-24">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="max-h-[72px] max-w-[200px] object-contain mb-10 mx-auto brightness-0 invert"
            />
          ) : (
            <div className="inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[4px] opacity-60 mb-8 border border-white/20 rounded-full px-5 py-2">
              {restaurant.name}
            </div>
          )}

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[0.95] mb-6">
            {displayName}
          </h1>

          <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-12 max-w-[480px] mx-auto font-light">
            Ganhe pontos toda vez que nos visitar e troque por recompensas exclusivas
          </p>

          <div className="flex flex-col items-center gap-4">
            <LandingPageClient
              restaurantName={restaurant.name}
              primaryColor={primaryColor}
              cardImageUrl={restaurant.card_image_url}
              slot="hero-cta"
            />
            <p className="text-[13px] text-white/40 font-light">
              Cadastro grátis em menos de 1 minuto
            </p>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ================================================================ */}
      {/* HOW IT WORKS — numbered steps with connecting line               */}
      {/* ================================================================ */}
      <section className="py-24 px-6">
        <div className="max-w-[720px] mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[3px] text-primary/60 mb-4 border border-primary-subtle rounded-full px-4 py-1.5">
              Como funciona
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight">
              Simples assim
            </h2>
          </div>

          <div className="flex flex-col gap-0 relative">
            {/* Vertical connecting line */}
            <div className="absolute left-6 md:left-8 top-12 bottom-12 w-px bg-border" />

            {[
              {
                step: '1',
                title: 'Cadastre-se',
                desc: 'Informe seu nome e telefone. Só isso — pronto!',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                ),
              },
              {
                step: '2',
                title: 'Acumule pontos',
                desc: `A cada visita você ganha ${restaurant.earn_rate ?? 2} pontos por real gasto`,
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                ),
              },
              {
                step: '3',
                title: 'Resgate recompensas',
                desc: 'Use seus pontos para descontos e prêmios exclusivos',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 12 20 22 4 22 4 12" />
                    <rect x="2" y="7" width="20" height="5" />
                    <line x1="12" y1="22" x2="12" y2="7" />
                    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-5 md:gap-6 py-6 group">
                {/* Step number circle */}
                <div className="relative z-10 w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary text-white flex items-center justify-center text-lg md:text-xl font-bold shrink-0 shadow-lg group-hover:scale-110 transition-transform duration-200">
                  {item.step}
                </div>
                <div className="pt-1 md:pt-3">
                  <h3 className="text-lg md:text-xl font-bold text-text-primary mb-1">
                    {item.title}
                  </h3>
                  <p className="text-text-muted text-[15px] md:text-base leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* RANK PROGRESSION                                                  */}
      {/* ================================================================ */}
      {activeRanks.length > 0 && (
        <section className="py-24 px-6 bg-surface-secondary/60">
          <div className="max-w-[900px] mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[3px] text-primary/60 mb-4 border border-primary-subtle rounded-full px-4 py-1.5">
                Níveis
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight mb-3">
                Suba de nível a cada visita
              </h2>
              <p className="text-text-muted text-base md:text-lg max-w-[400px] mx-auto">
                Quanto mais você visita, maiores os benefícios
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
              {activeRanks.map((rank) => {
                const rs = getRankStyle(rank.sort_order)
                return (
                  <div
                    key={rank.id}
                    className="bg-white rounded-2xl p-5 md:p-7 text-center relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group"
                    style={{ boxShadow: `0 2px 16px ${rs.glow}` }}
                  >
                    {/* Top accent bar */}
                    <div
                      className="absolute top-0 left-0 right-0 h-1 transition-all duration-300 group-hover:h-1.5"
                      style={{ background: rs.bg }}
                    />

                    <div
                      className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center text-lg md:text-xl font-extrabold mx-auto mb-3 md:mb-4 transition-transform duration-300 group-hover:scale-110"
                      style={{
                        background: `linear-gradient(135deg, ${rs.bg}, ${rs.bg}cc)`,
                        color: rs.text,
                        boxShadow: `0 4px 12px ${rs.glow}`,
                      }}
                    >
                      {rank.name.charAt(0)}
                    </div>

                    <h3 className="text-base md:text-lg font-bold mb-2 text-text-primary">
                      {rank.name}
                    </h3>

                    <div className="text-3xl md:text-4xl font-extrabold leading-none mb-0.5" style={{ color: rs.bg }}>
                      {rank.multiplier}x
                    </div>
                    <div className="text-[11px] md:text-[13px] text-text-muted mb-3 md:mb-4 font-medium">
                      multiplicador
                    </div>

                    <div className="text-[12px] md:text-[13px] text-text-muted pt-3 border-t border-border">
                      {rank.min_visits === 0 ? (
                        'Nível inicial'
                      ) : (
                        <>A partir de <strong className="text-text-primary">{rank.min_visits}</strong> visita{rank.min_visits !== 1 ? 's' : ''}</>
                      )}
                    </div>

                    {rank.discount_pct > 0 && (
                      <div className="text-[12px] md:text-[13px] text-primary font-semibold mt-1">
                        {rank.discount_pct}% de desconto
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/* BENEFITS — horizontal icon rows                                   */}
      {/* ================================================================ */}
      <section className="py-24 px-6">
        <div className="max-w-[640px] mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[3px] text-primary/60 mb-4 border border-primary-subtle rounded-full px-4 py-1.5">
              Vantagens
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-text-primary tracking-tight">
              Por que participar?
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            {[
              {
                title: 'Pontos em toda compra',
                desc: 'Acumule automaticamente a cada visita',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="8" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                ),
              },
              {
                title: 'Descontos exclusivos',
                desc: 'Benefícios que aumentam com seu nível',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="19" y1="5" x2="5" y2="19" />
                    <circle cx="6.5" cy="6.5" r="2.5" />
                    <circle cx="17.5" cy="17.5" r="2.5" />
                  </svg>
                ),
              },
              {
                title: 'Níveis de fidelidade',
                desc: 'Quanto mais visitas, maiores as recompensas',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                ),
              },
              {
                title: 'Cartão digital',
                desc: 'Direto no seu celular — sem papel, sem complicação',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                ),
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="flex items-center gap-5 rounded-2xl p-5 border border-border hover:border-primary-subtle hover:bg-surface-secondary/50 transition-all duration-200 group"
              >
                <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200">
                  {benefit.icon}
                </div>
                <div>
                  <div className="font-semibold text-text-primary text-base">
                    {benefit.title}
                  </div>
                  <div className="text-text-muted text-sm mt-0.5">
                    {benefit.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* FOOTER CTA                                                        */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden">
        {/* Top fade into dark */}
        <div className="h-24 bg-gradient-to-b from-white to-transparent absolute top-0 left-0 right-0 z-10" />

        <div className="bg-primary-gradient text-white pt-32 pb-24 px-6 text-center relative">
          {/* Decorative rings */}
          <div className="absolute top-10 right-10 w-[200px] h-[200px] rounded-full border border-white/[0.06]" />
          <div className="absolute bottom-10 left-10 w-[150px] h-[150px] rounded-full border border-white/[0.04]" />

          <div className="max-w-[480px] mx-auto relative z-10">
            <h2 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tighter leading-[0.95]">
              Pronto para{'\n'}começar?
            </h2>
            <p className="text-lg text-white/60 mb-10 leading-relaxed font-light">
              Cadastre-se agora e ganhe pontos na sua próxima visita
            </p>

            <LandingPageClient
              restaurantName={restaurant.name}
              primaryColor={primaryColor}
              cardImageUrl={restaurant.card_image_url}
              slot="footer-cta"
            />

            <p className="text-[12px] text-white/30 mt-16 tracking-widest uppercase font-light">
              {restaurant.name} — Programa de Fidelidade
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
