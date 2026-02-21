import { redirect } from 'next/navigation'
import { getRevisitAuth } from '@/lib/auth'
import { SignOutButton } from '@clerk/nextjs'
import DashboardNav from '../DashboardNav'

const NAV_ITEMS = [
  { href: '/dashboard/manager', label: 'Painel' },
]

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const ctx = await getRevisitAuth()
    if (ctx.role !== 'manager') {
      redirect('/login')
    }
  } catch {
    redirect('/login')
  }

  return (
    <div className="dark flex min-h-screen font-sans">
      {/* Sidebar */}
      <aside className="flex w-[220px] flex-col gap-2 border-r border-db-border bg-db-bg px-3 py-6">
        <div className="mb-4 px-3">
          <span className="text-lg font-bold text-db-text">Revisit</span>
        </div>

        <DashboardNav items={NAV_ITEMS} />

        <div className="mt-auto">
          <SignOutButton redirectUrl="/login">
            <button
              type="button"
              className="w-full rounded-lg border border-db-border px-3 py-2 text-left text-sm text-db-text-muted transition-colors hover:text-db-text-secondary hover:bg-white/[0.03] cursor-pointer"
            >
              Sair
            </button>
          </SignOutButton>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-db-bg p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
