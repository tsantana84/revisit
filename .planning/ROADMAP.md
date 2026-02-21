# Roadmap: REVISIT

## Overview

REVISIT is built in five phases, each delivering a coherent capability that builds on the previous. The build order is non-negotiable: database schema and tenant isolation must be correct before any feature ships, because retrofitting RLS is prohibitively expensive. Owner configuration must exist before cards can be branded. The loyalty engine and manager POS must work before wallet passes have real data to display. The wallet integration is the product's core differentiator and is handled as its own phase due to Apple-specific infrastructure complexity. The customer landing page and owner analytics close the loop last, once all underlying systems are stable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Database schema, RLS policies, auth JWT claims, and tenant middleware
- [ ] **Phase 2: Owner Setup** - Owner and manager auth flows, restaurant branding config, loyalty program configuration
- [ ] **Phase 3: Loyalty Engine + Manager POS** - Card number generation, points engine, rank system, rewards, and the manager transaction panel
- [ ] **Phase 4: Apple Wallet** - Pass generation, Apple web service endpoints, APNs push notifications
- [ ] **Phase 5: Customer Experience + Analytics** - Customer registration landing page, onboarding flow, and owner analytics dashboard

## Phase Details

### Phase 1: Foundation
**Goal**: A correctly isolated multi-tenant database exists that all features can safely build on
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-05
**Success Criteria** (what must be TRUE):
  1. A cross-tenant access test suite passes: a query authenticated as Restaurant A cannot return data belonging to Restaurant B, verified from the Supabase client SDK (not SQL Editor, which bypasses RLS)
  2. Every table in the schema has RLS enabled — a CI check fails the build if any table is missing a policy
  3. An owner logging in receives a JWT containing their `restaurant_id` and `role` claims, confirming tenant identity flows from login to every subsequent request
  4. Next.js middleware resolves the correct `restaurant_id` from a URL slug without a per-request database query
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Database schema, RLS policies, soft-delete views, and seed data
- [ ] 01-02-PLAN.md — Custom Access Token Hook + SDK-based cross-tenant isolation test suite
- [ ] 01-03-PLAN.md — Next.js tenant middleware with slug resolution, Supabase client factories

### Phase 2: Owner Setup
**Goal**: A restaurant owner can sign up, configure their loyalty program, and have it ready to accept customers
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DASH-05, WL-01, WL-02, WL-03, WL-04, WL-05
**Success Criteria** (what must be TRUE):
  1. An owner can create an account with email and password and land on their restaurant dashboard
  2. An owner can configure their program: logo, colors, program name, earn rate, ranks (name, visit threshold, multiplier), reward type, and point expiry rules — and the configuration persists
  3. An owner can create a manager account with email and password, and the manager can log in to the dedicated manager panel and nowhere else
  4. No customer-facing surface (landing page, registration form, rendered HTML, wallet card, email) contains the string "REVISIT" — only the restaurant's own branding appears
  5. Each restaurant is accessible at its own URL slug (app.revisit.com/{slug}) and configuration from one tenant is not visible to another
**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — Schema migration (branding/config columns, storage bucket), service role client, owner signup/login auth flow, middleware dashboard protection, role-guarded dashboard layouts
- [ ] 02-02-PLAN.md — Manager account creation (Route Handler with admin API), owner team management page
- [ ] 02-03-PLAN.md — Restaurant branding config (logo, colors, program name) + loyalty program config (earn rate, reward type, point expiry, ranks with multipliers and visit thresholds)

### Phase 3: Loyalty Engine + Manager POS
**Goal**: A manager can look up a customer by card number and register a sale in under 30 seconds, with points, rank promotion, and reward unlocking calculated automatically
**Depends on**: Phase 2
**Requirements**: CARD-03, PTS-01, PTS-02, PTS-03, PTS-05, RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, RWRD-01, RWRD-02, RWRD-03, RWRD-04, RWRD-05, MGR-01, MGR-02, MGR-03, MGR-04, MGR-05, MGR-06, MGR-07
**Success Criteria** (what must be TRUE):
  1. A manager can look up a customer by typing a card number in #XXXX-D format — the system validates the check digit and rejects invalid numbers before any database query runs
  2. After entering a sale value, the manager sees "This will credit X points to [Name]. Confirm?" — the preview reflects the correct calculation: value × earn rate × rank multiplier, rounded to the nearest whole point
  3. Points are credited to the customer's ledger after manager confirmation, visit count increments, and if a rank threshold is crossed the customer's rank updates automatically
  4. A reward becomes available when a customer meets the configured threshold (points or rank), and the manager can confirm reward redemption at the panel
  5. The manager panel shows only the card lookup and sale registration UI — no analytics, customer list, configuration, or navigation to other sections is accessible
