import { SignUp } from '@clerk/nextjs'

export const dynamic = 'force-dynamic'

export default function SignupPage() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <SignUp />
    </div>
  )
}
