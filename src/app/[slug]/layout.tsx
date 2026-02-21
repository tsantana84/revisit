import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

/**
 * Tenant layout for public-facing restaurant landing pages.
 *
 * Reads x-restaurant-id and x-restaurant-name from request headers,
 * which are injected by the middleware slug resolver from the database-verified slug.
 * If the header is absent, the slug was not found — return 404.
 */
export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const restaurantId = headersList.get('x-restaurant-id')

  if (!restaurantId) {
    notFound()
  }

  return (
    <div style={{ minHeight: '100vh', width: '100%' }}>
      {children}
    </div>
  )
}
