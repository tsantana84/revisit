# Roadmap: REVISIT

## Overview

REVISIT is built in five phases, each delivering a coherent capability that builds on the previous. The build order is non-negotiable: database schema and tenant isolation must be correct before any feature ships, because retrofitting RLS is prohibitively expensive. Owner configuration must exist before cards can be branded. The loyalty engine and manager POS must work before wallet passes have real data to display. The wallet integration is the product's core differentiator and is handled as its own phase due to Apple-specific infrastructure complexity. The customer landing page and owner analytics close the loop last, once all underlying systems are stable.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Database schema, RLS policies, auth JWT claims, and tenant middleware
- [x] **Phase 2: Owner Setup** - Owner and manager auth flows, restaurant branding config, loyalty program configuration (completed 2004-02-21)
- [x] **Phase 3: Loyalty Engine + Manager POS** - Card number generation, points engine, rank system, rewards, and the manager transaction panel (completed 2004-02-21)
- [x] **Phase 4: Customer Experience + Analytics** - Customer registration landing page, onboarding flow, and owner analytics dashboard (completed 2026-02-21)

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
- [x] 01-02-PLAN.md — Custom Access Token Hook + SDK-based cross-tenant isolation test suite
- [x] 01-03-PLAN.md — Next.js tenant middleware with slug resolution, Supabase client factories

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
- [x] 02-01-PLAN.md — Schema migration (branding/config columns, storage bucket), service role client, owner signup/login auth flow, middleware dashboard protection, role-guarded dashboard layouts
- [x] 02-02-PLAN.md — Manager account creation (Route Handler with admin API), owner team management page
- [x] 02-03-PLAN.md — Restaurant branding config (logo, colors, program name) + loyalty program config (earn rate, reward type, point expiry, ranks with multipliers and visit thresholds)

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
**Plans**: 4 plans

Plans:
- [ ] 03-01-PLAN.md — Card number utility (Luhn check-digit), loyalty engine migration (register_sale + register_redemption RPCs, discount_pct column), seed data update
- [ ] 03-02-PLAN.md — POS Server Actions (lookupCustomer preview, registerSale via RPC, getAuthenticatedManager helper)
- [ ] 03-03-PLAN.md — Reward system Server Actions (checkRewardAvailability, registerRedemption) + discount_pct field in RanksForm
- [ ] 03-04-PLAN.md — Manager POS page UI (card lookup, two-step sale confirmation, reward display, role-enforced single-function layout)

### Phase 4: Customer Experience + Analytics
**Goal**: A customer can register in under 60 seconds on a fully white-labeled landing page, and an owner can see what is happening in their loyalty program
**Depends on**: Phase 4
**Requirements**: CARD-01, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. A customer visits app.revisit.com/{slug} and sees a landing page branded entirely as the restaurant — logo, colors, program name — with no visible REVISIT branding in any rendered HTML, title tags, or meta tags
  2. A customer completes registration with only name and phone number and is presented with an "Add to Apple Wallet" button in under 60 seconds from landing
  3. An owner can view their analytics overview: total customers, total points issued, total sales logged, total revenue tracked, and rank distribution
  4. An owner can search and browse their full customer list with rank, points, visits, total spend, and registration date visible per customer
  5. An owner can view the complete sales log and manager activity audit log, showing who registered each sale and when
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — DB migration (analytics indexes, card number RPC, total_spend) + tenant landing page (white-label marketing page with generateMetadata)
- [ ] 04-02-PLAN.md — Customer registration flow (Server Action, modal with phone mask, card preview, iOS Apple Wallet detection)
- [ ] 04-03-PLAN.md — Owner analytics dashboard (stat cards, donut chart, period filter), customer list (search, pagination, detail panel), logs (sales + audit tabs)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/3 | In progress | - |
| 2. Owner Setup | 3/3 | Complete | 2004-02-21 |
| 3. Loyalty Engine + Manager POS | 0/4 | Complete    | 2004-02-21 |
| 4. Customer Experience + Analytics | 3/3 | Complete   | 2026-02-21 |
