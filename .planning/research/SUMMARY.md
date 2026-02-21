# Project Research Summary

**Project:** REVISIT — White-Label Digital Loyalty SaaS
**Domain:** Multi-tenant loyalty platform for Brazilian bars and restaurants (Apple Wallet, no-app model)
**Researched:** 2026-02-20
**Confidence:** MEDIUM-HIGH

## Executive Summary

REVISIT is a B2B2C white-label SaaS product where the core value proposition is delivering a no-app customer loyalty experience via Apple Wallet passes, sold to bars and restaurants in Brazil as a per-tenant branded program. The recommended approach is a multi-tenant Next.js 16 + Supabase stack where tenant isolation is enforced at the database layer via Row Level Security policies, and the Apple Wallet integration (pkpass generation + APNs web service endpoints) runs entirely in Node.js API routes on Vercel. The architecture has a hard build order dictated by security dependencies: database schema with RLS must be correct before any feature ships, because retrofitting tenant isolation after the fact is prohibitively expensive and risks LGPD compliance exposure.

The highest-risk component is the Apple Wallet integration — not because the technology is unstable, but because it involves Apple Developer certificates, a fixed API contract Apple dictates (four specific endpoints your server must implement), APNs push behavior that only works in production, and a series of silent failure modes that are difficult to debug. A team that has not built PassKit infrastructure before will lose significant time to WWDR certificate version mismatches, authentication token rotation mistakes, and Vercel filesystem constraints on pkpass generation. Research identifies seven critical pitfalls in this domain; all are preventable with upfront architectural decisions. Getting these decisions right in phase 3 (Wallet integration) is the critical path to a shippable product.

The product is viable with a tightly scoped MVP: customer registration via phone, Apple Wallet card issuance, manager sale logging, a points engine with configurable ranks and multipliers, reward redemption (starting with free product), and a basic owner analytics dashboard. Google Wallet and Pix cashback — both commercially important for Brazil's Android-dominant market and cashback culture — should be deferred to v1.x and v2+ respectively. The data and architecture support adding them later without structural changes.

---

## Key Findings

### Recommended Stack

The confirmed stack (Next.js 16 + Supabase + Vercel) is the right choice and follows the canonical pattern for multi-tenant SaaS in 2025–2026. Next.js App Router with middleware-based tenant resolution avoids wildcard DNS complexity for MVP. Supabase's Postgres-native RLS is the correct multi-tenancy foundation — using application-level filtering without RLS is a security anti-pattern that research explicitly warns against. The `passkit-generator` 3.5.7 library is the correct choice for pkpass generation (actively maintained, TypeScript-native, Node.js compatible) and must run in Next.js API routes, not Supabase Edge Functions, due to Deno incompatibility.

**Core technologies:**
- **Next.js 16 (App Router):** Full-stack framework with Edge Middleware for tenant resolution — zero-config Vercel deployment, React 19 + RSC for bundle efficiency
- **Supabase (Postgres + Auth + RLS):** Multi-tenant data isolation via JWT custom claims (`restaurant_id`, `role`) embedded at login; RLS policies read from JWT — no per-request DB lookup for tenant identity
- **passkit-generator 3.5.7:** Node.js pkpass generation; must run in Vercel serverless (Node.js runtime), not Edge Functions (Deno) — this is a hard constraint
- **apns2 12.2.0:** HTTP/2 + JWT APNs push for pass update notifications; prefer token-based (`.p8` key, no expiry) over certificate-based auth
- **Stripe:** Subscription billing for restaurant tenants; supports Pix — verify Brazil availability before finalizing
- **Resend + react-email:** Transactional email with Supabase Auth Hook integration; white-label email templates per tenant
- **Tailwind CSS v4 + shadcn/ui:** Required combination — shadcn/ui requires Tailwind v4 as of Feb 2025; do not start with v3
- **Zod v3 + react-hook-form 7.60+:** Use Zod v3 until `@hookform/resolvers` fully certifies v4

**Critical constraint:** Apple Developer Program enrollment ($99/year) + Pass Type ID + signing certificate are prerequisites for any Wallet work. This must be in place before Phase 3 starts.

### Expected Features

