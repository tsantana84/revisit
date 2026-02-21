import { Webhook } from 'svix'
import { headers } from 'next/headers'
import { WebhookEvent } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'
import { log } from '@/lib/logger'

export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    log.error('webhook.clerk_missing_secret', {})
    return new Response('Webhook secret not configured', { status: 500 })
  }

  // Verify webhook signature
  const headerPayload = await headers()
  const svix_id = headerPayload.get('svix-id')
  const svix_timestamp = headerPayload.get('svix-timestamp')
  const svix_signature = headerPayload.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await request.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let event: WebhookEvent

  try {
    event = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent
  } catch (err) {
    log.error('webhook.clerk_verification_failed', { error: (err as Error).message })
    return new Response('Webhook verification failed', { status: 400 })
  }

  // Handle user.created — insert restaurant_staff for invited managers
  if (event.type === 'user.created') {
    const { id: userId, public_metadata } = event.data
    const metadata = public_metadata as Record<string, unknown> | undefined
    const restaurantId = metadata?.restaurant_id as string | undefined
    const appRole = metadata?.app_role as string | undefined

    if (restaurantId && appRole === 'manager') {
      const serviceClient = createServiceClient()

      const { error } = await serviceClient
        .from('restaurant_staff')
        .insert({ restaurant_id: restaurantId, user_id: userId, role: 'manager' })

      if (error) {
        log.error('webhook.staff_creation_failed', { user_id: userId, restaurant_id: restaurantId, error: error.message })
        return new Response('Failed to create staff record', { status: 500 })
      }

      log.info('webhook.manager_created', { user_id: userId, restaurant_id: restaurantId })
    } else {
      log.info('webhook.user_created_no_staff', { user_id: userId, has_restaurant: !!restaurantId })
    }
  }

  return new Response('OK', { status: 200 })
}
