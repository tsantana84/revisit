# Phase 4: Customer Experience + Analytics - Research

**Researched:** 2026-02-21
**Domain:** Next.js App Router tenant routing, Apple Wallet PKPass generation, Supabase public inserts, React analytics dashboard
**Confidence:** HIGH (primary patterns), MEDIUM (passkit-generator specifics)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Landing page presentation
- Full marketing page layout: hero with restaurant logo, benefits section, how-it-works steps, rank progression, footer CTA
- Restaurant's primary color as dominant background/accents, white content areas, logo prominent at top
- Casual and warm copy tone in pt-BR — "Ganhe pontos toda vez que nos visitar!" style, informal (você)
- Rank progression (Bronze → Prata → Gold → VIP) displayed in how-it-works section with colored visual badges and brief benefit descriptions per rank

#### Registration & onboarding
- CTA opens a modal/drawer with the registration form — customer stays on the same page
- Form fields: name and phone number only (as specified in requirements)
- Phone number uses input mask (XX) XXXXX-XXXX format — no SMS verification for POC
- Post-registration: visual preview of their loyalty card (name, card number, rank) + "Adicionar à Apple Wallet" button below
- Apple Wallet button is the only post-registration action — no Android fallback, customers without iPhones see their card number on the preview only

#### Analytics overview
- Top row of 4-5 stat cards: total customers, total points issued, total sales count, total revenue tracked
- Rank distribution chart — Claude's discretion on chart type (bar vs donut)
- Period selector: 7d / 30d / 90d / All time — metrics and charts update per selection
- Analytics as a section/tab within the existing owner dashboard layout (sidebar navigation), not a separate route

#### Customer list & logs
- Full text search across name, phone, and card number
- Paginated table: 20-50 rows per page with next/previous navigation
- Sales log ("Vendas") and manager audit log ("Atividade") as separate tabs — clear separation
- Clicking a customer row opens a slide-out side panel with full customer details and transaction history

### Claude's Discretion
- Rank distribution chart type (horizontal bar vs donut/pie)
- Loading skeleton design for analytics
- Exact stat card styling and spacing
- Error state handling across all surfaces
- Side panel layout for customer detail view
- Table column widths and responsive behavior

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | Customer can register with only name and phone number on a white-label landing page | Dynamic tenant route `app/[slug]/page.tsx`, service role insert to `customers` table, card number generation, PKPass via API route |
| DASH-01 | Owner can view analytics overview: total customers, total points issued, total sales, total revenue tracked, rank distribution chart | Supabase aggregation queries scoped by `restaurant_id` + optional date filter; Recharts in client component; searchParams period selector |
| DASH-02 | Owner can view searchable customer list with rank, points, visits, total spend, and registration date | searchParams-driven server component table with `ILIKE` on name/phone/card_number; pagination via `range()`; slide-out panel via URL state |
| DASH-03 | Owner can view full sales log: customer, card number, value, points credited, which manager registered, date and time | JOIN query on `active_sales` + `customers` + `restaurant_staff`; paginated table; searchParams period filter |
| DASH-04 | Owner can see audit log of all manager activity | `active_point_transactions` or dedicated audit log query scoped by restaurant; separate tab from sales log |
</phase_requirements>

---

## Summary

Phase 4 spans two distinct surfaces: a public customer-facing landing page per restaurant tenant, and an owner-facing analytics extension inside the existing dashboard. The infrastructure is already in place — the middleware slug resolver injects `x-restaurant-id` headers into all tenant routes, and all tables have RLS + soft-delete views. The main new technical work is: (1) the public-facing landing page with registration modal and card creation, (2) PKPass generation via a Next.js Route Handler, and (3) analytics queries with period filtering.

The critical decision for customer registration is how to insert into `customers` without an authenticated user. The correct approach is a Server Action that uses the **service role client** (`createServiceClient()`), which bypasses RLS. This is already the pattern used in middleware slug resolution. The landing page reads `x-restaurant-id` from request headers (injected by middleware) and passes it to Server Actions via hidden fields. No new RLS policies are needed for `anon` users.

