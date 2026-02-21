import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role key.
 * Use ONLY in Server Actions and Route Handlers.
 * NEVER import this in client components or pages.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
}
