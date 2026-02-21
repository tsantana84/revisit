import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import { BrandingForm } from './BrandingForm'
import { LogoForm } from './LogoForm'
import { RanksForm } from './RanksForm'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

interface Restaurant {
  id: string
  program_name: string | null
  primary_color: string
  secondary_color: string
  logo_url: string | null
  earn_rate: number
  reward_type: 'cashback' | 'free_product' | 'progressive_discount'
  point_expiry_days: number | null
}

interface Rank {
  id: string
  name: string
  min_visits: number
  multiplier: number
  sort_order: number
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return <p>Sessão inválida. Faça login novamente.</p>
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)
  const restaurantId = claims.restaurant_id

  if (!restaurantId) {
    return <p>Restaurante não encontrado.</p>
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('id', restaurantId)
    .single<Restaurant>()

  const { data: ranks } = await supabase
    .from('ranks')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('sort_order')

  const defaultRestaurant: Restaurant = {
    id: restaurantId,
    program_name: '',
    primary_color: '#000000',
    secondary_color: '#FFFFFF',
    logo_url: null,
    earn_rate: 2,
    reward_type: 'cashback',
    point_expiry_days: null,
  }

  const defaultRanks: Rank[] = [
    { id: '', name: 'Bronze', min_visits: 0, multiplier: 1, sort_order: 0 },
  ]

  const restaurantData = restaurant ?? defaultRestaurant
  const ranksData: Rank[] = (ranks as Rank[] | null) ?? defaultRanks

  return (
    <div style={{ maxWidth: '720px' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '2rem', color: '#111827' }}>
        Configurações
      </h1>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Marca
        </h2>
        <BrandingForm restaurant={restaurantData} />
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Logo
        </h2>
        <LogoForm logoUrl={restaurantData.logo_url} programName={restaurantData.program_name} />
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Programa
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
          As configurações de programa fazem parte do formulário de Marca acima.
        </p>
      </section>

      <section>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', color: '#374151' }}>
          Níveis
        </h2>
        <RanksForm ranks={ranksData} />
      </section>
    </div>
  )
}
