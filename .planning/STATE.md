# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A customer can register in under 60 seconds and immediately have a working loyalty card in their phone wallet that accumulates points every time they visit — zero friction.
**Current focus:** Phase 4 — Customer Experience + Analytics

## Current Position

Phase: 4 of 4 (Customer Experience + Analytics)
Plan: 2 of 3 in current phase — PLAN 02 COMPLETE
Status: Phase 4 in progress (plan 03 remains — Apple Wallet passkit)
Last activity: 2026-02-21 — Completed 04-02 (Customer registration modal: registerCustomer Server Action, RegistrationModal with phone mask + card preview, LandingPageClient, iOS Apple Wallet button)

Progress: [████████░░] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 2 (plans 01-01 and 01-03)
- Average duration: ~5 min
- Total execution time: 0.15 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 2 | 9 min | 4.5 min |
| 02-owner-setup | 3 | 16 min | 5.3 min |

**Recent Trend:**
- Last 5 plans: 7 min, 2 min, 5 min
- Trend: Fast execution

*Updated after each plan completion*
| Phase 01-foundation P02 | 9 | 2 tasks | 6 files |
| Phase 02-owner-setup P01 | 5 | 2 tasks | 13 files |
| Phase 02-owner-setup P02 | 8 | 2 tasks | 2 files |
| Phase 02-owner-setup P03 | 3 | 2 tasks | 5 files |
| Phase 03-loyalty-engine-manager-pos P01 | 3 | 2 tasks | 5 files |
| Phase 03-loyalty-engine-manager-pos P02 | 5 | 1 task | 1 file |
| Phase 03-loyalty-engine-manager-pos P03 | 2 | 2 tasks | 4 files |
| Phase 03-loyalty-engine-manager-pos P04 | 15 | 3 tasks | 2 files |
| Phase 04-customer-experience-analytics P03 | 5 | 3 tasks | 7 files |
| Phase 04-customer-experience-analytics P01 | 5 | 2 tasks | 3 files |
| Phase 04-customer-experience-analytics P02 | 2 | 1 tasks | 4 files |

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
- [02-01]: jwt-decode on session access_token (not user.app_metadata) to read app_role — app_metadata mirror unreliable for custom hook-injected claims
- [02-01]: signOut() + redirect('/login?signup=success') after signup instead of refreshSession() — avoids session cookie timing uncertainty in Server Action
- [02-01]: string_to_array(name, '/') instead of storage.foldername() in RLS — safer for local Supabase CLI versions
- [02-01]: /signup added to NON_TENANT_PREFIXES in middleware — prevents signup URL being treated as tenant slug
- [02-02]: verifyOwner() helper in route.ts reuses JWT claim check across POST and GET without duplication
- [02-02]: email_confirm: true on auth.admin.createUser — owner sets password directly, no email verification needed for staff account
- [02-02]: POST response includes email so team page can annotate newly created manager rows (restaurant_staff has no email column)
- [02-03]: getAuthenticatedOwner() helper shared by all three Server Actions — avoids repeating JWT decode + role check
- [02-03]: delete+insert strategy for ranks — simpler than upsert+reconcile at POC scale, no orphaned rows
- [02-03]: ranks_json hidden field pattern — client serializes dynamic row state to JSON before submit; Server Action owns all validation
- [02-03]: Zod v4 enum: requires 'as const' array + { error: string } not { errorMap: fn }; ZodError.issues not ZodError.errors
- [Phase 03-01]: register_sale/register_redemption as SECURITY DEFINER PostgreSQL RPCs — only atomic write pattern available in PostgREST (no transaction API)
- [Phase 03-01]: Seed card numbers updated from letter suffix (#0001-A) to Luhn numeric (#0001-9) — letter suffixes fail validateCardNumber() regex
- [Phase 03-02]: getAuthenticatedManager accepts both owner and manager roles — owners need POS access for POC flexibility
- [Phase 03-02]: Staff ID resolved from active_restaurant_staff view filtered by user_id — not assumed from JWT sub to match RPC expectation
- [Phase 03-02]: lookupCustomer is pure read (zero write operations) — safe to call on card scan without side effects
- [Phase 03-02]: registerSale delegates entirely to register_sale RPC — no sequential DB calls, atomicity guaranteed by PostgreSQL
- [Phase 03-02]: SaleState includes rankPromoted and newRankName — surfaces RPC promotion data for Phase 4 wallet card color change without implementing display logic here
- [Phase 03-03]: checkRewardAvailability exported from 'use server' module — callable from POS server components or other server actions
- [Phase 03-03]: cashback availableCredit uses Math.floor (not round) — prevents showing credit customer doesn't yet have
- [Phase 03-03]: progressive discount uses zero-delta point_transaction for ledger auditability without balance change
- [Phase 03-03]: getAuthenticatedManager accepts owner OR manager role — owners may test POS flow directly
- [Phase 03-04]: checkRewardForCurrentManager wrapper added to rewards.ts — resolves restaurantId from JWT so POS page never needs restaurantId as a client-visible hidden input
- [Phase 03-04]: Three-phase POS UI driven entirely by useActionState step field — 'preview' shows confirmation, 'success' shows success screen, no local phase enum needed
- [Phase 03-04]: resetTrigger local state resets to Phase 1 on Cancelar/Nova Venda without window.location.reload — preserves React hydration
- [Phase 04-customer-experience-analytics]: recharts Tooltip formatter typed as (value: number | string | undefined) — recharts v2 types value as potentially undefined, requires union type
- [Phase 04-customer-experience-analytics]: CustomerPanel implemented as Server Component — fetches own data via Supabase, panel state URL-driven via selected searchParam
- [Phase 04-customer-experience-analytics]: Manager attribution shown as staff role (Proprietário/Gerente) — auth.users.email unreachable through PostgREST from restaurant_staff view at POC scale
- [Phase 04-customer-experience-analytics]: generate_next_card_number SECURITY DEFINER RPC scans MAX(card_number) across all customers including deleted — guarantees no card number reuse
- [Phase 04-customer-experience-analytics]: Tenant landing page (/{slug}/page.tsx) reads x-restaurant-id from headers() — middleware-injected from DB-verified slug, cannot be spoofed by client
- [Phase 04-customer-experience-analytics]: LandingPageClient rendered twice per CTA slot with independent isOpen state — avoids shared-state complexity at POC scale
- [Phase 04-customer-experience-analytics]: registerCustomer reads x-restaurant-id exclusively from headers() — form field injection attack vector eliminated
- [Phase 04-customer-experience-analytics]: Duplicate phone registration returns isExisting: true success (not error) — idempotency over UX friction

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4 prerequisite]: Apple Developer Program enrollment ($99/year), Pass Type ID registration, WWDR G4 certificate download, and .p8 APNs key generation must happen before Phase 4 planning begins. These are account/credential actions, not code.
- [Phase 4]: apns2 library v12.2.0 maintenance status not deeply verified — check GitHub commit history before Phase 4 build. Fallback: raw http2 fetch to APNs.
- [Phase 4]: Test pass generation on a Vercel preview deployment before production — Vercel filesystem is read-only, local dev passes but production throws EROFS.

## Session Continuity

Last session: 2026-02-21
Stopped at: Completed 04-02-PLAN.md — Customer registration modal with phone mask, card preview, iOS Apple Wallet button, registerCustomer Server Action, LandingPageClient client wrapper.
Resume file: None
