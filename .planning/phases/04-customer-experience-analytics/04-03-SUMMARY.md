---
phase: 04-customer-experience-analytics
plan: 03
subsystem: ui
tags: [recharts, next.js, supabase, analytics, dashboard, pt-BR]

# Dependency graph
requires:
  - phase: 03-loyalty-engine-manager-pos
    provides: register_sale RPC, active_sales, active_point_transactions, active_customers views with full data
  - phase: 04-customer-experience-analytics
    provides: analytics migration with indexes, get_next_card_number RPC, total_spend column

provides:
  - Analytics overview page with 4 stat cards (customers, points, sales, revenue) and recharts donut chart
  - Period selector client component (7d/30d/90d/all) using useRouter + useTransition
  - Searchable paginated customer list (25/page) with rank, points, visits, spend, registration date
  - Customer detail side panel (server component) with transaction history, rendered via URL state
  - Logs page with Vendas and Atividade tabs, period filtering, pagination, manager attribution via staff role
  - Owner sidebar updated with Análises, Clientes, Registros navigation links

affects: [phase-04-landing, future-phases]

# Tech tracking
tech-stack:
  added: [recharts 2.x]
  patterns:
    - Server Component fetches data, passes as props to 'use client' chart components (recharts isolation)
    - searchParams as URL state for period filter, search, pagination, and panel selection
    - Batch-fetch + client-side Map for customer/staff joins (no PostgREST join complexity)
    - URL-driven side panel: selected= searchParam opens panel, closeUrl strips it

key-files:
  created:
    - src/app/dashboard/owner/analytics/page.tsx
    - src/app/dashboard/owner/analytics/PeriodSelector.tsx
    - src/app/dashboard/owner/analytics/RankDonutChart.tsx
    - src/app/dashboard/owner/customers/page.tsx
    - src/app/dashboard/owner/customers/CustomerPanel.tsx
    - src/app/dashboard/owner/logs/page.tsx
  modified:
    - src/app/dashboard/owner/layout.tsx

key-decisions:
  - "recharts Tooltip formatter typed as (value: number | string | undefined) — recharts v2 passes undefined in some cases, TypeScript strict mode requires the union"
  - "CustomerPanel is a Server Component (not 'use client') — it fetches its own data via Supabase, avoiding prop drilling and enabling server-side rendering of transaction history"
  - "URL-driven panel via selected= searchParam — no client state needed, panel survives page refresh, deep-linkable"
  - "Staff manager attribution shown as role label (Proprietário/Gerente) not email — auth.users.email not reachable via PostgREST from restaurant_staff view; role is sufficient for POC scale"
  - "Batch-fetch + client-side Map for joins (customers, staff) — avoids complex PostgREST join syntax through views, simpler and more predictable at POC scale"
  - "Period selector on logs page uses <a href> links (not useRouter) — logs page is fully server-rendered, no client component needed for tab/period navigation"

patterns-established:
  - "Chart isolation: Server Component → data → 'use client' chart component props"
  - "URL state for filters: searchParams drives all server queries (period, tab, page, q, selected)"
  - "Batch fetch pattern: collect unique IDs from rows, single .in() query, build Map for O(1) lookups"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: 5min
completed: 2026-02-21
---

# Phase 4 Plan 03: Owner Analytics Dashboard Summary

**Owner analytics dashboard with recharts donut chart, searchable customer list with URL-driven side panel, and tabbed sales/audit logs — all server-rendered with searchParams period filtering**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-21T15:04:55Z
- **Completed:** 2026-02-21T15:09:30Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Analytics overview: 4 stat cards (total customers, points issued, sales count, revenue in BRL) with period filtering and rank distribution donut chart via recharts
- Searchable paginated customer list with URL-driven slide-out server component detail panel showing transaction history
- Logs page with Vendas/Atividade tabs, period selector, paginated tables with manager attribution by staff role

## Task Commits

Each task was committed atomically:

1. **Task 1: Sidebar nav + analytics overview (stat cards, donut chart, period selector)** - `976c147` (feat)
2. **Task 2: Searchable customer list with pagination and slide-out detail panel** - `f650cc7` (feat)
3. **Task 3: Sales log and manager audit log with tabs** - `645ce4e` (feat)

## Files Created/Modified

- `src/app/dashboard/owner/layout.tsx` — Added Análises, Clientes, Registros nav links to sidebar
- `src/app/dashboard/owner/analytics/page.tsx` — Server component: parallel queries for 4 stats + rank distribution, passes data to client components
- `src/app/dashboard/owner/analytics/PeriodSelector.tsx` — Client component: period buttons with useRouter + useTransition
- `src/app/dashboard/owner/analytics/RankDonutChart.tsx` — Client component: recharts ResponsiveContainer donut with total count center label
- `src/app/dashboard/owner/customers/page.tsx` — Server component: ILIKE search, range pagination, conditional CustomerPanel render
- `src/app/dashboard/owner/customers/CustomerPanel.tsx` — Server component: customer details + last 20 transactions, closes via URL
- `src/app/dashboard/owner/logs/page.tsx` — Server component: Vendas and Atividade tabs with shared period selector and pagination

## Decisions Made

- recharts Tooltip formatter typed as `(value: number | string | undefined)` — recharts v2 types value as potentially undefined, TypeScript strict mode requires handling it
- CustomerPanel implemented as Server Component — fetches its own data, no client state, panel state entirely URL-driven via `selected` searchParam
- Manager attribution via staff role (Proprietário/Gerente) rather than email — `auth.users.email` unreachable through PostgREST from restaurant_staff view at POC scale
- Batch-fetch + Map pattern for joins — simpler than PostgREST join syntax through views, performs correctly at POC row counts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed recharts Tooltip formatter TypeScript type error**
- **Found during:** Task 1 (RankDonutChart build)
- **Issue:** `formatter={(value: number) => ...}` fails TypeScript — recharts types value as `number | string | undefined`
- **Fix:** Changed parameter type to `number | string | undefined` with nullish coalescing fallback
- **Files modified:** `src/app/dashboard/owner/analytics/RankDonutChart.tsx`
- **Verification:** `npm run build` passed with no TypeScript errors
- **Committed in:** `976c147` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 type error bug)
**Impact on plan:** Minimal — one TypeScript fix required by recharts v2 type definitions. No scope creep.

## Issues Encountered

- recharts `Tooltip` formatter type is stricter than expected — value typed as `number | string | undefined`, not just `number`. Fixed with union type on first build attempt.

## User Setup Required

None — no external service configuration required. All functionality uses existing Supabase client with JWT-authenticated queries.

## Next Phase Readiness

- All owner analytics routes complete and building
- DASH-01 through DASH-04 requirements satisfied
- Phase 4 plan 03 complete — phase 04 remaining work: plans 01 (migration) and 02 (landing page + registration) are the other plans in this phase

---
*Phase: 04-customer-experience-analytics*
*Completed: 2026-02-21*

## Self-Check: PASSED

All files verified present:
- FOUND: src/app/dashboard/owner/layout.tsx
- FOUND: src/app/dashboard/owner/analytics/page.tsx
- FOUND: src/app/dashboard/owner/analytics/PeriodSelector.tsx
- FOUND: src/app/dashboard/owner/analytics/RankDonutChart.tsx
- FOUND: src/app/dashboard/owner/customers/page.tsx
- FOUND: src/app/dashboard/owner/customers/CustomerPanel.tsx
- FOUND: src/app/dashboard/owner/logs/page.tsx

All commits verified:
- FOUND: 976c147 (Task 1)
- FOUND: f650cc7 (Task 2)
- FOUND: 645ce4e (Task 3)
