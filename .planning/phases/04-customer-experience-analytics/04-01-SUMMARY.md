---
phase: 04-customer-experience-analytics
plan: 01
subsystem: database, ui
tags: [supabase, migration, nextjs, server-components, white-label, tenant-routing]

# Dependency graph
requires:
  - phase: 03-loyalty-engine-manager-pos
    provides: register_sale RPC, rank system with min_visits, existing customers table
  - phase: 01-foundation
    provides: middleware slug resolver injecting x-restaurant-id header, createServiceClient()
  - phase: 02-owner-setup
    provides: branding columns (primary_color, logo_url, program_name) on restaurants table

provides:
  - Migration 0008_analytics.sql with analytics indexes, generate_next_card_number RPC, total_spend column
  - Tenant landing page at /{slug} with full white-label branding
  - generateMetadata for white-label SEO (no REVISIT in title or meta tags)
  - Rank progression display with colored badges
  - CTA buttons ready for Plan 04-02 registration modal attachment

affects:
  - 04-02-customer-registration (reads x-restaurant-id for registration, uses generate_next_card_number)
  - 04-03-analytics-dashboard (uses idx_sales_restaurant_created, total_spend on customers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "headers() from next/headers to read middleware-injected x-restaurant-id in Server Components"
    - "generateMetadata fetches restaurant by slug via createServiceClient() — no REVISIT in output"
    - "Inline styles with restaurant.primary_color for tenant branding isolation"
    - "generate_next_card_number SECURITY DEFINER RPC for atomic card number generation without race conditions"

key-files:
  created:
    - supabase/migrations/0008_analytics.sql
    - src/app/[slug]/layout.tsx
    - src/app/[slug]/page.tsx
  modified: []

key-decisions:
  - "generate_next_card_number uses MAX(SUBSTRING(card_number FROM 2 FOR 4)) scan across all customers (including deleted) — guarantees no card number reuse"
  - "layout.tsx reads x-restaurant-id header and calls notFound() if absent — middleware already rewrites unknown slugs to /not-found, so this is a defense-in-depth check"
  - "page.tsx fetches restaurant data independently from layout.tsx — acceptable duplication at POC scale, Supabase client caches within request"
  - "CTA buttons use data-action=open-register and data-restaurant-id attributes — Plan 04-02 attaches modal behavior without modifying this file"
  - "Rank color for Prata (sort_order=2) uses dark text (#333) instead of white — silver background has insufficient contrast with white"

patterns-established:
  - "Tenant Server Component pattern: await headers() → get x-restaurant-id → createServiceClient() fetch → render with primary_color"
  - "White-label generateMetadata: program_name ?? name as title, restaurant.name in description, no platform branding"

requirements-completed:
  - CARD-01

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 4 Plan 01: Tenant Landing Page + Analytics Migration Summary

**White-label tenant marketing page at /{slug} with restaurant branding (logo, colors, ranks), plus analytics DB indexes and atomic card number generation RPC**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-21T15:05:06Z
- **Completed:** 2026-02-21T15:10:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migration 0008 deployed with composite analytics indexes on sales and point_transactions, generate_next_card_number SECURITY DEFINER RPC, total_spend column on customers, and updated register_sale to increment total_spend
- Tenant landing page renders at /{slug} with hero section (restaurant logo or name, primary_color background), 3-step how-it-works, rank progression with colored badges (Bronze/Prata/Gold/VIP), benefits section, and footer CTA — all in casual pt-BR
- generateMetadata produces restaurant-branded title and description with zero REVISIT strings in any rendered HTML, title tag, or meta tag
- Invalid slugs return Next.js 404 via middleware rewrite + notFound() in layout

## Task Commits

1. **Task 1: Database migration** - `4fe293c` (feat)
2. **Task 2: Tenant landing page** - `80eb0f2` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `supabase/migrations/0008_analytics.sql` - Analytics indexes, generate_next_card_number RPC, total_spend column, updated register_sale
- `src/app/[slug]/layout.tsx` - Tenant layout reading x-restaurant-id header, notFound() if missing
- `src/app/[slug]/page.tsx` - White-label landing page with generateMetadata and full marketing content

## Decisions Made

- `generate_next_card_number` scans `MAX(SUBSTRING(card_number FROM 2 FOR 4))` across all customers including soft-deleted ones — prevents card number reuse after customer deletion
- `layout.tsx` calls `notFound()` as a defense-in-depth guard even though the middleware already rewrites unknown slugs — belt-and-suspenders for direct requests that bypass middleware
- Page and layout both fetch restaurant data independently rather than passing via React Context — acceptable at POC scale, avoids over-engineering Server Component context passing
- Prata rank badge uses dark text (`#333`) instead of white — silver (#C0C0C0) background fails WCAG contrast with white text

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `/{slug}` landing page is fully functional with CTA buttons (`id="cta-register"`, `data-action="open-register"`, `data-restaurant-id`) ready for Plan 04-02 to attach registration modal behavior
- `generate_next_card_number(p_restaurant_id)` RPC available for Plan 04-02 customer registration server action
- `total_spend` column on customers ready for Plan 04-03 analytics display without JOIN
- Analytics indexes on `sales` and `point_transactions` ready for Plan 04-03 period-filtered queries

## Self-Check: PASSED

All files exist and all commits verified.

---
*Phase: 04-customer-experience-analytics*
*Completed: 2026-02-21*