The loyalty program feature set is well-understood. The key insight from research is that customers expect less than operators think, and complexity kills adoption at both ends — customers abandon programs with friction-heavy onboarding, and managers refuse to use POS panels that take more than 2 taps. The differentiating mechanic is the no-app experience: Apple Wallet eliminates the #1 adoption barrier (mandatory app install) that plagues every competitor in this space.

**Must have (table stakes):**
- Customer registration via name + phone — phone is the universal identifier; email adds friction
- Apple Wallet card issuance — the no-app customer touchpoint; highest-risk infrastructure dependency
- Manager sale logging with card number lookup — must be fast (slow lookup kills manager adoption)
- Points engine with configurable earn rate and rank multipliers — the earning mechanic
- Rank/tier system (Bronze/Silver/Gold, configurable) — enables multiplier behavior
- Reward redemption (free product for MVP simplicity) — earning without redeeming is a broken loop
- Push notifications via Wallet pass update on balance change — no app required
- Owner analytics dashboard (member count, visits, redemptions) — blind programs get cancelled
- White-label branding per tenant (logo, colors, program name) — non-negotiable for sale
- Point expiry configuration — prevents zombie point liability

**Should have (competitive differentiators, v1.x):**
- Cashback reward type — add when restaurants with cash-flow model onboard
- Progressive discount reward type — rare among competitors, high value for bars
- Birthday reward triggers — measurable visit lift, low complexity
- Win-back campaigns (automated push to lapsed members) — Belly claims 10% win-back rate
- Google Wallet card issuance — Brazil has ~75% Android market share; this is commercially critical, not a nice-to-have; defer only because Apple Wallet is faster to ship

**Defer (v2+):**
- Pix cashback disbursement — requires financial infrastructure, BRL handling, Pix API, regulatory consideration
- Multi-location support per tenant — build when franchise or chain onboards
- Advanced analytics (cohort retention, LTV) — add when owners ask "is this working?"
- Manager role permissions + audit log — build when teams exceed 1 manager per location

**Anti-features to reject explicitly:**
- Branded customer mobile app (massive scope, Apple Wallet already solves the problem)
- POS API integrations (every POS vendor is a separate integration contract; manual logging is reliable and zero-maintenance)
- Coalition loyalty (different product category, different business model)
- AI personalization (not viable until 10k+ active members per tenant)

### Architecture Approach

The architecture is path-based multi-tenant (slug-based routing via `/{slug}/dashboard`, `/{slug}/pos`, `/{slug}`) with middleware-driven tenant resolution at the edge before any route handler runs. Tenant identity flows from URL slug to `restaurant_id` in request headers, through Supabase JWT custom claims, to RLS policies at the database layer — forming a complete isolation chain. The Apple Wallet web service is a fixed API contract (four specific endpoints dictated by Apple) implemented as Next.js API routes under `/api/wallet/apns/v1/...`. These endpoint paths are not negotiable — Apple Wallet calls them exactly.

**Major components:**
1. **`middleware.ts`** — Resolves tenant from slug, injects `restaurant_id` + branding into request headers; requires caching (Vercel KV or in-memory LRU) to avoid per-request DB hits
2. **Supabase Auth + Custom Access Token Hook** — Embeds `restaurant_id` and `role` into JWT at login; RLS policies derive tenant identity from the token, not per-request lookups
3. **Pass Generation API (`/api/wallet/download`)** — Node.js route using `passkit-generator`; reads template from Supabase Storage per tenant; returns signed binary `.pkpass`; must write to `/tmp` or memory only (Vercel filesystem constraint)
4. **Apple Web Service API (`/api/wallet/apns/v1/...`)** — Four endpoints Apple Wallet calls during pass lifecycle; stores device push tokens; serves updated passes on device pull
5. **APNs Notifier** — Fires after transaction commits; sends silent empty push (`aps: {}`) to registered devices; device then fetches updated pass
6. **RLS Policies** — Database-level tenant isolation; `(select auth.jwt() ->> 'restaurant_id')` pattern with SELECT wrapper for query plan optimization (without SELECT wrapper, function re-evaluates per row)
7. **Manager POS Panel (`/{slug}/pos`)** — Supabase Realtime subscription for live card updates; primary action (record sale) must be 2 taps or fewer from panel open
8. **Owner Dashboard (`/{slug}/dashboard`)** — Branding config, reward rules, analytics; protected by `role: owner` JWT claim

