# Architecture Research

**Domain:** Multi-tenant digital loyalty SaaS — bars and restaurants (Brazil)
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH (Apple Wallet specifics HIGH from official docs; Supabase RLS patterns HIGH from official docs; overall system topology MEDIUM from cross-referenced sources)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER (Browser / iOS)                        │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │  Owner Dashboard │  │  Manager POS     │  │  Customer Landing Page     │ │
│  │  /dashboard      │  │  /pos            │  │  /:slug  (white-label)     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────┬─────────────┘ │
└───────────┼────────────────────┼─────────────────────────────┼───────────────┘
            │                    │                              │
            ▼                    ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       NEXT.JS APPLICATION LAYER (Vercel)                     │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  middleware.ts — Tenant resolution from slug/subdomain                │   │
│  │  Injects: restaurant_id, branding config → request headers           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                               │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐    │
│  │  Server Actions  │  │  API Route:      │  │  API Route:             │    │
│  │  (CRUD ops)      │  │  /api/wallet/    │  │  /api/wallet/apns/      │    │
│  │                  │  │  (pkpass gen)    │  │  (Apple web service)    │    │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬──────────────┘   │
└───────────┼────────────────────┼─────────────────────────┼───────────────────┘
            │                    │                          │
            ▼                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (Backend as a Service)                     │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐    │
│  │  Auth            │  │  PostgreSQL DB   │  │  Realtime              │    │
│  │  (JWT + custom   │  │  (RLS enforced   │  │  (card balance         │    │
│  │   claims:        │  │   per tenant)    │  │   subscriptions)       │    │
│  │   restaurant_id, │  │                  │  │                        │    │
│  │   role)          │  │  ┌────────────┐  │  └────────────────────────┘    │
│  └──────────────────┘  │  │restaurants │  │                                 │
│                         │  │customers   │  │  ┌────────────────────────┐    │
│  ┌──────────────────┐   │  │cards       │  │  │  Storage               │    │
│  │  Edge Functions  │   │  │transactions│  │  │  (logos, .pkpass       │    │
│  │  (auth hooks,    │   │  │apns_devices│  │  │   templates)           │    │
│  │   card number    │   │  └────────────┘  │  └────────────────────────┘    │
│  │   generation)    │   └──────────────────┘                                 │
│  └──────────────────┘                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                   │
│                                                                               │
│  ┌──────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │  Apple Push Notification  │    │  Apple Pass Type Certificate (WWDR)  │   │
│  │  Service (APNs)           │    │  Stored in Vercel env / Supabase     │   │
│  │  (triggers Wallet refresh)│    │  Storage (signing only, never public)│   │
│  └──────────────────────────┘    └──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `middleware.ts` | Resolve tenant from URL slug or subdomain; inject `restaurant_id` into request context; apply white-label branding config | Next.js Middleware, runs at edge before every request |
| Owner Dashboard | Restaurant owner UI — branding setup, reward config, analytics, manager invites | Next.js App Router `/[slug]/dashboard` route group, Supabase Auth (owner role) |
| Manager POS Panel | Record sales, issue stamps/points, look up customer cards in real time | Next.js App Router `/[slug]/pos` route group, real-time Supabase subscription |
| Customer Landing Page | White-labeled page per restaurant — card display, Apple Wallet download button | Next.js App Router `/[slug]` public route, SSR for brand colors/logo |
| Pass Generation API | Build and sign `.pkpass` file on demand; embed `webServiceURL` and `authenticationToken` | Next.js API route, `passkit-generator` npm package, Apple cert secrets |
| Apple Web Service API | Implement the 4 endpoints Apple Wallet calls during pass lifecycle | Next.js API route `/api/wallet/apns/*`, stores device push tokens in DB |
| Supabase Auth + Hooks | Issue JWTs with custom claims (`restaurant_id`, `role`); hook fires on login to embed claims | Supabase Auth, Custom Access Token Hook (Edge Function or DB function) |
| RLS Policies | Database-level tenant isolation — every query filtered by `restaurant_id` from JWT | PostgreSQL RLS with `(select auth.jwt() ->> 'restaurant_id')` pattern |
| Card Number Service | Generate unique card numbers with check-digit (Luhn or proprietary) | Supabase Edge Function or DB function called at card creation |
| APNs Notifier | Send silent push to Apple when a card balance changes | Triggered by DB transaction insert; calls APNs HTTP/2 API with stored push token |

---

## Recommended Project Structure

