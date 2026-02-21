export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="auth-gradient-bg flex items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-db-text)]">
            Revisit
          </h1>
          <p className="mt-1 text-sm text-[var(--color-db-text-muted)]">
            Programa de fidelidade inteligente
          </p>
        </div>
        <div className="auth-card p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
