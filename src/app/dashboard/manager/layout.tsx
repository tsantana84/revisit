import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { jwtDecode } from 'jwt-decode'
import { logout } from '@/lib/actions/auth'

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth role check (middleware does fast redirect; layout does authoritative check)
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

  if (claims.app_role !== 'manager') {
    redirect('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside
        style={{
          width: '220px',
          backgroundColor: '#111827',
          color: '#ffffff',
          padding: '1.5rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Revisit</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <a
            href="/dashboard/manager"
            style={{ color: '#d1d5db', textDecoration: 'none', padding: '0.5rem 0.75rem', borderRadius: '4px' }}
          >
            Painel
          </a>
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <form action={logout}>
            <button
              type="submit"
              style={{
                backgroundColor: 'transparent',
                color: '#9ca3af',
                border: '1px solid #374151',
                padding: '0.5rem 0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, backgroundColor: '#f9fafb', padding: '2rem' }}>
        {children}
      </main>
    </div>
  )
}
