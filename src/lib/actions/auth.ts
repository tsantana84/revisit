'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import slugify from 'slugify'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OnboardingState =
  | {
      errors?: {
        restaurantName?: string[]
      }
      message?: string
    }
  | undefined

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const OnboardingSchema = z.object({
  restaurantName: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .trim(),
})

// ---------------------------------------------------------------------------
// completeOnboarding — creates restaurant + sets Clerk publicMetadata
// ---------------------------------------------------------------------------

export async function completeOnboarding(
  prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const { userId } = await auth()

  if (!userId) {
    return { message: 'Não autenticado' }
  }

  // 0. Check if user already completed onboarding
  const serviceClient = createServiceClient()
  const { data: existingStaff } = await serviceClient
    .from('restaurant_staff')
    .select('id, restaurant_id, role')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingStaff) {
    // Ensure Clerk metadata is in sync (may have been missed on a prior attempt)
    const clerk = await clerkClient()
    await clerk.users.updateUser(userId, {
      publicMetadata: { restaurant_id: existingStaff.restaurant_id, app_role: existingStaff.role },
    })
    const dest = existingStaff.role === 'admin' ? '/dashboard/admin'
      : existingStaff.role === 'manager' ? '/dashboard/manager'
      : '/dashboard/owner'
    redirect(dest)
  }

  // 1. Validate inputs
  const validated = OnboardingSchema.safeParse({
    restaurantName: formData.get('restaurantName'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { restaurantName } = validated.data

  // 2. Create restaurant via service client (bypasses RLS)

  let slug = slugify(restaurantName, { lower: true, strict: true })

  const { data: restaurant, error: restaurantError } = await serviceClient
    .from('restaurants')
    .insert({ name: restaurantName, slug, program_name: restaurantName })
    .select('id')
    .single()

  if (restaurantError) {
    // Handle slug collision (Postgres unique violation code: 23505)
    if (restaurantError.code === '23505') {
      const suffix = Math.random().toString(36).substring(2, 6)
      slug = `${slug}-${suffix}`

      const { data: restaurantRetry, error: retryError } = await serviceClient
        .from('restaurants')
        .insert({ name: restaurantName, slug, program_name: restaurantName })
        .select('id')
        .single()

      if (retryError || !restaurantRetry) {
        log.error('auth.onboarding_failed', { user_id: userId, error: retryError?.message ?? 'retry_failed' })
        return { message: 'Erro ao criar restaurante. Tente outro nome.' }
      }

      // Create staff row
      const { error: staffError } = await serviceClient
        .from('restaurant_staff')
        .insert({ restaurant_id: restaurantRetry.id, user_id: userId, role: 'owner' })

      if (staffError) {
        await serviceClient.from('restaurants').delete().eq('id', restaurantRetry.id)
        log.error('auth.onboarding_failed', { user_id: userId, error: staffError.message })
        return { message: 'Erro ao configurar acesso. Tente novamente.' }
      }

      // Set Clerk publicMetadata
      const clerk = await clerkClient()
      await clerk.users.updateUser(userId, {
        publicMetadata: { restaurant_id: restaurantRetry.id, app_role: 'owner' },
      })

      log.info('auth.onboarding_completed', { user_id: userId, restaurant_id: restaurantRetry.id, slug })
      redirect('/dashboard/owner')
    }

    log.error('auth.onboarding_failed', { user_id: userId, error: restaurantError.message })
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  if (!restaurant) {
    log.error('auth.onboarding_failed', { user_id: userId, error: 'restaurant_insert_null' })
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  // 3. Create restaurant_staff row
  const { error: staffError } = await serviceClient
    .from('restaurant_staff')
    .insert({ restaurant_id: restaurant.id, user_id: userId, role: 'owner' })

  if (staffError) {
    await serviceClient.from('restaurants').delete().eq('id', restaurant.id)
    log.error('auth.onboarding_failed', { user_id: userId, error: staffError.message })
    return { message: 'Erro ao configurar acesso. Tente novamente.' }
  }

  // 4. Set Clerk publicMetadata so JWT Template includes restaurant_id + app_role
  const clerk = await clerkClient()
  await clerk.users.updateUser(userId, {
    publicMetadata: { restaurant_id: restaurant.id, app_role: 'owner' },
  })

  log.info('auth.onboarding_completed', { user_id: userId, restaurant_id: restaurant.id, slug })
  redirect('/dashboard/owner')
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout() {
  const { userId } = await auth()
  log.info('auth.logout', { user_id: userId })
  redirect('/login')
}
