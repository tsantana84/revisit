import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { jwtDecode } from 'jwt-decode'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevisitClaims {
  restaurant_id?: string
  app_role?: 'owner' | 'manager'
  sub: string
  exp: number
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CreateManagerSchema = z.object({
  email: z.string().email('Email inválido').trim(),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres'),
})

// ---------------------------------------------------------------------------
// Auth helper — verify caller is an authenticated owner, return claims
// ---------------------------------------------------------------------------

async function verifyOwner(): Promise<
  | { ok: true; claims: RevisitClaims & { restaurant_id: string } }
  | { ok: false; status: number; message: string }
> {
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false, status: 401, message: 'Não autenticado' }
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { ok: false, status: 401, message: 'Sessão não encontrada' }
  }

  const claims = jwtDecode<RevisitClaims>(session.access_token)

  if (claims.app_role !== 'owner') {
    return { ok: false, status: 403, message: 'Acesso negado: apenas proprietários podem realizar esta ação' }
  }

  if (!claims.restaurant_id) {
    return { ok: false, status: 403, message: 'Restaurante não encontrado no token' }
  }

  return { ok: true, claims: claims as RevisitClaims & { restaurant_id: string } }
}

// ---------------------------------------------------------------------------
// POST /api/staff — create manager account
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // 1. Verify caller is an authenticated owner
  const auth = await verifyOwner()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { claims } = auth

  // 2. Parse and validate request body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const validated = CreateManagerSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validated.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email, password } = validated.data

  // 3. Create manager auth user via admin API
  const serviceClient = createServiceClient()

  const { data: userData, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // owner is setting password directly — skip email verification
  })

  if (createError || !userData.user) {
    return NextResponse.json(
      { error: createError?.message ?? 'Erro ao criar usuário' },
      { status: 400 }
    )
  }

  const newUserId = userData.user.id

  // 4. Insert restaurant_staff row atomically
  const { error: staffError } = await serviceClient
    .from('restaurant_staff')
    .insert({ restaurant_id: claims.restaurant_id, user_id: newUserId, role: 'manager' })

  if (staffError) {
    // Cleanup orphaned auth user to maintain atomicity
    await serviceClient.auth.admin.deleteUser(newUserId)
    return NextResponse.json(
      { error: 'Erro ao associar gerente ao restaurante' },
      { status: 500 }
    )
  }

  // 5. Return 201 with created manager info
  return NextResponse.json(
    { success: true, manager: { id: newUserId, email } },
    { status: 201 }
  )
}

// ---------------------------------------------------------------------------
// GET /api/staff — list managers for the authenticated owner's restaurant
// ---------------------------------------------------------------------------

export async function GET() {
  // Verify caller is an authenticated owner
  const auth = await verifyOwner()
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status })
  }

  const { claims } = auth

  const serviceClient = createServiceClient()

  const { data: staff, error } = await serviceClient
    .from('restaurant_staff')
    .select('id, user_id, role, created_at')
    .eq('restaurant_id', claims.restaurant_id)
    .eq('role', 'manager')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar gerentes' }, { status: 500 })
  }

  // Enrich with emails from auth.users
  const enriched = await Promise.all(
    (staff ?? []).map(async (s) => {
      const { data } = await serviceClient.auth.admin.getUserById(s.user_id)
      return { ...s, email: data?.user?.email ?? null }
    })
  )

  return NextResponse.json({ staff: enriched })
}