For analytics, Recharts requires `"use client"` components, so the pattern is: Server Component page fetches data → passes as props to client chart components. Period filtering uses `searchParams` (Promise in Next.js 16) as URL state, making the filter server-driven and bookmarkable. For the rank distribution chart, a **donut chart** is the recommendation because it shows proportions and can display total customer count in the center, which is more informative than a bar chart for a small number of categories (4 ranks).

**Primary recommendation:** Use the existing service client pattern for customer insertion, use Next.js Route Handlers for PKPass generation (mandatory — passkit-generator requires Node.js runtime, not Edge), and use searchParams-driven Server Components for all analytics filtering.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `passkit-generator` | latest (v5.x) | PKPass file generation | Only maintained Node.js PKPass library; library previously committed for Phase 4 |
| `recharts` | latest (v2.x) | Analytics charts | Most widely used React chart library; client-only, works perfectly as "use client" component |
| `next` | ^16.1.6 (current) | App Router, Route Handlers, Server Actions | Already in project |
| `@supabase/supabase-js` | ^2.97.0 (current) | DB queries for analytics and customer insert | Already in project |
| `zod` | ^4.3.6 (current) | Validation of registration form fields | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-input/mask` | latest | Phone number input masking | Lightweight, React 19 compatible; handles `(XX) XXXXX-XXXX` format declaratively |
| Built-in `<dialog>` / CSS | — | Modal/drawer for registration | No library needed; `<dialog>` element handles focus trap and accessibility natively |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `recharts` | `chart.js` / `victory` | Recharts is the standard for React; chart.js has worse React DX; victory is heavier |
| `@react-input/mask` | Custom hook | Custom hook is ~30 lines and perfectly viable for a fixed phone format; either is fine |
| `<dialog>` native | Headless UI / Radix | No new dependency; `<dialog>` has full browser support; fits the project's inline-style pattern |

**Installation:**
```bash
npm install passkit-generator recharts @react-input/mask
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/app/
├── [slug]/                          # Tenant landing page (public, no auth)
│   ├── layout.tsx                   # Reads x-restaurant-id header, fetches branding
│   ├── page.tsx                     # Landing page content + registration modal
│   └── RegistrationModal.tsx        # 'use client' modal with form + card preview
│
├── api/
│   └── pass/
│       └── [cardNumber]/
│           └── route.ts             # GET → generate + serve .pkpass (Node.js runtime)
│
└── dashboard/
    └── owner/
        ├── layout.tsx               # Existing sidebar (add "Analytics" + "Clientes" links)
        ├── analytics/
        │   └── page.tsx             # Analytics overview, period selector via searchParams
        ├── customers/
        │   └── page.tsx             # Customer list + searchParams search/page
        └── logs/
            └── page.tsx             # Sales log + audit log tabs via searchParams

src/lib/
├── actions/
│   └── customer.ts                  # registerCustomer() Server Action (service role insert)
└── supabase/
    └── service.ts                   # Existing createServiceClient()