**Build order is non-negotiable:** DB schema + RLS → Auth + JWT claims → Tenant middleware → Owner dashboard → Card creation → Manager POS → Wallet download → Wallet web service → Customer landing page → Realtime enhancements

### Critical Pitfalls

1. **APNs certificate expiry silently breaks all pass updates** — Use token-based APNs auth (`.p8` key, no expiry) instead of certificate-based. Store cert expiry date as an environment variable. Add health-check endpoint. Calendar reminder 60 days before expiry. This is a silent failure: customers complain points aren't updating and the server shows no errors.

2. **Supabase RLS misconfiguration causes cross-tenant data leaks** — Enable RLS on every table at creation (Supabase default is disabled). Always derive `tenant_id` from `app_metadata` JWT claim (server-controlled), never `user_metadata` (user-modifiable). Write automated cross-tenant access tests that run from the client SDK (not SQL Editor, which bypasses RLS as superuser). LGPD notification obligations apply if a breach occurs.

3. **WWDR Certificate G4 is the only valid version** — WWDR G1 expired Feb 2023. G2/G3/G5/G6 cause silent pass installation failures on iOS (pass downloads but no "Add to Wallet" prompt). Download G4 exclusively. Write a startup validation that fails fast if the wrong WWDR version is loaded.

4. **Authentication token rotation permanently locks out devices** — The `authenticationToken` embedded in `pass.json` must be immutable for the lifetime of the pass. Rotating it orphans all devices that installed the pass with the original token. Store the original token in the database; never regenerate it. Recovery requires issuing new passes to all affected customers.

5. **Points calculation rounding creates ledger drift** — Use Postgres `NUMERIC` type, never `FLOAT`. Store points as integers. Define an explicit rounding rule (round half-up to nearest whole point) in a named function. Write golden-path unit tests with exact expected outputs (`R$29.90 × 0.1 × 1.5 = 4 points`). Ledger drift accumulates to customer disputes.

6. **Vercel read-only filesystem breaks pkpass generation in production** — `passkit-generator` must write to `/tmp` or operate entirely in memory. Local dev works fine; Vercel production throws `EROFS: read-only file system`. Test pass generation on a Vercel preview deployment, not just locally.

7. **White-label branding leaks** — Branding is not just logo and colors. Supabase auth emails, `pass.json organizationName`, `<title>` tags, error pages, og:image, favicon, Supabase Storage URLs, and APNs sender names all carry platform identity by default. Build a branding audit checklist at project start. Automate scanning for "REVISIT" strings in rendered customer-facing HTML.

---

## Implications for Roadmap

Based on architectural build order dependencies, feature dependencies, and pitfall-to-phase mapping from research, the following phase structure is recommended:

### Phase 1: Foundation — Database, Auth, and Tenant Isolation

**Rationale:** Everything in the system depends on correct multi-tenant isolation. RLS policies cannot be retrofitted safely. Auth JWT claims must be correct before any feature can enforce tenant boundaries. This phase has no user-facing output but is the highest-leverage and highest-risk phase — mistakes here propagate through every subsequent feature.

**Delivers:** Supabase schema with RLS on all tables, custom JWT claims (`restaurant_id`, `role`), path-based tenant middleware, CI check that blocks any table missing RLS, automated cross-tenant access test suite.

**Addresses:** Customer registration schema, white-label branding schema, tenant configuration model.

**Avoids:** Pitfall 2 (RLS misconfiguration), anti-pattern of application-level-only tenant filtering, floating-point columns (use `NUMERIC` from day one).

**Research flag:** Standard patterns — Supabase RLS + Next.js middleware multi-tenancy is well-documented with official guides. Skip `/gsd:research-phase` for this phase.

---

### Phase 2: Owner Dashboard and Tenant Configuration

**Rationale:** Managers and customers cannot function without a configured restaurant. The owner dashboard is the setup prerequisite for everything downstream. White-label branding must be defined at this stage because it flows into Wallet passes, email templates, and the customer landing page.

