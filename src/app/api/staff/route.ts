import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { requireOwner } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { z } from 'zod'
import { log } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const InviteManagerSchema = z.object({
  email: z.string().email('Email inválido').trim(),
})

// ---------------------------------------------------------------------------
// POST /api/staff — invite a manager via Clerk Invitations
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let owner
  try {
    owner = await requireOwner()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
  }

  const validated = InviteManagerSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: validated.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { email } = validated.data

  try {
    const clerk = await clerkClient()
    await clerk.invitations.createInvitation({
      emailAddress: email,
      publicMetadata: {
        restaurant_id: owner.restaurantId,
        app_role: 'manager',
      },
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/signup`,
    })

    log.info('staff.invited', { restaurant_id: owner.restaurantId, user_id: owner.userId, invited_email: email })
    return NextResponse.json({ success: true, email }, { status: 201 })
  } catch (err) {
    const message = (err as Error).message
    log.error('staff.invitation_failed', { restaurant_id: owner.restaurantId, error: message })
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

// ---------------------------------------------------------------------------
// GET /api/staff — list managers for the authenticated owner's restaurant
// ---------------------------------------------------------------------------

export async function GET() {
  let owner
  try {
    owner = await requireOwner()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 })
  }

  const serviceClient = createServiceClient()

  const { data: staff, error } = await serviceClient
    .from('restaurant_staff')
    .select('id, user_id, role, created_at')
    .eq('restaurant_id', owner.restaurantId)
    .eq('role', 'manager')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Erro ao buscar gerentes' }, { status: 500 })
  }

  // Enrich with emails from Clerk
  const clerk = await clerkClient()
  const enriched = await Promise.all(
    (staff ?? []).map(async (s) => {
      try {
        const user = await clerk.users.getUser(s.user_id)
        return { ...s, email: user.emailAddresses[0]?.emailAddress ?? null }
      } catch {
        return { ...s, email: null }
      }
    })
  )

  log.info('staff.listed', { restaurant_id: owner.restaurantId, user_id: owner.userId, count: enriched.length })
  return NextResponse.json({ staff: enriched })
}
