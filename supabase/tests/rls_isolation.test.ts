/**
 * Cross-tenant RLS isolation tests
 *
 * Tests that RLS policies correctly isolate data between tenants using the
 * Supabase JS SDK (not SQL Editor — which bypasses RLS as postgres superuser).
 *
 * Requirements:
 *   - Local Supabase running: `supabase start`
 *   - SUPABASE_URL defaults to http://127.0.0.1:54321
 *   - SUPABASE_SERVICE_ROLE_KEY (from `supabase status`)
 *   - SUPABASE_ANON_KEY (from `supabase status`)
 *
 * Run: npm run test:rls
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// ---------------------------------------------------------------------------
// Configuration — defaults are the local Supabase dev values
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Local dev service role key (safe to default — not a production secret)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  // Local dev anon key (safe to default — not a production secret)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Admin client — bypasses RLS; used for test setup and teardown only
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
// Test state
// ---------------------------------------------------------------------------
let restaurantAId: string
let restaurantBId: string
let ownerAId: string
let ownerBId: string

// Unique per test run to avoid collisions with seed data or parallel runs
const RUN_ID = Date.now()
const OWNER_A_EMAIL = `owner-a-${RUN_ID}@test-rls.invalid`
const OWNER_B_EMAIL = `owner-b-${RUN_ID}@test-rls.invalid`
const TEST_PASSWORD = 'rls-test-password-32chars-long!!'

// ---------------------------------------------------------------------------
// Test setup — create isolated restaurants, customers, and auth users
// ---------------------------------------------------------------------------
beforeAll(async () => {
  // 1. Create two restaurants
  const { data: restA, error: errA } = await admin
    .from('restaurants')
    .insert({ name: 'RLS Test Restaurant A', slug: `rls-test-a-${RUN_ID}` })
    .select('id')
    .single()
  if (errA || !restA) throw new Error(`Failed to create restaurant A: ${errA?.message}`)
  restaurantAId = restA.id

  const { data: restB, error: errB } = await admin
    .from('restaurants')
    .insert({ name: 'RLS Test Restaurant B', slug: `rls-test-b-${RUN_ID}` })
    .select('id')
    .single()
  if (errB || !restB) throw new Error(`Failed to create restaurant B: ${errB?.message}`)
  restaurantBId = restB.id

  // 2. Create 2 ranks per restaurant
  const { error: rankErr } = await admin.from('ranks').insert([
    { restaurant_id: restaurantAId, name: 'Bronze A', min_points: 0, sort_order: 1 },
    { restaurant_id: restaurantAId, name: 'Silver A', min_points: 100, sort_order: 2 },
    { restaurant_id: restaurantBId, name: 'Bronze B', min_points: 0, sort_order: 1 },
    { restaurant_id: restaurantBId, name: 'Silver B', min_points: 100, sort_order: 2 },
  ])
  if (rankErr) throw new Error(`Failed to create ranks: ${rankErr.message}`)

  // 3. Create 3 customers for Restaurant A, 2 for Restaurant B
  const { error: custErr } = await admin.from('customers').insert([
    { restaurant_id: restaurantAId, name: 'Customer A1', phone: `+551190${RUN_ID}1`, points_balance: 0 },
    { restaurant_id: restaurantAId, name: 'Customer A2', phone: `+551190${RUN_ID}2`, points_balance: 0 },
    { restaurant_id: restaurantAId, name: 'Customer A3', phone: `+551190${RUN_ID}3`, points_balance: 0 },
    { restaurant_id: restaurantBId, name: 'Customer B1', phone: `+551190${RUN_ID}4`, points_balance: 0 },
    { restaurant_id: restaurantBId, name: 'Customer B2', phone: `+551190${RUN_ID}5`, points_balance: 0 },
  ])
  if (custErr) throw new Error(`Failed to create customers: ${custErr.message}`)

  // 4. Create auth users (email_confirm: true skips email verification)
  const { data: userAData, error: errUserA } = await admin.auth.admin.createUser({
    email: OWNER_A_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (errUserA || !userAData.user) throw new Error(`Failed to create user A: ${errUserA?.message}`)
  ownerAId = userAData.user.id

  const { data: userBData, error: errUserB } = await admin.auth.admin.createUser({
    email: OWNER_B_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  })
  if (errUserB || !userBData.user) throw new Error(`Failed to create user B: ${errUserB?.message}`)
  ownerBId = userBData.user.id

  // 5. Link owners to their restaurants via restaurant_staff
  const { error: staffErr } = await admin.from('restaurant_staff').insert([
    { restaurant_id: restaurantAId, user_id: ownerAId, role: 'owner' },
    { restaurant_id: restaurantBId, user_id: ownerBId, role: 'owner' },
  ])
  if (staffErr) throw new Error(`Failed to create staff records: ${staffErr.message}`)
}, 60000)

// ---------------------------------------------------------------------------
// Cleanup — remove test data in reverse FK order
// ---------------------------------------------------------------------------
afterAll(async () => {
  await admin.from('reward_redemptions').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('point_transactions').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('sales').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('customers').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('reward_configs').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('ranks').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('restaurant_staff').delete().in('restaurant_id', [restaurantAId, restaurantBId])
  await admin.from('restaurants').delete().in('id', [restaurantAId, restaurantBId])

  if (ownerAId) await admin.auth.admin.deleteUser(ownerAId)
  if (ownerBId) await admin.auth.admin.deleteUser(ownerBId)
}, 60000)

// ---------------------------------------------------------------------------
// Helper — create a fresh authenticated client per test (JWT is baked in)
// ---------------------------------------------------------------------------
async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`)
  return client
}

// ---------------------------------------------------------------------------
// Test cases — 7 isolation assertions
// ---------------------------------------------------------------------------
describe('Cross-tenant RLS isolation', () => {
  it('Restaurant A owner sees only Restaurant A customers', async () => {
    const clientA = await signInAs(OWNER_A_EMAIL, TEST_PASSWORD)
    const { data, error } = await clientA.from('customers').select('*')

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(3)
    const ids = data!.map((c: { restaurant_id: string }) => c.restaurant_id)
    expect(ids.every((id) => id === restaurantAId)).toBe(true)
  })

  it('Restaurant B owner sees only Restaurant B customers', async () => {
    const clientB = await signInAs(OWNER_B_EMAIL, TEST_PASSWORD)
    const { data, error } = await clientB.from('customers').select('*')

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(data!.length).toBeGreaterThanOrEqual(2)
    const ids = data!.map((c: { restaurant_id: string }) => c.restaurant_id)
    expect(ids.every((id) => id === restaurantBId)).toBe(true)
  })

  it('Restaurant A owner cannot see Restaurant B ranks', async () => {
    const clientA = await signInAs(OWNER_A_EMAIL, TEST_PASSWORD)
    const { data, error } = await clientA.from('ranks').select('*')

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    // None of the returned ranks should belong to Restaurant B
    const hasBRanks = data!.some((r: { restaurant_id: string }) => r.restaurant_id === restaurantBId)
    expect(hasBRanks).toBe(false)
  })

  it('Unauthenticated client gets zero rows', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await anonClient.from('customers').select('*')

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('Restaurant A owner cannot insert into Restaurant B', async () => {
    const clientA = await signInAs(OWNER_A_EMAIL, TEST_PASSWORD)
    const { error } = await clientA.from('customers').insert({
      restaurant_id: restaurantBId,
      name: 'Cross-tenant Intruder',
      phone: `+5511900${RUN_ID}9`,
      points_balance: 0,
    })

    // RLS WITH CHECK policy should reject this cross-tenant insert
    expect(error).not.toBeNull()
  })

  it('JWT contains restaurant_id and app_role claims', async () => {
    const clientA = await signInAs(OWNER_A_EMAIL, TEST_PASSWORD)
    const { data } = await clientA.auth.getSession()
    const token = data.session?.access_token
    expect(token).toBeTruthy()

    // Decode JWT payload — base64url decode, no crypto verification needed for reading claims
    const payloadB64 = token!.split('.')[1]
    const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    const payload = JSON.parse(payloadJson) as Record<string, unknown>

    expect(payload.restaurant_id).toBe(restaurantAId)
    expect(payload.app_role).toBe('owner')
  })

  it('Every public table has RLS enabled', async () => {
    // Uses the check_rls_enabled() RPC function (defined in 0004_hooks.sql).
    // Returns one row per public table that has relrowsecurity = false.
    // An empty result means all tables have RLS enabled — this is the pass condition.
    const { data, error } = await admin.rpc('check_rls_enabled')

    expect(error).toBeNull()

    if (data && data.length > 0) {
      const tableNames = (data as Array<{ relname: string }>).map((r) => r.relname)
      throw new Error(
        `CI FAILURE: The following public tables do not have RLS enabled: ${tableNames.join(', ')}. ` +
        'Add RLS policies or run ALTER TABLE <name> ENABLE ROW LEVEL SECURITY.'
      )
    }

    expect(data).toHaveLength(0)
  })
})