```
revisit/
├── app/                          # Next.js App Router
│   ├── [slug]/                   # Tenant-scoped routes (resolved by middleware)
│   │   ├── page.tsx              # Customer landing page (public, white-label)
│   │   ├── dashboard/            # Owner UI (protected, owner role)
│   │   │   └── page.tsx
│   │   └── pos/                  # Manager POS panel (protected, manager role)
│   │       └── page.tsx
│   └── api/
│       └── wallet/
│           ├── download/
│           │   └── route.ts      # GET — generate & serve .pkpass
│           └── apns/
│               ├── v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/
│               │   └── route.ts  # POST (register) / DELETE (unregister)
│               ├── v1/devices/[deviceId]/registrations/[passTypeId]/
│               │   └── route.ts  # GET — which passes updated since timestamp
│               └── v1/passes/[passTypeId]/[serial]/
│                   └── route.ts  # GET — serve latest .pkpass to device
├── middleware.ts                  # Tenant resolution + branding injection
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser Supabase client
│   │   └── server.ts             # Server Supabase client (cookies)
│   ├── wallet/
│   │   ├── passGenerator.ts      # pkpass build logic (passkit-generator)
│   │   ├── apns.ts               # APNs HTTP/2 push helper
│   │   └── cardNumber.ts         # Check-digit generation/validation
│   └── tenant/
│       └── resolver.ts           # Tenant lookup by slug (cached)
├── supabase/
│   ├── migrations/               # DB schema migrations
│   └── functions/
│       ├── auth-hook/            # Custom Access Token Hook (embed claims)
│       └── notify-apns/          # Triggered after transaction insert
└── .env.local                    # Apple cert PEM strings, Supabase keys
```

### Structure Rationale

- **`[slug]/`:** Path-based multi-tenancy. Simpler than subdomains — no wildcard DNS setup needed for MVP. Middleware resolves `restaurant_id` from the slug before any route handler runs.
- **`api/wallet/apns/`:** Apple's PassKit web service requires exact URL patterns matching `webServiceURL/v1/...`. These cannot be renamed; they are dictated by the Apple specification.
- **`lib/wallet/`:** Isolates all Apple-specific logic. Certificates and signing never touch client code.
- **`supabase/functions/`:** Edge Functions handle auth hooks (must fire at token issuance) and APNs notifications (triggered by DB events, not application code).

---

## Architectural Patterns

### Pattern 1: JWT Custom Claims for Tenant + Role

**What:** Embed `restaurant_id` and `role` (owner/manager/customer) into the Supabase JWT at login via a Custom Access Token Hook. RLS policies read from JWT — no per-request DB lookup for tenant identity.

**When to use:** Every request that touches the database. This is the foundation of the entire multi-tenant isolation model.

**Trade-offs:** Claims are baked into the token at login; if a user's role changes, they must re-authenticate. Acceptable for this use case.

**Example:**
```sql
-- RLS policy: customers can only see their own card
CREATE POLICY "customer_own_card"
  ON cards
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id = (select auth.jwt() ->> 'restaurant_id')::uuid
    AND customer_id = (select auth.uid())
  );

-- RLS policy: manager sees all cards for their restaurant
CREATE POLICY "manager_see_restaurant_cards"
  ON cards
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id = (select auth.jwt() ->> 'restaurant_id')::uuid
    AND (select auth.jwt() ->> 'role') = 'manager'
  );
```

### Pattern 2: Middleware Tenant Resolution with Cache

**What:** Next.js `middleware.ts` intercepts every request, extracts the slug from `pathname`, looks up `restaurant_id` + branding config from DB (or cache), and rewrites headers before the request reaches any route handler.

**When to use:** Every page render — customer landing, manager POS, owner dashboard.

**Trade-offs:** Middleware runs at the edge on every request. Without caching (e.g., Vercel KV or in-memory LRU), this adds a DB round-trip to every page load. Cache TTL must be short enough that branding changes propagate quickly (60–300 seconds is typical).

**Example:**
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  const slug = request.nextUrl.pathname.split('/')[1];
  if (!slug) return NextResponse.next();

  // Lookup from cache or DB
  const tenant = await getTenantBySlug(slug); // cached
  if (!tenant) return NextResponse.rewrite(new URL('/404', request.url));

  const response = NextResponse.next();
  response.headers.set('x-restaurant-id', tenant.id);
  response.headers.set('x-primary-color', tenant.primaryColor);
  return response;
}
```

### Pattern 3: Apple Wallet Web Service (Required Endpoints)

**What:** Apple Wallet calls your server on a fixed set of REST endpoints derived from `webServiceURL` set in `pass.json`. You must implement all four exactly as Apple specifies; they are not optional.

**When to use:** Any pass that needs to be updatable after installation.

**Trade-offs:** Requires HTTPS with a valid certificate (not self-signed). The `authenticationToken` in the `Authorization: ApplePass <token>` header must be validated on every request to prevent unauthorized updates.

**Required endpoints (exact paths):**
```
POST   /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
         → Device registers; store pushToken from body
         → Response: 201 (new registration) or 200 (already registered)

