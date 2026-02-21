'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  label: string
}

interface DashboardNavProps {
  items: NavItem[]
}

export default function DashboardNav({ items }: DashboardNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const isActive = pathname === item.href
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative block rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-white/[0.06] text-db-text font-medium'
                : 'text-db-text-muted hover:text-db-text-secondary hover:bg-white/[0.03]'
            }`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-db-accent" />
            )}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
