export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f9fafb',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '2rem',
        }}
      >
        {children}
      </div>
    </div>
  )
}