**Delivers:** Owner auth flow (Supabase Auth), restaurant branding config (logo, colors, program name), loyalty program configuration (earn rate, ranks, multipliers, reward types, point expiry), owner-facing analytics shell.

**Uses:** Supabase Auth + Custom Access Token Hook, shadcn/ui components, Resend + react-email for white-label transactional email (override Supabase default email domain).

**Implements:** Owner Dashboard component, Branding Audit Checklist (map every text/image surface to a tenant config field at this phase, not after).

**Avoids:** Pitfall 5 (branding leak) — define the complete tenant brand config schema now, before any customer-facing surface is built.

**Research flag:** Standard patterns — owner dashboard with branding config is routine SaaS. Skip `/gsd:research-phase`.

---

### Phase 3: Customer Cards, Points Engine, and Manager POS

**Rationale:** The points engine (earn rules, rank multipliers, reward thresholds) must be built and validated before the Wallet integration, because passes display live balance and trigger updates on every transaction. Card number generation (Luhn check-digit, uniqueness constraint, retry logic) is a dependency of both the Wallet pass and the POS lookup. Manager POS is the primary transaction surface — get its UX right (2-tap rule) before adding push notification complexity.

**Delivers:** Card number generation service, customer registration flow (name + phone), Points engine with configurable earn rate + rank multipliers + reward redemption, Manager POS panel (card lookup, sale recording, Supabase Realtime live updates), basic owner analytics (member count, visits, redemptions).

**Uses:** Supabase DB (NUMERIC columns for points, not FLOAT), Server Actions for CRUD, Realtime subscription for POS live updates.

**Avoids:** Pitfall 6 (rounding errors) — write golden-path unit tests with exact expected integer outputs before any transaction processing ships.

**Research flag:** Points engine design choices (how earn rate + rank multipliers interact, reward threshold configuration model) may benefit from a focused research session on loyalty program mechanics. Consider `/gsd:research-phase` if earn rate complexity grows beyond a simple multiplier table.

---

### Phase 4: Apple Wallet Integration

**Rationale:** This is the product's core differentiator and highest-risk phase. It depends on cards existing (Phase 3), branding config existing (Phase 2), and Apple Developer credentials being in place (prerequisite: Apple Developer Program enrollment, Pass Type ID registration, WWDR G4 download, p8 key generation). The Wallet integration has two distinct sub-phases: pass download (simpler, no APNs) and pass updates (requires APNs web service, device registration, and silent push). Build download first, validate on real hardware, then add the update flow.

**Delivers:** Pass generation API route (`/api/wallet/download`) with signed `.pkpass` output, Apple Web Service endpoints (four fixed paths Apple Wallet calls), device push token storage, APNs silent push on transaction commit, pass update flow validated end-to-end on real iOS device (not simulator — APNs does not work in simulator).

**Uses:** `passkit-generator` 3.5.7, `apns2` 12.2.0 with token-based auth (`.p8` key), Supabase Storage for per-tenant pass templates and branding assets, Vercel environment variables for certificate secrets (never in DB, never in source control).

**Avoids:** Pitfall 1 (APNs cert expiry) — implement health-check endpoint and use token-based auth. Pitfall 3 (WWDR G4) — write startup validation. Pitfall 4 (auth token rotation) — store immutable token in DB at card creation. Pitfall 7 (Vercel filesystem) — test on preview deployment before production.

**Research flag:** This phase needs `/gsd:research-phase`. Apple PassKit web service protocol is well-documented but the specific interaction between `passkit-generator` APIs, Vercel serverless constraints, and the APNs update flow has multiple documented failure modes that benefit from implementation-level research before coding starts. Specifically: in-memory pkpass generation pattern for Vercel, token-based APNs auth setup with `apns2`, and the exact four-endpoint web service contract.

---

### Phase 5: Customer Landing Page and Onboarding Flow

**Rationale:** The customer-facing landing page (`/{slug}`) is the registration and Wallet download entry point. It depends on branding config (Phase 2), card creation (Phase 3), and Wallet download (Phase 4) all being functional. Building it last ensures the underlying systems it calls are stable.

