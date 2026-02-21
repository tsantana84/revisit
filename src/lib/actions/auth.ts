'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import slugify from 'slugify'
import { jwtDecode } from 'jwt-decode'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignupState =
  | {
      errors?: {
        restaurantName?: string[]
        email?: string[]
        password?: string[]
      }
      message?: string
    }
  | undefined

export type LoginState =
  | {
      message?: string
    }
  | undefined

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SignupSchema = z.object({
  restaurantName: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .trim(),
  email: z.string().email('Email inválido').trim(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

const LoginSchema = z.object({
  email: z.string().email('Email inválido').trim(),
  password: z.string().min(1, 'Senha é obrigatória'),
})

// ---------------------------------------------------------------------------
// signup — atomically creates auth user + restaurant + restaurant_staff
// ---------------------------------------------------------------------------

export async function signup(
  prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  // 1. Validate inputs
  const validated = SignupSchema.safeParse({
    restaurantName: formData.get('restaurantName'),
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { restaurantName, email, password } = validated.data

  // 2. Create auth user (uses anon client — signUp creates and signs in)
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  })

  if (authError || !authData.user) {
    log.error('auth.signup_failed', { email, error: authError?.message ?? 'user_creation_failed' })
    return { message: authError?.message ?? 'Erro ao criar conta' }
  }

  const userId = authData.user.id

  // 3. Use service role to create restaurant + staff atomically
  const serviceClient = createServiceClient()

  // Generate slug from restaurant name, handle potential collision
  let slug = slugify(restaurantName, { lower: true, strict: true })

  const { data: restaurant, error: restaurantError } = await serviceClient
    .from('restaurants')
    .insert({ name: restaurantName, slug, program_name: restaurantName })
    .select('id')
    .single()

  if (restaurantError) {
    // Handle slug collision (Postgres unique violation code: 23505)
    if (restaurantError.code === '23505') {
      // Append random 4-char suffix and retry once
      const suffix = Math.random().toString(36).substring(2, 6)
      slug = `${slug}-${suffix}`

      const { data: restaurantRetry, error: retryError } = await serviceClient
        .from('restaurants')
        .insert({ name: restaurantName, slug, program_name: restaurantName })
        .select('id')
        .single()

      if (retryError || !restaurantRetry) {
        // Clean up orphaned auth user
        await serviceClient.auth.admin.deleteUser(userId)
        return { message: 'Erro ao criar restaurante. Tente outro nome.' }
      }

      // Staff insert with retry result
      const { error: staffErrorRetry } = await serviceClient
        .from('restaurant_staff')
        .insert({ restaurant_id: restaurantRetry.id, user_id: userId, role: 'owner' })

      if (staffErrorRetry) {
        await serviceClient.from('restaurants').delete().eq('id', restaurantRetry.id)
        await serviceClient.auth.admin.deleteUser(userId)
        return { message: 'Erro ao configurar acesso. Tente novamente.' }
      }

      // Force fresh login so JWT hook picks up the new restaurant_staff row
      log.info('auth.signup_completed', { user_id: userId, restaurant_id: restaurantRetry.id, slug })
      await supabase.auth.signOut()
      redirect('/login?signup=success')
    }

    // Non-collision error
    await serviceClient.auth.admin.deleteUser(userId)
    log.error('auth.signup_failed', { email, error: restaurantError.message })
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  if (!restaurant) {
    await serviceClient.auth.admin.deleteUser(userId)
    log.error('auth.signup_failed', { email, error: 'restaurant_insert_null' })
    return { message: 'Erro ao criar restaurante. Tente novamente.' }
  }

  const { error: staffError } = await serviceClient
    .from('restaurant_staff')
    .insert({ restaurant_id: restaurant.id, user_id: userId, role: 'owner' })

  if (staffError) {
    // Clean up orphaned restaurant and auth user
    await serviceClient.from('restaurants').delete().eq('id', restaurant.id)
    await serviceClient.auth.admin.deleteUser(userId)
    log.error('auth.signup_failed', { email, error: staffError.message })
    return { message: 'Erro ao configurar acesso. Tente novamente.' }
  }

  // 4. Force session refresh so the JWT hook picks up the new restaurant_staff row.
  // signUp() issues a JWT before restaurant_staff exists — the hook gets null claims.
  // signOut + redirect to login ensures a fresh login issues the correct JWT.
  log.info('auth.signup_completed', { user_id: userId, restaurant_id: restaurant.id, slug })
  await supabase.auth.signOut()
  // Do NOT wrap redirect() in try/catch — Next.js throws a special NEXT_REDIRECT error
  redirect('/login?signup=success')
}

// ---------------------------------------------------------------------------
// login — validates credentials, reads JWT claim, redirects by role
// ---------------------------------------------------------------------------

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager' | 'admin'
  sub: string
  exp: number
}

export async function login(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const validated = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!validated.success) {
    return { message: validated.error.flatten().fieldErrors.email?.[0] ?? 'Dados inválidos' }
  }

  const { email, password } = validated.data

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    log.error('auth.login_failed', { email, error: 'invalid_credentials' })
    return { message: 'Email ou senha inválidos' }
  }

  // Read JWT claims to determine role-based redirect
  // Decode the session's access_token to read app_role (reliable vs app_metadata mirror)
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { message: 'Erro ao iniciar sessão. Tente novamente.' }
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)
  const role = claims.app_role

  log.info('auth.login_completed', { user_id: claims.sub, app_role: role, restaurant_id: claims.restaurant_id })

  if (role === 'owner') {
    redirect('/dashboard/owner')
  } else if (role === 'manager') {
    redirect('/dashboard/manager')
  } else if (role === 'admin') {
    redirect('/dashboard/admin')
  } else {
    // User exists in auth but has no restaurant_staff row — orphaned account
    await supabase.auth.signOut()
    return { message: 'Conta não associada a nenhum restaurante' }
  }
}

// ---------------------------------------------------------------------------
// logout
// ---------------------------------------------------------------------------

export async function logout() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  log.info('auth.logout', { user_id: user?.id })
  await supabase.auth.signOut()
  redirect('/login')
}
