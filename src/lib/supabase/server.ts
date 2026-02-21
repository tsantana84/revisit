import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client authenticated with the current Clerk user's JWT.
 * The JWT comes from a Clerk JWT Template named 'supabase' that includes
 * restaurant_id and app_role claims for RLS.
 *
 * Use in Server Actions, Route Handlers, and Server Components.
 */
export async function createClerkSupabaseClient() {
  const { getToken } = await auth()
  const token = await getToken({ template: 'supabase' })

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    }
  )
}
