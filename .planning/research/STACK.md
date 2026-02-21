# Stack Research

**Domain:** White-label digital loyalty SaaS (bars & restaurants, Brazil)
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH (core stack HIGH, Apple Wallet integration MEDIUM, push notification library LOW-MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Full-stack framework, routing, SSR/RSC | Confirmed by user. Latest stable as of Feb 2026 (v16 released Oct 2025). App Router + React Server Components reduce client bundle. Vercel-native — zero-config deployment, Edge Middleware for tenant resolution. |
| Supabase | `@supabase/supabase-js` 2.97.0 | Auth, Postgres, RLS, Storage, Realtime | Confirmed by user. Postgres-native RLS is the standard pattern for multi-tenant SaaS. Single SDK covers auth, DB queries, file storage. Eliminates need for a separate auth service. |
| PostgreSQL | 15+ (via Supabase) | Relational database, tenant isolation | Supabase runs Postgres. RLS policies on `tenant_id` column are the canonical multi-tenancy pattern. Mature, proven for SaaS at scale. |
| TypeScript | 5.x (bundled with Next.js 16) | Type safety across frontend and backend | Non-negotiable for a multi-tenant system — catches tenant_id errors, pass schema mismatches, and RLS policy misuse at compile time. |
| Tailwind CSS | 4.x | Utility-first styling | shadcn/ui now requires Tailwind v4 (added Feb 2025). Tailwind v4 is stable and the de-facto standard. Vercel team uses it internally. |
| shadcn/ui | Latest (Feb 2026 — Radix unified pkg) | Accessible component library for admin UI | Not a dependency, copies components. Zero runtime overhead. Full Tailwind v4 + React 19 support. RTL added Jan 2026 (not needed now but Brazil may expand). |

### Apple Wallet Integration

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| passkit-generator | 3.5.7 | Generate `.pkpass` files (loyalty cards) | Most actively maintained pkpass library for Node.js (published ~2 months ago as of Feb 2026). Supports iOS 18 EventTicket NFC layout (v3.2.0+). TypeScript-native. The `pass-js` alternative is less maintained. |
| apns2 | 12.2.0 | Send APNs push to update Wallet passes | HTTP/2 + JWT authentication (required by Apple). Lighter than `node-apn`, which has maintenance concerns. Used for the pass-update notification flow (empty payload to registered push tokens). |

**Critical Apple Wallet architecture note:** APNs push for pass updates only works in production (not sandbox). The flow is: customer registers device → your server stores pushToken + deviceLibraryIdentifier → when points change, send empty push → device fetches updated pass from your `/v1/passes/` endpoint. This is Apple's protocol, not a library choice.

### Billing & Payments

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| stripe | `stripe` npm latest (~17.x) | Restaurant subscription billing | Industry standard. Vercel + Stripe + Supabase is the canonical SaaS billing pattern — multiple starter kits and official Vercel templates exist for this combination. Stripe handles Brazilian payment methods (Pix support exists via Stripe). |

### Email

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| resend | Latest | Transactional email (restaurant onboarding, receipts) | Official Supabase partner integration. Can be configured via Supabase Auth's Send Email Hook. Paired with `react-email` for JSX templates. The standard for Next.js + Supabase stacks. |
| react-email | Latest | JSX email templates | Replaces HTML string templates. Works with Resend natively. Used in MakerKit, Nextbase, and other reference SaaS starters. |

### Forms & Validation

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| react-hook-form | 7.60.0+ | Form state management | Performance-first (uncontrolled inputs). The shadcn/ui form component is built on top of it. |
| zod | 3.25.x (v3) or v4 | Schema validation (forms, API, pass data) | Zod v4 beta exists but shadcn/ui integration (`@hookform/resolvers`) targets v3 as of now. Use v3 until resolvers v5+ fully certifies v4. Resolvers package: `@hookform/resolvers` 5.2.2. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vercel CLI | Deployment, env management, preview branches | Install globally. Pair with `vercel env pull` for local dev. |
| Supabase CLI | Local Supabase dev, DB migrations, Edge Function deployment | `supabase start` runs Postgres + Auth + Storage locally via Docker. Required for RLS policy testing. |
| Biome | Linting + formatting (replaces ESLint + Prettier) | Faster, single config. Actively used in 2025/2026 Next.js projects. |
| Husky + lint-staged | Pre-commit hooks | Run Biome + type-check on staged files. |

---

## Installation

```bash
# Scaffold Next.js 16 with App Router
npx create-next-app@latest revisit --typescript --tailwind --app --src-dir

# Core Supabase
npm install @supabase/supabase-js @supabase/ssr

# Apple Wallet pass generation
npm install passkit-generator

# Apple Push Notification (pass updates)
npm install apns2

# Billing
npm install stripe

# Email
npm install resend react-email @react-email/components

# Forms & validation
npm install react-hook-form zod @hookform/resolvers

# UI (shadcn - init separately, not npm install)
npx shadcn@latest init

# Dev tools
npm install -D supabase @biomejs/biome husky lint-staged
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| passkit-generator | pass-js (tinovyatkin) | Never for greenfield — pass-js is less maintained and has fewer active contributors. |
| passkit-generator | @pkpass/build | Valid alternative. Less community adoption than passkit-generator. Use if passkit-generator API becomes awkward for your pass templates. |
| apns2 | node-apn | node-apn has maintenance concerns (last release was years ago). apns2 uses modern HTTP/2 + JWT, which Apple now prefers over certificate-based connections. |
| Supabase RLS | Application-level tenant filtering | Never do application-level only — it's a security layer, not just a convenience. Use RLS + application filtering for defense in depth. |
| Resend | SendGrid, Postmark | Resend is the only one with official Supabase Auth Hook integration and JSX templates out of the box. Use SendGrid/Postmark only if you already have an account or need features Resend lacks. |
| Zod v3 | Zod v4 | Use v4 only after `@hookform/resolvers` fully certifies support (check GitHub before upgrading). |
| Stripe | Pagar.me, Mercado Pago | Stripe supports Pix and handles Brazilian CPF/CNPJ requirements. Pagar.me/Mercado Pago are better only if you need boleto or specific Brazilian payment methods Stripe doesn't cover. Verify Stripe Pix availability before finalizing. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma ORM | Adds abstraction over Supabase's Postgres client. Supabase's `supabase-js` SDK handles RLS automatically via the user JWT — Prisma bypasses this and requires manual tenant filtering. Also slower cold starts. | `supabase-js` SDK + Supabase's typed client generator (`supabase gen types`) |
| Clerk / Auth0 / NextAuth | Supabase Auth is confirmed. Adding a second auth system creates token conflicts and doubles complexity. Supabase Auth handles JWT claims used in RLS policies. | Supabase Auth |
| Firebase / Firestore | Document DB doesn't support row-level security in the PostgreSQL sense. Multi-tenancy requires custom application code for every query. | Supabase / PostgreSQL |
| Supabase Edge Functions for pkpass generation | Supabase Edge Functions run on Deno. `passkit-generator` is a Node.js library. The runtimes are incompatible — running pkpass generation in Edge Functions requires a Deno-compatible alternative that doesn't exist with equivalent quality. | Next.js API Routes (Node.js runtime) on Vercel for pass generation |
| Google Wallet | Project constraint is Apple Wallet first. Google Wallet requires a separate SDK (`@walletobjects/google-pay-passes`), separate credentials, and a different update protocol. Defer completely. | Apple Wallet (.pkpass) |
| Tailwind CSS v3 | shadcn/ui now requires v4 (since Feb 2025). Starting with v3 means a forced migration later. | Tailwind CSS v4 |

---

## Stack Patterns by Scenario

**Multi-tenant data isolation:**
- Add `tenant_id UUID NOT NULL REFERENCES tenants(id)` to every user-facing table
- Create RLS policy: `USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)`
- Set tenant_id as a custom JWT claim via Supabase Auth Hook on login
- Index `tenant_id` on every table — unindexed RLS policies kill performance

**Pass generation flow:**
- Next.js API Route (Node.js runtime) receives request
- Loads pass template from Supabase Storage (per-tenant branding assets)
- Uses `passkit-generator` to build `.pkpass` with current loyalty data
- Returns binary response with `Content-Type: application/vnd.apple.pkpass`
- Do NOT generate passes in Edge Functions (Deno incompatibility)

**Pass update flow (loyalty points change):**
- Database trigger or application code detects point update
- Look up `device_registrations` table for all devices registered for that pass
- Send empty APNs push to each `pushToken` via `apns2`
- Device calls your `/v1/passes/{passTypeIdentifier}/{serialNumber}` endpoint
- That endpoint regenerates and returns the updated `.pkpass`

**White-label branding per restaurant:**
- Store logo, colors, strip image per tenant in Supabase Storage
- Pass templates reference tenant assets at generation time
- Admin dashboard (Next.js) lets restaurants upload branding assets

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 16.x | React 19+ | Next.js 16 requires React 19. No React 18 support in App Router. |
| @supabase/supabase-js 2.97.0 | Node.js 20+ | Node.js 18 support dropped in v2.79.0. Vercel uses Node 20 by default. |
| passkit-generator 3.5.7 | Node.js 18+ | Works on Vercel serverless (Node.js runtime). Does NOT work in Supabase Edge Functions (Deno). |
| shadcn/ui (Feb 2026) | Tailwind CSS v4 + React 19 | Must use Tailwind v4. Old shadcn components need migration if upgrading from v3. |
| Zod v3 | @hookform/resolvers 5.2.2 | Zod v4 integration in resolvers is partial as of Feb 2026 — stick with v3. |
| apns2 12.2.0 | Node.js 18+ | JWT-based auth (token-based APNs connection). Production APNs only for pass updates. |

---

## Sources

- passkit-generator npm: https://www.npmjs.com/package/passkit-generator — version 3.5.7, published ~2 months ago (MEDIUM confidence — npm page)
- passkit-generator GitHub: https://github.com/alexandercerutti/passkit-generator — actively maintained (MEDIUM confidence)
- Apple Wallet Developer Docs (Adding a Web Service): https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes — APNs update protocol (HIGH confidence — official)
- Apple Wallet Developer Docs (Updating a Pass): https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html — pass update flow (HIGH confidence — official)
- apns2 GitHub: https://github.com/AndrewBarba/apns2 — version 12.2.0, HTTP/2 + JWT (MEDIUM confidence — WebSearch)
- @supabase/supabase-js npm: version 2.97.0, Node 20+ required (HIGH confidence — multiple sources agree)
- Supabase RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security (HIGH confidence — official)
- Supabase multi-tenancy pattern: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/ (MEDIUM confidence — WebSearch verified against Supabase docs)
- Next.js 16.1 release: https://nextjs.org/blog/next-16-1 — latest stable Feb 2026 (HIGH confidence — official)
- shadcn/ui Tailwind v4 support: https://ui.shadcn.com/docs/tailwind-v4 (HIGH confidence — official)
- React Hook Form v7, Zod v3, @hookform/resolvers 5.2.2: https://tecktol.com/zod-react-hook-form/ (MEDIUM confidence — WebSearch)
- Resend + Supabase Auth Hook: https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend (HIGH confidence — official)
- Supabase Edge Functions + Deno incompatibility with Node.js libs: https://github.com/orgs/supabase/discussions/22470 (MEDIUM confidence — community discussion verified against architecture docs)
- Apple Wallet pass updates — production APNs only: https://developer.apple.com/forums/thread/758641 (HIGH confidence — official Apple forums)

---

## Open Questions (Validate Before Building)

1. **Stripe + Pix:** Verify Stripe supports Pix (Brazilian instant payment) in the Brazil region before finalizing billing. If not, evaluate Pagar.me as fallback. Confidence: LOW — not verified against current Stripe Brazil docs.

2. **apns2 maintenance status:** apns2 v12.2.0 is referenced but maintenance cadence not verified in depth. Verify GitHub activity before building the update flow. Alternative: `node-apns2` or a raw `http2` fetch to APNs if the library becomes stale.

3. **Zod v4 timeline:** Zod v4 is in beta. `@hookform/resolvers` 5.2.2 may support it by the time you start building forms. Check before scaffolding — migrating later is low effort but worth skipping.

4. **Apple Developer Program:** Generating `.pkpass` files requires an Apple Developer account ($99/year), a Pass Type ID, and a signing certificate. This is a prerequisite, not a code decision, but must be in place before any Apple Wallet work begins.

---

*Stack research for: REVISIT — white-label digital loyalty SaaS*
*Researched: 2026-02-20*
