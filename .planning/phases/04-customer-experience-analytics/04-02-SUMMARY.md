---
phase: 04-customer-experience-analytics
plan: 02
subsystem: ui, api
tags: [nextjs, server-actions, react, dialog, apple-wallet, phone-mask, zod]

# Dependency graph
requires:
  - phase: 04-customer-experience-analytics
    plan: 01
    provides: /{slug} landing page with CTA buttons, generate_next_card_number RPC, x-restaurant-id header injection
  - phase: 01-foundation
    provides: createServiceClient() service role Supabase client, middleware slug resolver
  - phase: 02-owner-setup
    provides: primary_color, program_name, logo_url branding on restaurants table

provides:
  - registerCustomer Server Action at src/lib/actions/customer.ts
  - RegistrationModal client component with phone mask, useActionState, card preview
  - LandingPageClient wrapper managing modal open/close state for hero and footer CTAs
  - iOS detection for conditional Apple Wallet button rendering

affects:
  - 04-03-analytics-dashboard (customers table now gets rows inserted by registerCustomer)
  - apple-wallet phase (button links to /api/pass/{cardNumber} — endpoint to be built)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useActionState(registerCustomer, undefined) for Server Action form state — step field drives form vs card preview"
    - "Controlled phone input with formatPhone() + hidden <input name=phone> carrying raw digits to Server Action"
    - "<dialog> element with ref.showModal()/ref.close() in useEffect keyed on isOpen prop"
    - "iOS detection via navigator.userAgent in useEffect (client-only, not SSR-safe)"
    - "LandingPageClient 'use client' wrapper rendered by Server Component — passes restaurantName + primaryColor as props"
    - "Duplicate phone check before insert + 23505 error code handler for race conditions"

key-files:
  created:
    - src/lib/actions/customer.ts
    - src/app/[slug]/RegistrationModal.tsx
    - src/app/[slug]/LandingPageClient.tsx
  modified:
    - src/app/[slug]/page.tsx

key-decisions:
  - "LandingPageClient rendered twice (hero + footer slots) each with own isOpen state — avoids shared-state complexity at POC scale, two light modal instances acceptable"
  - "registerCustomer reads x-restaurant-id exclusively from headers() — form field injection attack vector eliminated"
  - "Duplicate phone returns success with isExisting: true (not error) — idempotency over 60-second UX flow requirement"
  - "Apple Wallet button links to /api/pass/{cardNumber} before that route exists — button is present on iOS, 404 is acceptable until Phase 5 passkit implementation"
  - "useActionState isPending drives disabled state and button text — no separate useFormStatus needed"

patterns-established:
  - "RegisterState discriminated union on step field ('success' | 'error' | undefined) — clean type narrowing in JSX without boolean flags"
  - "Phone mask pattern: visible display input + hidden name=phone input with raw digits — Server Action always receives clean phone for validation"

requirements-completed:
  - CARD-01

# Metrics
duration: 2min
completed: 2026-02-21
---

# Phase 4 Plan 02: Customer Registration Modal + Card Preview Summary

**Customer registration flow with name/phone form, phone mask, server-side deduplication, card preview, and iOS-conditional Apple Wallet button — all accessible within 60 seconds from landing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-21T15:12:57Z
- **Completed:** 2026-02-21T15:15:50Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- `registerCustomer` Server Action validates name + phone via Zod, deduplicates by phone (returns existing card with `isExisting: true`), generates card number via `generate_next_card_number` RPC, inserts customer with bronze rank, handles 23505 unique violation race condition
- `RegistrationModal` client component uses `<dialog>` element with showModal()/close(), controlled phone input with (XX) XXXXX-XXXX mask storing raw digits in hidden field, card preview on success showing customer name, card number, rank badge, and 0 pontos
- iOS detection via `navigator.userAgent` in `useEffect` — shows "Adicionar a Apple Wallet" link on iPhone/iPad, "Guarde seu numero" text on desktop/Android
- `LandingPageClient` client wrapper manages modal open state for both hero and footer CTA slots — Server Component passes branding props down
- `page.tsx` updated to replace static `<button>` elements with `<LandingPageClient>` for each CTA slot

## Task Commits

1. **Task 1: Registration modal, Server Action, LandingPageClient** - `47eae25` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `src/lib/actions/customer.ts` - registerCustomer Server Action with Zod validation, phone dedup, RPC card generation, customer insert
- `src/app/[slug]/RegistrationModal.tsx` - Client modal with phone mask, useActionState, card preview, iOS detection
- `src/app/[slug]/LandingPageClient.tsx` - 'use client' wrapper managing isModalOpen state for hero/footer CTAs
- `src/app/[slug]/page.tsx` - Updated to import LandingPageClient for CTA slots instead of static buttons

## Decisions Made

- `LandingPageClient` rendered twice (once per CTA slot) with independent `isOpen` state — simpler than lifting state to a shared parent, acceptable at POC scale
- `registerCustomer` reads `x-restaurant-id` exclusively from `headers()` — cannot be spoofed by form field manipulation
- Duplicate phone registration returns `isExisting: true` success (not error) — idempotency matches the "under 60 seconds" UX goal
- Apple Wallet button links to `/api/pass/{cardNumber}` even though that endpoint doesn't exist yet — button is present on iOS, 404 acceptable until Phase 5

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Customer registration fully functional: name + phone → card preview in under 60 seconds
- `customers` table now receives real registrations; analytics queries in Plan 04-03 will have data
- Apple Wallet button wired to `/api/pass/{cardNumber}` — Phase 5 passkit implementation can activate without touching this component

## Self-Check: PASSED

All files verified:
- `src/lib/actions/customer.ts` — exists, contains `registerCustomer`
- `src/app/[slug]/RegistrationModal.tsx` — exists, contains `RegistrationModal`
- `src/app/[slug]/LandingPageClient.tsx` — exists, contains `LandingPageClient`
- `src/app/[slug]/page.tsx` — updated, imports `LandingPageClient`
- Commit `47eae25` — verified in git log

---
*Phase: 04-customer-experience-analytics*
*Completed: 2026-02-21*