**Delivers:** White-label customer landing page (SSR, tenant-branded), customer registration form (name + phone, max 30 seconds), Apple Wallet download CTA, QR code or card number display for POS use.

**Implements:** Customer Landing Page component, middleware branding injection into SSR, white-label SSR test (zero "REVISIT" strings in rendered HTML for any tenant).

**Avoids:** Pitfall 5 (branding leak) — automated scan of rendered customer HTML in CI.

**Research flag:** Standard patterns. Skip `/gsd:research-phase`.

---

### Phase 6: Post-MVP Differentiators (v1.x)

**Rationale:** After the core loyalty loop is working and at least 3–5 paying tenants are active, layer in the features that drive competitive differentiation and address the Android gap.

**Delivers (in priority order):**
1. Win-back campaigns (automated push to lapsed members — requires visit timestamp tracking and APNs infrastructure from Phase 4)
2. Birthday reward triggers (requires DOB collection — add as optional field to customer registration)
3. Cashback reward type (add when restaurants with cash-flow model onboard)
4. Progressive discount reward type (add after tier programs are proven working)
5. Google Wallet card issuance (Brazil ~75% Android — commercially critical; add when Android user complaints or conversion data justify the investment)
6. Advanced analytics (cohort retention, LTV — add when owners ask "is this working for me?")

**Research flag:** Google Wallet integration needs `/gsd:research-phase` when scheduled — it is a separate API, separate credentials, and a different update protocol from Apple Wallet. Do not assume Apple Wallet patterns transfer.

---

### Phase Ordering Rationale

- **Phases 1–2 are pure infrastructure and configuration.** No customer-facing feature ships until tenant isolation is verified and branding config exists. This mirrors the architectural build order from ARCHITECTURE.md exactly.
- **Phase 3 before Phase 4** because passes must display real balance data. Building the Wallet integration against mock data creates rework when the real points engine diverges.
- **Phase 4 is isolated** because it has the most external dependencies (Apple credentials, real-device testing) and the most failure modes. Isolating it reduces interference with the rest of the build.
- **Phase 5 last** because the customer landing page is a thin integration layer over systems that must be solid before it ships. Building it earlier creates a working UI that calls broken infrastructure.

### Research Flags

Phases needing `/gsd:research-phase` during planning:
- **Phase 4 (Apple Wallet):** Vercel + passkit-generator in-memory generation pattern, token-based APNs auth setup, exact web service endpoint contract, real-device testing strategy
- **Phase 6 (Google Wallet):** Entirely separate API and credential model from Apple Wallet; do not assume patterns transfer

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1 (Foundation):** Supabase RLS + Next.js multi-tenancy has official guides and multiple production-verified implementations
- **Phase 2 (Owner Dashboard):** Standard SaaS owner dashboard with branding config
- **Phase 3 (Points Engine + POS):** Points calculation patterns are straightforward; Supabase Realtime is well-documented
- **Phase 5 (Customer Landing):** SSR + white-label theming via middleware is standard Next.js pattern

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack (Next.js 16, Supabase, Vercel) confirmed by user and verified against official docs. Version compatibility table in STACK.md is reliable. Apple Wallet library selection MEDIUM — passkit-generator is best available option but library maintenance depth not fully verified. |
| Features | MEDIUM | Feature landscape from multiple industry sources, all MEDIUM confidence. Brazil-specific loyalty market (Android penetration, Pix expectations) from search results. Table stakes are well-established; differentiator prioritization is reasonable inference, not data-backed. |
| Architecture | HIGH | Apple Wallet web service contract is official Apple documentation (HIGH). Supabase RLS patterns from official Supabase docs (HIGH). Next.js multi-tenancy from official Next.js guide (HIGH). Build order dependencies are logical and cross-validated across all three research areas. |
| Pitfalls | HIGH | Apple Wallet pitfalls sourced from official Apple docs and library maintainer documentation. Supabase RLS pitfalls from official Supabase docs. Vercel filesystem constraint from official Vercel knowledge base. These are verified failure modes, not speculation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Stripe + Pix in Brazil:** STACK.md flags this as LOW confidence — Stripe's Pix support in the Brazil region is not verified against current Stripe Brazil documentation. Validate before finalizing the billing phase. Fallback: Pagar.me or Mercado Pago for Pix specifically.