DELETE /v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
         → Device unregisters; delete stored pushToken
         → Response: 200

GET    /v1/devices/{deviceId}/registrations/{passTypeId}
         ?passesUpdatedSince={timestamp}
         → Return serial numbers of passes updated after timestamp
         → Response: { serialNumbers: [...], lastUpdated: "..." }

GET    /v1/passes/{passTypeId}/{serial}
         → Serve the current .pkpass file
         → Response: 200 with binary .pkpass, or 304 Not Modified
```

**APNs push trigger (server-side, after transaction):**
```typescript
// After recording a sale and updating card balance:
async function notifyWallet(pushToken: string) {
  // Send silent push to APNs — no payload body needed
  // APNs tells the device "check for pass updates"
  // Device then calls GET /v1/devices/.../registrations/...
  await sendApnsNotification(pushToken, {
    aps: {} // empty aps = silent push; Wallet handles the rest
  });
}
```

### Pattern 4: Luhn Check-Digit Card Numbers

**What:** Generate card numbers server-side using a check digit algorithm (Luhn is standard for card numbers, widely understood). Generation happens in a Supabase Edge Function or DB function to ensure uniqueness via a uniqueness constraint + retry loop.

**When to use:** Card creation only. Validation happens at the POS when a manager scans/enters a number.

**Trade-offs:** Luhn prevents accidental typos (1 wrong digit always fails validation) but is not cryptographically secure — not a substitute for authentication. Do not rely on the card number as a secret.

**Example:**
```typescript
function luhnCheckDigit(number: string): number {
  const digits = number.split('').map(Number).reverse();
  const sum = digits.reduce((acc, digit, i) => {
    if (i % 2 === 1) {
      const doubled = digit * 2;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }
    return acc + digit;
  }, 0);
  return (10 - (sum % 10)) % 10;
}
```

---

## Data Flow

### Flow 1: Customer Downloads Apple Wallet Card

```
Customer visits /{slug}
    ↓
middleware.ts resolves slug → restaurant_id, branding
    ↓
Customer Landing Page (SSR) renders white-label UI
    ↓
Customer clicks "Add to Apple Wallet"
    ↓
GET /api/wallet/download?restaurantId=...&customerId=...
    ↓
Server fetches card data from Supabase (RLS: customer sees own card)
    ↓
passkit-generator builds pass.json with:
  - restaurant branding (name, colors, logo URL)
  - card balance / stamps
  - webServiceURL: https://revisit.app/api/wallet/apns
  - authenticationToken: <secret per card>
    ↓
Signs .pkpass with Apple Pass Type Certificate + WWDR
    ↓
Returns binary .pkpass → iOS prompts "Add to Wallet"
    ↓
iOS device POSTs to /api/wallet/apns/v1/devices/{deviceId}/registrations/{passTypeId}/{serial}
  with pushToken in body
    ↓
Server stores: { deviceId, pushToken, serialNumber, restaurant_id } in apns_devices table
```

### Flow 2: Manager Records a Sale → Card Updates in Real Time

```
Manager opens POS panel (/{slug}/pos)
    ↓
Supabase Realtime subscription: listen for card changes (restaurant_id = JWT claim)
    ↓
Manager scans or enters customer card number
    ↓
Server Action: validate Luhn, look up card, record transaction, increment stamps/points
    ↓
Supabase transaction commits (triggers DB function or Realtime event)
    ↓
Edge Function / trigger fires: lookup pushToken from apns_devices for this serial
    ↓
APNs HTTP/2 push sent with empty payload (silent push)
    ↓
iOS Wallet receives push → calls GET /api/wallet/apns/v1/devices/{deviceId}/registrations/{passTypeId}
    ↓
Server returns updated serial numbers
    ↓
iOS calls GET /api/wallet/apns/v1/passes/{passTypeId}/{serial}
    ↓
Server generates fresh .pkpass with new balance, signs it, serves it
    ↓
iOS Wallet updates the card display (may show "Card updated" notification)
    ↓
Manager POS Realtime subscription fires → UI updates without page refresh
```

### Flow 3: Owner Configures Restaurant Branding

```
Owner logs in (Supabase Auth)
    ↓
Auth Hook fires → JWT issued with { restaurant_id, role: "owner" }
    ↓
