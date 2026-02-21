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
  discount_pct: number
  sort_order: number
}

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return <p className="text-db-text-muted">Sessão inválida. Faça login novamente.</p>
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)
  const restaurantId = claims.restaurant_id

  if (!restaurantId) {
    return <p className="text-db-text-muted">Restaurante não encontrado.</p>
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
    { id: '', name: 'Bronze', min_visits: 0, multiplier: 1, discount_pct: 0, sort_order: 0 },
  ]

  const restaurantData = restaurant ?? defaultRestaurant
  const ranksData: Rank[] = (ranks as Rank[] | null) ?? defaultRanks

  return (
    <div className="max-w-[720px]">
      <h1 className="text-2xl font-bold text-db-text mb-8">
        Configurações
      </h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-db-text-secondary mb-4">
          Marca
        </h2>
        <BrandingForm restaurant={restaurantData} />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-db-text-secondary mb-4">
          Logo
        </h2>
        <LogoForm logoUrl={restaurantData.logo_url} programName={restaurantData.program_name} />
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-db-text-secondary mb-4">
          Programa
        </h2>
        <p className="text-sm text-db-text-muted">
          As configurações de programa fazem parte do formulário de Marca acima.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-db-text-secondary mb-4">
          Níveis
        </h2>
        <RanksForm ranks={ranksData} />
      </section>
    </div>
  )
}
