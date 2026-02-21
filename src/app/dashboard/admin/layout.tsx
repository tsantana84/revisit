import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import { logout } from '@/lib/actions/auth'
import DashboardNav from '../DashboardNav'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager' | 'admin'
  sub: string
  exp: number
}

const NAV_ITEMS = [
  { href: '/dashboard/admin', label: 'Visão Geral' },
  { href: '/dashboard/admin/restaurants', label: 'Restaurantes' },
  { href: '/dashboard/admin/logs', label: 'Registros' },
]

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)

  if (claims.app_role !== 'admin') {
    redirect('/login')
  }

  return (
    <div className="dark flex min-h-screen font-sans">
      {/* Sidebar */}
      <aside className="flex w-[220px] flex-col gap-2 border-r border-db-border bg-db-bg px-3 py-6">
        <div className="mb-4 px-3">
          <span className="text-lg font-bold text-db-text">Revisit</span>
          <span className="ml-2 text-xs font-medium text-db-accent">Admin</span>
        </div>

        <DashboardNav items={NAV_ITEMS} />

        <div className="mt-auto">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg border border-db-border px-3 py-2 text-left text-sm text-db-text-muted transition-colors hover:text-db-text-secondary hover:bg-white/[0.03] cursor-pointer"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-db-bg p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
