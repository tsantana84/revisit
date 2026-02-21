# Phase 1: Foundation - Context

**Gathered:** 2026-02-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Database schema with RLS isolation, Supabase Auth JWT custom claims, and Next.js tenant middleware. This is the invisible foundation every feature in Phases 2-5 builds on. No UI, no customer-facing behavior — pure infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Data Modeling
- Soft delete everywhere — `deleted_at` timestamp column on all tables, nothing ever hard-deleted
- Seed script with one demo restaurant — enough sample customers, sales, and ranks to verify the flow during development

### Tenant Isolation
- `restaurant_id` column on every single table — redundant but explicit, RLS policies are simple and consistent across the entire schema
- Automated cross-tenant test suite — runs on every deploy, verifies that a query authenticated as Restaurant A never returns Restaurant B data (must run from Supabase client SDK, not SQL Editor which bypasses RLS)

### Claude's Discretion
- **Points ledger design** — Claude picks the best approach for auditability and performance (running balance vs transaction log vs both)
- **Rank storage** — Claude decides whether ranks are a separate table or JSONB column, based on query patterns
- **Reward config storage** — Claude decides polymorphic JSON vs typed columns, based on flexibility vs type safety
- **RLS helper pattern** — Claude decides whether to use a helper function (get_restaurant_id()) or direct JWT access in policies
- **JWT claims** — Claude picks the right set of claims (at minimum restaurant_id + role, potentially more)
- **Auth model** — Claude decides whether owners and managers share one Supabase Auth table with roles or use separate flows
- **Login routing** — Claude picks whether to use role-based redirect from a single login or separate login pages
- **Manager scope** — Claude decides one-restaurant-only vs schema-supports-multiple for POC
- **Slug source** — Claude decides whether slug is auto-generated from restaurant name or owner-picked
- **Invalid slug behavior** — Claude decides the UX for invalid slugs (404, redirect, etc.)
- **Slug caching** — Claude decides the caching strategy for slug-to-restaurant_id resolution in middleware
- **Slug payload** — Claude decides whether middleware resolves just restaurant_id or also loads branding data

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The user wants a solid, correctly-isolated foundation and trusts Claude's technical judgment on implementation details.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-02-20*