- **apns2 maintenance status:** Library v12.2.0 is referenced but maintenance cadence was not deeply verified. Check GitHub commit history before Phase 4 build. Fallback: raw `http2` fetch to APNs if library is stale.

- **Google Wallet feasibility for Brazil:** Feature research identifies ~75% Android penetration in Brazil as commercially significant, but the timeline for Google Wallet integration (Phase 6) has not been researched. When Phase 6 is planned, run `/gsd:research-phase` against the Google Pay Passes API and Brazil-specific Wallet adoption data.

- **Apple Developer Program prerequisites:** Pass Type ID registration, WWDR G4 certificate download, and `.p8` APNs key generation must happen before Phase 4 starts. These are organizational/account prerequisites, not code decisions. They should appear as a prerequisite checklist item at the start of Phase 4 planning.

- **Zod v4 timeline:** Zod v4 beta may reach full `@hookform/resolvers` certification by the time forms are built. Check before scaffolding forms in Phase 2 — migration later is low effort but worth skipping.

---

## Sources

### Primary (HIGH confidence)
- Apple Wallet Developer Docs — Web Service API, APNs push protocol, Pass Type Certificates: https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
- Apple Wallet Developer Docs (archived) — Updating Passes: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html
- Supabase Docs — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Docs — Custom Claims and RBAC: https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac
- Supabase Docs — RLS Performance Best Practices: https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv
- Next.js Docs — Multi-tenant guide (updated 2026-02-20): https://nextjs.org/docs/app/guides/multi-tenant
- Next.js 16.1 release notes: https://nextjs.org/blog/next-16-1
- shadcn/ui Tailwind v4 docs: https://ui.shadcn.com/docs/tailwind-v4
- Resend + Supabase Auth Hook: https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend
- Vercel — How to Use Files in Serverless Functions: https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions
- Apple Developer Docs — Create Wallet Identifiers and Certificates: https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/
- Apple Loyalty Passes — official: https://developer.apple.com/wallet/loyalty-passes/
- PassKit Support — Push Notifications for Wallet Passes: https://help.passkit.com/en/articles/11905171-understanding-push-notifications-for-apple-and-google-wallet-passes

### Secondary (MEDIUM confidence)
- passkit-generator npm + GitHub (alexandercerutti): https://github.com/alexandercerutti/passkit-generator — library selection, troubleshooting wiki
- apns2 GitHub (AndrewBarba): https://github.com/AndrewBarba/apns2 — HTTP/2 + JWT APNs
- AntStack — Multi-Tenant with RLS on Supabase: https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/
- Vercel multi-tenant guide: https://vercel.com/guides/nextjs-multi-tenant-application
- PassNinja — How pass updating works: https://www.passninja.com/tutorials/apple-platform/how-does-pass-updating-work-on-apple-wallet
- Punchh — The Wallet Is the New Homepage: https://punchh.com/blog/2025/12/14/the-wallet-is-the-new-homepage-why-apple-and-google-wallet-are-becoming-the-center-of-restaurant-loyalty/
- Restaurant Technology News — Restaurants rethinking loyalty by ditching the app: https://restauranttechnologynews.com/2025/08/how-some-restaurants-are-rethinking-loyalty-by-ditching-the-app/
- GlobeNewswire — Brazil Loyalty Programs Market 2025: https://www.globenewswire.com/news-release/2025/09/09/3146640/28124/en/Brazil-Loyalty-Programs-Intelligence-Report-2025-Market-to-Reach-3-33-Billion-by-2029-Personalization-and-Coalition-Models-Drive-Success.html

### Tertiary (LOW confidence — validate before building)
- Stripe + Pix support in Brazil: not yet verified against current Stripe Brazil documentation
- React Hook Form v7 + Zod v3 + @hookform/resolvers 5.2.2 compatibility: https://tecktol.com/zod-react-hook-form/

---
*Research completed: 2026-02-20*
*Ready for roadmap: yes*
