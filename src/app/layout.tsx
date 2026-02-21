import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Revisit',
  description: 'Loyalty card app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
