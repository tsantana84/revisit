# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-20)

**Core value:** A customer can register in under 60 seconds and immediately have a working loyalty card in their phone wallet that accumulates points every time they visit — zero friction.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-02-20 — Roadmap created, requirements mapped to 5 phases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: passkit-generator must run in Next.js API routes (not Supabase Edge Functions) — Deno incompatibility
- [Roadmap]: Use token-based APNs auth (.p8 key, no expiry) — certificate-based auth silently expires and breaks all pass updates
- [Roadmap]: Points stored as integers, NUMERIC columns — float rounding creates ledger drift that accumulates into customer disputes
- [Roadmap]: Apple Developer Program enrollment + Pass Type ID + WWDR G4 certificate must be in place before Phase 4 starts — organizational prerequisite, not a code task

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 4 prerequisite]: Apple Developer Program enrollment ($99/year), Pass Type ID registration, WWDR G4 certificate download, and .p8 APNs key generation must happen before Phase 4 planning begins. These are account/credential actions, not code.
- [Phase 4]: apns2 library v12.2.0 maintenance status not deeply verified — check GitHub commit history before Phase 4 build. Fallback: raw http2 fetch to APNs.
- [Phase 4]: Test pass generation on a Vercel preview deployment before production — Vercel filesystem is read-only, local dev passes but production throws EROFS.

## Session Continuity

Last session: 2026-02-20
Stopped at: Roadmap created and files written — ready to begin Phase 1 planning
Resume file: None
