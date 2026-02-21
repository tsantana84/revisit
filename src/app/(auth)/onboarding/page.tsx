import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import OnboardingForm from './onboarding-form'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect('/login')
  }

  // If user already has a staff row, send them to the dashboard.
  // The dashboard layout's getRevisitAuth() handles metadata sync via DB fallback.
  const serviceClient = createServiceClient()
  const { data: existingStaff } = await serviceClient
    .from('restaurant_staff')
    .select('role')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingStaff) {
    const dest = existingStaff.role === 'admin' ? '/dashboard/admin'
      : existingStaff.role === 'manager' ? '/dashboard/manager'
      : '/dashboard/owner'
    redirect(dest)
  }

  return <OnboardingForm />
}