Owner Dashboard loads (/{slug}/dashboard, protected by role check)
    ↓
Owner updates: logo, primary color, reward rules, card name
    ↓
Server Action: upsert restaurants table (RLS: owner can only update own restaurant)
    ↓
Middleware cache invalidated (next request re-fetches branding)
    ↓
Next card download will use updated branding
    ↓
Existing Wallet cards: owner must manually trigger a push update batch
  (or defer until next transaction — cards update on next sale)
```

### State Management

```
Supabase Realtime
    ↓ (subscribe to cards table filtered by restaurant_id)
Manager POS Panel ←→ Server Actions → Supabase DB → Realtime broadcast → POS UI
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Apple Push Notification Service (APNs) | HTTP/2 push from server after DB write; token-based auth (p8 key) | Token-based auth preferred over certificate-based — tokens don't expire; one key works for all pass types |
| Apple Pass Type Certificate | Stored as PEM strings in Vercel environment variables; loaded at runtime by `passkit-generator` | Never commit to repo; rotate if exposed. Requires separate cert per passTypeIdentifier |
| Apple WWDR Certificate | Intermediate CA cert from Apple PKI; bundle with signing certs | Download from Apple PKI portal; changes rarely but must stay current |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| middleware.ts ↔ route handlers | HTTP headers (`x-restaurant-id`, etc.) | Headers set by middleware are read in Server Components via `headers()` |
| Server Actions ↔ Supabase DB | Supabase server client with service role key for admin ops; anon key + user JWT for user ops | Use service role only in Edge Functions and admin paths; never expose to client |
| APNs notifier ↔ Pass web service | APNs is fire-and-forget; the device drives subsequent fetches | Your server cannot push pass content directly; it only signals "something changed" |
| POS real-time ↔ Supabase Realtime | Supabase client subscription filtered by `restaurant_id` from JWT | Realtime respects RLS if enabled on publication; enable row-level Realtime filtering |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–50 restaurants | Single Supabase project, path-based slugs, no caching needed in middleware, Vercel Hobby/Pro sufficient |
| 50–500 restaurants | Add Vercel KV (Redis) for tenant lookup cache in middleware; index `restaurant_id` on all tables; monitor RLS query plans with `EXPLAIN ANALYZE` |
| 500–5k restaurants | Consider connection pooling (PgBouncer via Supabase's built-in pooler); split pass generation into a dedicated worker (Vercel serverless function with increased memory); APNs volume may require batching |
| 5k+ restaurants | Evaluate Supabase Pro/Team tier limits; consider moving pkpass signing to a dedicated microservice; APNs rate limits become relevant at this scale |

### Scaling Priorities

1. **First bottleneck:** Middleware DB lookups per request — add tenant cache (Vercel KV or in-memory LRU) before anything else
2. **Second bottleneck:** RLS query performance on `cards` and `transactions` tables — add composite indexes `(restaurant_id, customer_id)` and `(restaurant_id, created_at DESC)` early
3. **Third bottleneck:** `.pkpass` signing is CPU-bound and synchronous — if generation time spikes, move to background job with polling

---

## Anti-Patterns

### Anti-Pattern 1: Calling `auth.uid()` or `auth.jwt()` Directly in RLS Policies

**What people do:** Write `auth.uid()` directly in the USING clause without wrapping in a SELECT.

**Why it's wrong:** PostgreSQL re-evaluates the function call for every row being evaluated, defeating query optimization. On large tables this causes dramatic slowdowns.

**Do this instead:** Always write `(select auth.uid())` and `(select auth.jwt() ->> 'restaurant_id')` — the SELECT wrapper allows the planner to cache the result for the entire query.

### Anti-Pattern 2: Relying Solely on Application-Level Tenant Filtering

**What people do:** Filter by `restaurant_id` only in query `.eq()` calls in application code, skipping RLS policies.

**Why it's wrong:** Any bug, missing filter, or new code path that bypasses the filter leaks cross-tenant data. RLS is the defense-in-depth layer that makes data isolation guaranteed at the database level regardless of application code.

**Do this instead:** Always have both: RLS policies as the guaranteed floor, and explicit `.eq('restaurant_id', tenantId)` in queries for performance (query planner uses explicit filters better than RLS alone).

### Anti-Pattern 3: Generating .pkpass Files Without Storing the Template

**What people do:** Build pass.json entirely in code each time, scattering field definitions across multiple functions.

**Why it's wrong:** Pass structure must be consistent across generations. When you update branding, regenerating all existing passes requires the same exact template logic. Drift between versions causes Apple to reject updates (changed passTypeIdentifier, structure mismatches).

**Do this instead:** Store a pass template per restaurant in Supabase Storage (or as a DB JSON column). Generate dynamically by merging the template with live data. The template is the source of truth for structure.

### Anti-Pattern 4: Treating APNs as a Real-Time Data Channel

**What people do:** Try to send card balance data inside the APNs push payload.

**Why it's wrong:** APNs for Wallet passes is a signal only — "something changed, come fetch it." The device ignores any payload content. The actual data always comes from the `GET /v1/passes/.../...` endpoint. Putting data in the push wastes bandwidth and will be ignored.

**Do this instead:** Send an empty `aps: {}` payload. All updated pass data is served when the device calls your web service endpoint after the push arrives.

### Anti-Pattern 5: Storing Apple Certificates in the Database

**What people do:** Store PEM certificate strings in a `restaurants` or `config` table, thinking per-restaurant certificates are needed.

**Why it's wrong:** Pass Type Identifiers (and their certificates) are registered once per Apple developer account. One Pass Type ID (e.g., `pass.com.revisit.loyalty`) covers all restaurants. Storing certificates in the DB creates credential management complexity and rotation risks.

**Do this instead:** Use one Pass Type Certificate per environment (production, staging), stored as Vercel environment variables. Differentiate restaurant branding inside the pass content (`pass.json` fields), not through separate certificates.

---

## Build Order Implications

The architecture has hard dependencies that dictate phase order:

```
1. Database schema + RLS policies
   (Everything else reads/writes the DB; policies must be correct before any feature ships)
        ↓
2. Auth + custom claims (restaurant_id, role in JWT)
   (RLS policies are meaningless until JWT carries correct claims)
        ↓
3. Tenant middleware (slug → restaurant_id resolution)
   (All three UIs depend on tenant context being available)
        ↓
4. Owner Dashboard — restaurant setup, branding config
   (Managers and customers cannot function without a configured restaurant)
        ↓
5. Card number generation + customer card creation
   (Manager POS needs cards to exist; Apple Wallet needs card data to build passes)
        ↓
6. Manager POS — sale recording, stamp/points issuance
   (Cards need to exist; Wallet updates need transactions to trigger)
        ↓
7. Apple Wallet — pkpass generation (download flow)
   (Needs card data, branding, certificates; no APNs required yet)
        ↓
8. Apple Wallet — web service endpoints + APNs push updates
   (Depends on pkpass existing; APNs registration happens after first download)
        ↓
9. Customer Landing Page — white-label UI, Wallet CTA
   (Depends on branding config and Wallet download being functional)
        ↓
10. Real-time POS updates (Supabase Realtime)
    (Enhancement on top of working POS; not required for MVP transaction recording)
```

**Critical path:** Steps 1–3 are pure infrastructure. No user-facing feature is deliverable until they are solid. Getting RLS wrong at step 1 means data isolation is broken across the entire system — this is the highest-risk step and must be validated with explicit cross-tenant query tests before proceeding.

---

## Sources

- Apple Wallet Web Service API (official, archived): https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html — HIGH confidence
- Apple Developer Documentation — Adding a Web Service to Update Passes: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes — HIGH confidence (JS-rendered, content confirmed via PassNinja tutorial)
- PassNinja — How does pass updating work on Apple Wallet: https://www.passninja.com/tutorials/apple-platform/how-does-pass-updating-work-on-apple-wallet — MEDIUM confidence (third-party but matches Apple docs)
- Supabase RLS Performance and Best Practices (official docs): https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv — HIGH confidence
- Supabase Custom Claims and RBAC (official docs): https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac — HIGH confidence
- Next.js multi-tenant guide (official, updated 2026-02-20): https://nextjs.org/docs/app/guides/multi-tenant — HIGH confidence
- Vercel multi-tenant guide: https://vercel.com/guides/nextjs-multi-tenant-application — MEDIUM confidence
- AntStack — Multi-Tenant Applications with RLS on Supabase: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/ — MEDIUM confidence (aligns with official Supabase docs)
- passkit-generator npm package: https://github.com/alexandercerutti/passkit-generator — MEDIUM confidence (most actively maintained Node.js pkpass library as of 2025)
- PassCreator — Apple Wallet pass updates and push notifications: https://www.passcreator.com/en/blog/apple-wallet-pass-updates-and-push-notifications-how-they-work-and-how-to-use-them — MEDIUM confidence

---

*Architecture research for: REVISIT — multi-tenant digital loyalty SaaS (bars and restaurants, Brazil)*
*Researched: 2026-02-20*