**Plans**: TBD

Plans:
- [ ] 03-01: Card number service — #XXXX-D format, Luhn check-digit generation and validation, uniqueness constraint
- [ ] 03-02: Points engine — earn rate × rank multiplier calculation, integer math, NUMERIC ledger, golden-path unit tests
- [ ] 03-03: Rank system — visit-count-based promotion, configurable thresholds, automatic rank assignment on transaction
- [ ] 03-04: Reward system — cashback, free product, progressive discount models; redemption confirmation flow
- [ ] 03-05: Manager POS panel — card lookup UI, check-digit validation, sale entry, two-step confirmation, role-enforced access

### Phase 4: Apple Wallet
**Goal**: A customer immediately receives a signed Apple Wallet pass after registration, and the pass updates automatically when points or rank change
**Depends on**: Phase 3
**Requirements**: CARD-02, CARD-04, CARD-05, PTS-04, PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05
**Success Criteria** (what must be TRUE):
  1. Clicking "Add to Apple Wallet" on a real iOS device installs a signed .pkpass showing the restaurant name, customer name, card number, current points balance, and current rank — no simulator, real hardware only
  2. After a manager registers a sale, the customer's wallet card updates its points balance and rank within the Apple Wallet app without the customer taking any action
  3. The wallet card background color changes to match the customer's current rank color as configured by the owner
  4. A customer receives a push notification when: they register (welcome), points are credited after a sale, their rank is promoted, and a reward becomes available
  5. An owner can send a push notification to all customers or to customers of a specific rank, and the notification arrives on device
**Plans**: TBD

Plans:
- [ ] 04-01: Pass generation API — /api/wallet/download route, passkit-generator in-memory pattern for Vercel, per-tenant branding, signed .pkpass output, WWDR G4 startup validation
- [ ] 04-02: Apple web service endpoints — four fixed Apple-dictated endpoints (/api/wallet/apns/v1/...), device push token storage, updated pass serving
- [ ] 04-03: APNs push integration — token-based auth (.p8 key), silent push after transaction commit, health-check endpoint, pass update trigger wired to points engine

### Phase 5: Customer Experience + Analytics
**Goal**: A customer can register in under 60 seconds on a fully white-labeled landing page, and an owner can see what is happening in their loyalty program
**Depends on**: Phase 4
**Requirements**: CARD-01, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. A customer visits app.revisit.com/{slug} and sees a landing page branded entirely as the restaurant — logo, colors, program name — with no visible REVISIT branding in any rendered HTML, title tags, or meta tags
  2. A customer completes registration with only name and phone number and is presented with an "Add to Apple Wallet" button in under 60 seconds from landing
  3. An owner can view their analytics overview: total customers, total points issued, total sales logged, total revenue tracked, and rank distribution
  4. An owner can search and browse their full customer list with rank, points, visits, total spend, and registration date visible per customer
  5. An owner can view the complete sales log and manager activity audit log, showing who registered each sale and when
**Plans**: TBD

Plans:
- [ ] 05-01: Customer landing page — SSR with middleware branding injection, white-label rendering, automated REVISIT-string scan in CI
- [ ] 05-02: Customer registration flow — name + phone form, card creation, redirect to wallet download, sub-60-second end-to-end
- [ ] 05-03: Owner analytics dashboard — overview metrics, customer list with search, sales log, manager audit log

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/3 | In progress | - |
| 2. Owner Setup | 0/3 | Not started | - |
| 3. Loyalty Engine + Manager POS | 0/5 | Not started | - |
| 4. Apple Wallet | 0/3 | Not started | - |
| 5. Customer Experience + Analytics | 0/3 | Not started | - |