```

### Pattern 1: Tenant Landing Page — Reading x-restaurant-id from Headers

**What:** Middleware already injects `x-restaurant-id` and `x-restaurant-name` headers. The landing page reads them via `headers()` from `next/headers`.

**When to use:** All public tenant routes (`app/[slug]/*`) need restaurant context without requiring auth.

**Example:**
```typescript
// Source: existing middleware pattern + Next.js headers() docs
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

// app/[slug]/layout.tsx
export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const restaurantId = headersList.get('x-restaurant-id')
  const restaurantName = headersList.get('x-restaurant-name')

  if (!restaurantId) notFound()

  // Fetch branding data using service client (no auth needed)
  // Pass restaurantId to children via context or props
  return <>{children}</>
}
```

**Important:** `headers()` is async in Next.js 15+. Always await it.

### Pattern 2: generateMetadata for White-Label SEO

**What:** Each tenant slug generates its own title and description. No "Revisit" branding in any rendered HTML, title tags, or meta tags.

**When to use:** Required for CARD-01 success criterion — no REVISIT branding visible.

**Example:**
```typescript
// Source: Next.js official docs (verified, doc-version 16.1.6)
// app/[slug]/page.tsx
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params  // MUST await — params is a Promise in Next.js 15+

  // Fetch restaurant branding (use service client — public route, no auth)
  const restaurant = await fetchRestaurantBySlug(slug)
  if (!restaurant) return { title: 'Not Found' }

  return {
    title: restaurant.program_name ?? restaurant.name,  // e.g. "Programa Fidelidade Burgers & Co"
    description: `Ganhe pontos toda vez que visitar ${restaurant.name}!`,
    // No og:site_name, no "Revisit" references
  }
}
```

### Pattern 3: Customer Registration — Service Role Insert

**What:** Public (unauthenticated) customer registration inserts into `customers` table. RLS blocks `anon` role, so a Server Action using `createServiceClient()` bypasses RLS server-side.

**When to use:** Any public route that needs to write to a Supabase table with RLS enabled.

**Example:**
```typescript
// Source: existing pattern in src/lib/supabase/service.ts + middleware.ts
// src/lib/actions/customer.ts
'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { generateCardNumber } from '@/lib/utils/card-number'
import { z } from 'zod'

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\d{10,11}$/, 'Telefone inválido'),
  restaurant_id: z.string().uuid(),
})

export async function registerCustomer(prevState: unknown, formData: FormData) {
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    phone: (formData.get('phone') as string)?.replace(/\D/g, ''),
    restaurant_id: formData.get('restaurant_id') as string,
  }

  const parsed = RegisterSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message }

  const { name, phone, restaurant_id } = parsed.data

  const supabase = createServiceClient()

  // Check for duplicate phone in this restaurant
  const { data: existing } = await supabase
    .from('customers')
    .select('id, card_number, name')
    .eq('restaurant_id', restaurant_id)
    .eq('phone', phone)
    .is('deleted_at', null)
    .single()

  if (existing) {
    // Customer already registered — return their card number
    return { success: true, cardNumber: existing.card_number, name: existing.name, isExisting: true }
  }

  // Generate card number
  const cardNumber = await generateNextCardNumber(supabase, restaurant_id)

  // Get bronze rank (sort_order = 1)
  const { data: bronzeRank } = await supabase
    .from('active_ranks')
    .select('id, name')
    .eq('restaurant_id', restaurant_id)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single()

  const { data: customer, error } = await supabase
    .from('customers')
    .insert({
      restaurant_id,
      name,
      phone,
      card_number: cardNumber,
      points_balance: 0,
      visit_count: 0,
      current_rank_id: bronzeRank?.id ?? null,
    })
    .select('id, card_number, name')
    .single()

  if (error) {
    if (error.code === '23505') return { error: 'Telefone já cadastrado.' }
    return { error: 'Erro ao cadastrar. Tente novamente.' }
  }

  return { success: true, cardNumber: customer.card_number, name: customer.name }
}
```

**Security note:** `restaurant_id` comes from the form as a hidden field. The service client bypasses RLS, so validate that the restaurant_id is real (the middleware already verified the slug → restaurant_id mapping). Alternatively read `x-restaurant-id` header inside the Server Action via `headers()` — this is more secure and avoids trusting hidden form fields.

**CRITICAL:** Read `x-restaurant-id` from headers inside the Server Action instead of a hidden form field. The middleware injects this header from the database-verified slug; it cannot be spoofed by a client.

### Pattern 4: PKPass Generation — Route Handler (Node.js Runtime)

**What:** A GET Route Handler that generates a PKPass buffer and serves it with `Content-Type: application/vnd.apple.pkpass`.

**When to use:** Required because passkit-generator uses Node.js-only APIs (zlib, crypto). Cannot run in Edge Runtime or Supabase Edge Functions. Previously committed prior decision.

**Example:**
```typescript
// Source: passkit-generator docs + Next.js route handler docs
// app/api/pass/[cardNumber]/route.ts
import { PKPass } from 'passkit-generator'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'  // REQUIRED — passkit-generator won't work on edge

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardNumber: string }> }
) {
  const { cardNumber } = await params

  const supabase = createServiceClient()

  // Fetch customer + restaurant branding
  const { data: customer } = await supabase
    .from('customers')
    .select('id, name, card_number, points_balance, current_rank_id, restaurant_id')
    .eq('card_number', cardNumber)
    .is('deleted_at', null)
    .single()

  if (!customer) return new Response('Not found', { status: 404 })

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('name, program_name, primary_color, logo_url')
    .eq('id', customer.restaurant_id)
    .single()

  const { data: rank } = await supabase
    .from('active_ranks')
    .select('name')
    .eq('id', customer.current_rank_id)
    .single()

  // Load certificates from environment variables
  // Cert strings stored as env vars (base64 or PEM)
  const pass = new PKPass({}, {
    wwdr: Buffer.from(process.env.APPLE_WWDR_CERT!, 'base64'),
    signerCert: Buffer.from(process.env.APPLE_SIGNER_CERT!, 'base64'),
    signerKey: Buffer.from(process.env.APPLE_SIGNER_KEY!, 'base64'),
  }, {
    serialNumber: customer.id,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_IDENTIFIER!,
    teamIdentifier: process.env.APPLE_TEAM_IDENTIFIER!,
    organizationName: restaurant?.program_name ?? restaurant?.name ?? 'Fidelidade',
    description: `Cartão fidelidade - ${restaurant?.name}`,
    foregroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(255, 255, 255)',
    backgroundColor: hexToRgb(restaurant?.primary_color ?? '#000000'),
  })

  // Set pass type
  pass.type = 'storeCard'

  // Set fields
  pass.primaryFields.push({
    key: 'name',
    label: 'NOME',
    value: customer.name,
  })

  pass.secondaryFields.push(
    { key: 'points', label: 'PONTOS', value: String(customer.points_balance) },
    { key: 'rank', label: 'NÍVEL', value: rank?.name ?? 'Bronze' },
  )

  pass.auxiliaryFields.push({
    key: 'card',
    label: 'CARTÃO',
    value: customer.card_number ?? '',
  })

  const buffer = await pass.getAsBuffer()

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="pass.pkpass"`,
    },
  })
}
```

**Hex to RGB helper needed:** Apple Wallet expects `rgb(R, G, B)` strings, not hex. Convert `primary_color` (stored as hex like `#E63946`) to `rgb(230, 57, 70)`.

**Certificate storage:** Store WWDR cert, signer cert, and signer key as base64-encoded environment variables. Never commit certificates to the repo. Add to `.env.local` and Vercel/deployment env.

### Pattern 5: Analytics with searchParams Period Filtering

**What:** Server Component page reads `searchParams.period` (7d / 30d / 90d / all) and passes date boundaries to Supabase queries. Charts are client components that receive data as props.

**When to use:** All analytics routes. searchParams provides bookmarkable, shareable, server-side filtering.

**Example:**
```typescript
// Source: Next.js official docs (searchParams is Promise in Next.js 16)
// app/dashboard/owner/analytics/page.tsx
type Props = {
  searchParams: Promise<{ period?: string }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const { period = '30d' } = await searchParams  // MUST await

  const since = periodToDate(period)  // Returns Date | null (null = all time)

  const supabase = await createClient()
  // ... build queries with optional .gte('created_at', since.toISOString())

  const [stats, rankDist] = await Promise.all([
    fetchStats(supabase, restaurantId, since),
    fetchRankDistribution(supabase, restaurantId),
  ])

  return (
    <div>
      <PeriodSelector current={period} />     {/* 'use client' — updates URL */}
      <StatCards stats={stats} />              {/* Server component */}
      <RankDonutChart data={rankDist} />       {/* 'use client' — Recharts */}
    </div>
  )
}
```

### Pattern 6: Customer List — searchParams Pagination + Search

**What:** URL carries `?q=search&page=1`. Server Component fetches paginated results. No client state needed for the list itself.

**Example:**
```typescript
// app/dashboard/owner/customers/page.tsx
type Props = {
  searchParams: Promise<{ q?: string; page?: string }>
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q = '', page = '1' } = await searchParams
  const pageNum = Math.max(1, parseInt(page))
  const pageSize = 25
  const from = (pageNum - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = await createClient()
  let query = supabase
    .from('active_customers')
    .select('id, name, phone, card_number, points_balance, visit_count, created_at, current_rank_id, ranks!inner(name)', { count: 'exact' })
    .eq('restaurant_id', restaurantId)
    .range(from, to)

  if (q) {
    // Supabase PostgREST OR filter for search across multiple columns
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,card_number.ilike.%${q}%`)
  }

  const { data: customers, count } = await query
  const totalPages = Math.ceil((count ?? 0) / pageSize)
  // Render table + pagination controls
}
```

### Pattern 7: Recharts Client Component Isolation

**What:** Recharts uses browser APIs — it must be in a `'use client'` component. Fetch data in Server Component, pass as props to a thin client chart wrapper.

**Example:**
```typescript
// app/dashboard/owner/analytics/RankDonutChart.tsx
'use client'

import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

interface RankDataPoint {
  name: string   // 'Bronze' | 'Prata' | 'Gold' | 'VIP'
  value: number  // count of customers at this rank
}

const RANK_COLORS = {
  Bronze: '#CD7F32',
  Prata:  '#C0C0C0',
  Gold:   '#FFD700',
  VIP:    '#9b59b6',
}

export function RankDonutChart({ data }: { data: RankDataPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <PieChart width={320} height={280}>
      <Pie
        data={data}
        cx={160}
        cy={120}
        innerRadius={70}
        outerRadius={110}
        dataKey="value"
      >
        {data.map((entry) => (
          <Cell key={entry.name} fill={RANK_COLORS[entry.name as keyof typeof RANK_COLORS] ?? '#8884d8'} />
        ))}
      </Pie>
      <Tooltip formatter={(value: number) => [`${value} clientes`, '']} />
      <Legend />
    </PieChart>
  )
}
```

**Recommendation: donut chart** over horizontal bar for rank distribution. Rationale: there are only 4 categories (Bronze/Prata/Gold/VIP); donut shows part-whole relationship clearly; center can display total customer count. Research confirms donut charts are preferred for dashboards when the goal is showing proportions at a glance (not precise comparison).

### Anti-Patterns to Avoid

- **Trust hidden form fields for restaurant_id:** A malicious user could change the restaurant_id in the form. Instead, read `x-restaurant-id` header inside the Server Action via `headers()` — this is middleware-injected from the database-verified slug.
- **Import Recharts in a Server Component:** Will fail at build. All Recharts components need `'use client'`.
- **Using Edge Runtime for the PKPass route:** passkit-generator depends on Node.js built-ins (zlib, crypto). Always set `export const runtime = 'nodejs'` on the route handler.
- **Storing Apple certificates in the repository:** PEM/DER files contain private keys. Store as base64 env vars only.
- **Reading `searchParams` synchronously in Next.js 16:** Both `params` and `searchParams` are Promises in Next.js 15+. Always `await searchParams` before destructuring.
- **Syncing search input to URL with instant navigation:** Each keystroke triggers a server fetch. Debounce the URL push using `useTransition` and/or `setTimeout` (~300ms) to prevent excessive requests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKPass signing + zipping | Custom zip + crypto signing | `passkit-generator` | Pass signing requires specific Apple certificate chain validation, PKCS#7 signature, manifest SHA1 hashing, and precise zip structure — hundreds of edge cases |
| Phone input masking | Custom `onChange` formatter | `@react-input/mask` or simple controlled input hook | Cursor position handling during mask application is non-trivial; existing libraries handle backspace, paste, mobile keyboard correctly |
| Chart rendering | SVG drawing by hand | `recharts` | D3-based math, axis scaling, tooltip positioning, responsive containers are significant effort |
| Pagination math | Custom offset/limit | Supabase `.range(from, to)` + total `count` from `select(..., { count: 'exact' })` | Already built into Supabase PostgREST |

**Key insight:** The pass generation flow is deceptively complex — Apple's validation is strict about WWDR G4 certificate chain, manifest format, and signature envelope. `passkit-generator` encapsulates all of this.

---

## Common Pitfalls

### Pitfall 1: params / searchParams Must Be Awaited
**What goes wrong:** TypeScript error or runtime crash when accessing `params.slug` or `searchParams.period` synchronously.
**Why it happens:** Next.js 15 made `params` and `searchParams` async (Promise) to support streaming. Next.js 16 (current: ^16.1.6) continues this pattern. The package.json shows `"next": "^16.1.6"`.
**How to avoid:** Always `const { slug } = await params` in Server Components and Route Handlers. In Client Components, use React's `use(params)` hook.
**Warning signs:** TypeScript showing `params` type as `Promise<{ slug: string }>`.

### Pitfall 2: WWDR Certificate Must Be G4
**What goes wrong:** Pass generation succeeds locally but Apple Wallet rejects the pass on device.
**Why it happens:** Apple deprecated WWDR G2/G3/G5/G6. Only G4 is accepted for new passes.
**How to avoid:** Download WWDR G4 explicitly from https://www.apple.com/certificateauthority/ — filename is `AppleWWDRCAG4.cer`.
**Warning signs:** Passes open but show "Invalid Pass" or silently fail to add.

### Pitfall 3: Service Role Key Exposed Client-Side
**What goes wrong:** `SUPABASE_SERVICE_ROLE_KEY` appears in browser bundle, granting anyone full database access.
**Why it happens:** Using `NEXT_PUBLIC_` prefix or importing service client in a client component.
**How to avoid:** Never prefix with `NEXT_PUBLIC_`. Only use `createServiceClient()` in Server Actions and Route Handlers. The existing `src/lib/supabase/service.ts` is correct — keep all usage server-side only.
**Warning signs:** Key visible in browser DevTools network tab or `__NEXT_DATA__`.

### Pitfall 4: Duplicate Phone Registration
**What goes wrong:** Customer registers twice (refreshes page, double-submit). Two records with same phone created.
**Why it happens:** `customers` table has `UNIQUE(restaurant_id, phone)` constraint but race conditions can occur.
**How to avoid:** Catch Postgres `error.code === '23505'` (unique violation) in the Server Action and return the existing customer's card instead of an error. This makes registration idempotent — a retry shows the existing card.

### Pitfall 5: Modal Registration Form Missing restaurant_id
**What goes wrong:** Customer registration server action can't determine which restaurant to insert into.
**Why it happens:** Registration form is in a `'use client'` modal; the header `x-restaurant-id` is not automatically available in client components.
**How to avoid:** Two options: (a) pass `restaurantId` as a prop from the server-rendered page to the modal, or (b) read `x-restaurant-id` header inside the Server Action via `headers()` from `next/headers`. Option (b) is more secure — use it.

### Pitfall 6: Analytics Queries Without Date Index
**What goes wrong:** Period filtering slows dramatically as sales table grows.
**Why it happens:** `created_at` column on `sales` and `point_transactions` has no index in current migrations.
**How to avoid:** Add index in Phase 4 migration: `CREATE INDEX idx_sales_restaurant_created ON public.sales(restaurant_id, created_at DESC);` and same for `point_transactions`.

### Pitfall 7: Apple Wallet Button Shown on Non-iOS
**What goes wrong:** Android / desktop users see an "Adicionar à Apple Wallet" button that leads nowhere or errors.
**Why it happens:** Button is rendered unconditionally.
**How to avoid:** The button is in the post-registration card preview (client component). Detect iOS via `navigator.userAgent` in a `useEffect`. If not iOS, render card number only with a note like "Guarde este número: #0001-9". This matches the locked decision.

---

## Code Examples

### Analytics Aggregation Queries

```typescript
// Total customers count
const { count: totalCustomers } = await supabase
  .from('active_customers')
  .select('id', { count: 'exact', head: true })
  .eq('restaurant_id', restaurantId)

// Total points issued (sum of all positive point_transactions)
const { data: pointsData } = await supabase
  .from('active_point_transactions')
  .select('points_delta')
  .eq('restaurant_id', restaurantId)
  .eq('transaction_type', 'earn')
  .gte('created_at', since ?? '1970-01-01')  // period filter

const totalPointsIssued = (pointsData ?? []).reduce((sum, r) => sum + r.points_delta, 0)

// NOTE: For large datasets, use a Postgres RPC function instead of fetching all rows.
// A migration adding get_analytics_overview(restaurant_id, since) RPC is recommended.

// Rank distribution
const { data: rankCounts } = await supabase
  .from('active_customers')
  .select('current_rank_id, ranks!inner(name)')
  .eq('restaurant_id', restaurantId)
// Group client-side or via RPC
```

**Performance note:** For DASH-01 aggregation (total points issued, total revenue), fetching all rows and summing client-side will degrade on large datasets. Create a `SECURITY DEFINER` PostgreSQL RPC `get_analytics_overview(p_restaurant_id UUID, p_since TIMESTAMPTZ)` that returns aggregates directly from the DB. This follows the existing pattern (`register_sale`, `register_redemption`).

### Sales Log Query (DASH-03)

```typescript
// Join sales + customer + staff for the sales log
const { data: sales } = await supabase
  .from('active_sales')
  .select(`
    id, amount_cents, points_earned, created_at,
    customers!inner(name, card_number),
    restaurant_staff!inner(users!inner(email))
  `)
  .eq('restaurant_id', restaurantId)
  .gte('created_at', since ?? '1970-01-01')
  .order('created_at', { ascending: false })
  .range(from, to)
```

**Note:** `restaurant_staff` links to `auth.users` via `user_id`. To display manager name/email, join through `restaurant_staff`. The current schema does not store a display name on `restaurant_staff` — manager identity is via `auth.users.email`.

### Audit Log Query (DASH-04)

The audit log (DASH-04) maps to `active_point_transactions`. Each row has `transaction_type` ('earn', 'redeem', 'adjustment'), `reference_id` (links to sales or redemptions), and `created_at`. The `note` column can store manager context. To show "who registered each action", join via `sales.staff_id → restaurant_staff`.

```typescript
// Audit log: all point transactions with customer info
const { data: auditLog } = await supabase
  .from('active_point_transactions')
  .select(`
    id, points_delta, balance_after, transaction_type, note, created_at,
    customers!inner(name, card_number)
  `)
  .eq('restaurant_id', restaurantId)
  .order('created_at', { ascending: false })
  .range(from, to)
```

### PKPass Route — Serving Binary Response

```typescript
// app/api/pass/[cardNumber]/route.ts
export const runtime = 'nodejs'  // Required

export async function GET(request: Request, { params }: { params: Promise<{ cardNumber: string }> }) {
  const { cardNumber } = await params
  // ... generate pass ...
  const buffer = await pass.getAsBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': 'attachment; filename="pass.pkpass"',
      'Cache-Control': 'no-store',  // Pass data is dynamic — never cache
    },
  })
}
```

### Phone Input Mask — Custom Controlled Input

```typescript
// 'use client' — simple controlled input for (XX) XXXXX-XXXX
function PhoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
    // Format: (XX) XXXXX-XXXX
    let formatted = digits
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    onChange(formatted)
  }
  return <input type="tel" value={value} onChange={handleChange} placeholder="(11) 99999-9999" />
}
```

**Rationale for hand-rolling phone mask:** The phone format is fixed (`(XX) XXXXX-XXXX`). A simple controlled input with digit extraction and formatting is ~10 lines and avoids a dependency. Only use `@react-input/mask` if cursor positioning becomes problematic during testing.

### Sidebar Navigation Update

The existing `app/dashboard/owner/layout.tsx` hardcodes sidebar links. Add "Análises" and "Clientes" links:

```typescript
// In existing layout.tsx sidebar nav section — add links:
<a href="/dashboard/owner/analytics">Análises</a>
<a href="/dashboard/owner/customers">Clientes</a>
<a href="/dashboard/owner/logs">Registros</a>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sync `params` access in Next.js pages | `params` is a `Promise<{}>` — must await | Next.js 15 | All Server Components and Route Handlers reading params need `await params` |
| `searchParams` as plain object prop | `searchParams` is also a `Promise` | Next.js 15 | Same — must await before destructuring |
| API routes in `pages/api/` | Route Handlers in `app/api/` (Route Handlers) | Next.js 13 (App Router) | Project already uses App Router — use `route.ts` files |
| Apple WWDR G2/G3 certificates | Only WWDR G4 accepted | ~2023 | Must use G4 — other generations silently rejected |
| Passbook (old PKPass format) | PassKit with NFC support | iOS 12+ | `storeCard` type supports basic loyalty cards without NFC |

**Deprecated/outdated:**
- `pages/api/` routes: Project uses App Router. Don't create new files here.
- Synchronous `params` access: Deprecated in Next.js 15, will error in future versions.

---

## Open Questions

1. **Card number generation for new customers**
   - What we know: `generateCardNumber()` utility exists in `src/lib/utils/card-number.ts`; the check digit logic is Luhn-based.
   - What's unclear: How does the Server Action determine the next sequential number? Is there a counter in the DB, or does it scan `MAX(card_number)`?
   - Recommendation: Read `card-number.ts` before implementing `registerCustomer()`. Likely needs a `MAX(card_number)` query on `customers WHERE restaurant_id = $1` to determine next sequence number. This may need a DB lock for concurrent registrations — use a Postgres sequence or a `SECURITY DEFINER` RPC to atomically generate and reserve a card number.

2. **Analytics RPC vs client-side aggregation**
   - What we know: `register_sale` and `register_redemption` RPCs follow SECURITY DEFINER pattern.
   - What's unclear: Whether an analytics RPC is needed for Phase 4 or client-side aggregation of fetched rows is acceptable for POC scale.
   - Recommendation: Start with client-side aggregation. If the query pulls >1000 rows (unlikely at POC scale), add a `get_analytics_overview` RPC in the Phase 4 migration.

3. **DASH-04 Audit Log scope**
   - What we know: `point_transactions` has `transaction_type` and `note`. `sales` has `staff_id`.
   - What's unclear: Whether "manager activity audit log" means only sales registered by managers, or all system events (redemptions, adjustments, logins). The requirement says "who registered each sale and when."
   - Recommendation: Show `point_transactions` joined with `sales` and `restaurant_staff` to show which manager triggered each earn transaction. Redemption transactions linked to `reward_redemptions` (no `staff_id` — customer self-initiated). Label transaction types clearly.

4. **Apple Wallet certificate availability**
   - What we know: Prior decision states "Apple Developer Program enrollment + Pass Type ID + WWDR G4 certificate must be in place before Phase 4 starts."
   - What's unclear: Whether these are actually in place. The `.env.local` must have `APPLE_WWDR_CERT`, `APPLE_SIGNER_CERT`, `APPLE_SIGNER_KEY`, `APPLE_PASS_TYPE_IDENTIFIER`, `APPLE_TEAM_IDENTIFIER`.
   - Recommendation: Verify env vars before starting PKPass implementation. If certificates are not ready, implement the landing page + registration first, then add PKPass as a second task.

---

## Sources

### Primary (HIGH confidence)
- Next.js official docs (doc-version 16.1.6, last-updated 2026-02-20) — `generateMetadata`, Route Handlers, `params` Promise behavior, `headers()` function
- Existing codebase — `src/lib/supabase/service.ts`, `src/lib/supabase/middleware.ts`, `src/app/dashboard/owner/layout.tsx`, migration files — confirmed patterns for service role, tenant headers, RLS
- passkit-generator GitHub README + examples/self-hosted — PKPass creation pattern, `getAsBuffer()`, field configuration
- Supabase docs — RLS with anon key, service role usage

### Secondary (MEDIUM confidence)
- WebSearch: passkit-generator with Next.js API routes — confirmed Node.js runtime requirement, buffer response pattern
- WebSearch: Recharts client component requirement — confirmed `"use client"` necessity
- WebSearch: searchParams URL state for Next.js analytics tables — confirmed server component pattern
- Research paper + shadcn/ui charts docs: donut vs bar chart for rank distribution recommendation

### Tertiary (LOW confidence)
- WebSearch: WWDR G4 only accepted — mentioned in passkit-generator docs but not directly verified against Apple's certificate authority page
- Custom phone input implementation — derived from research, not from a specific authoritative source

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in docs or existing codebase
- Architecture: HIGH — patterns derived from verified Next.js 16 docs and existing codebase patterns
- Pitfalls: HIGH for Next.js patterns (verified), MEDIUM for Apple Wallet certificate specifics (single source)
- Analytics queries: HIGH — Supabase PostgREST query patterns verified

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (30 days for stable libraries; Next.js release cadence is the main risk)
