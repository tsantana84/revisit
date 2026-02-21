# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A customer can register in under 60 seconds and immediately have a working loyalty card in their phone wallet that accumulates points every time they visit — zero friction.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 3 of 3 in current phase
Status: In progress
Last activity: 2026-02-21 — Completed 01-03 (Next.js middleware, Supabase client factories, slug resolver)

Progress: [██░░░░░░░░] 20%

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (plans 01-01 and 01-03)
- Average duration: ~5 min
- Total execution time: 0.15 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 9 min | 4.5 min |

**Recent Trend:**
- Last 5 plans: 7 min, 2 min
- Trend: Fast execution

*Updated after each plan completion*
| Phase 01-foundation P02 | 9 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: passkit-generator must run in Next.js API routes (not Supabase Edge Functions) — Deno incompatibility
- [Roadmap]: Use token-based APNs auth (.p8 key, no expiry) — certificate-based auth silently expires and breaks all pass updates
- [Roadmap]: Points stored as integers, NUMERIC columns — float rounding creates ledger drift that accumulates into customer disputes
- [Roadmap]: Apple Developer Program enrollment + Pass Type ID + WWDR G4 certificate must be in place before Phase 4 starts — organizational prerequisite, not a code task
- [01-01]: Soft-delete via active_* views, not RLS — avoids UPDATE re-validation conflict where setting deleted_at would make the row invisible mid-UPDATE
- [01-01]: SECURITY DEFINER get_restaurant_id() with (SELECT ...) wrapper in all policies — prevents per-row JWT parsing; query plan cached per statement
- [01-01]: Custom Access Token Hook (0002_rls.sql) must be registered in Supabase Dashboard after deploy — without it, JWT has no restaurant_id/app_role and all RLS returns empty
- [01-01]: UNIQUE(user_id) on restaurant_staff enforces one-restaurant-per-user for POC; drop constraint to enable multi-restaurant managers in future
- [01-02]: custom_access_token_hook must be SECURITY DEFINER — supabase_auth_admin has SELECT GRANT but no RLS policy on restaurant_staff; without SECURITY DEFINER the lookup silently returns null
- [01-02]: Hook configured in config.toml [auth.hook.custom_access_token] for local dev auto-registration — no Dashboard step needed locally, only for cloud/production deploys
- [01-02]: check_rls_enabled() RPC queries pg_class for all public tables without RLS — CI enforcement pattern so any new unprotected table breaks npm run test:rls
- [Phase 01-03]: Manual Next.js setup (npm init + npm install) instead of create-next-app — directory was non-empty
- [Phase 01-03]: auth.getUser() used for session refresh (not getSession()) — verifies JWT signature server-side
- [Phase 01-03]: SUPABASE_SERVICE_ROLE_KEY never prefixed NEXT_PUBLIC_ — middleware runs server-side only, exposing it would bypass RLS
- [Phase 01-02]: custom_access_token_hook must be SECURITY DEFINER — supabase_auth_admin has no RLS policy on restaurant_staff, so lookup silently returns null without it

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4 prerequisite]: Apple Developer Program enrollment ($99/year), Pass Type ID registration, WWDR G4 certificate download, and .p8 APNs key generation must happen before Phase 4 planning begins. These are account/credential actions, not code.
- [Phase 4]: apns2 library v12.2.0 maintenance status not deeply verified — check GitHub commit history before Phase 4 build. Fallback: raw http2 fetch to APNs.
- [Phase 4]: Test pass generation on a Vercel preview deployment before production — Vercel filesystem is read-only, local dev passes but production throws EROFS.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 01-02-PLAN.md — JWT hook registration, SECURITY DEFINER fix, and RLS isolation test suite
Resume file: None
