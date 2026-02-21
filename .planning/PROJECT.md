# REVISIT

## What This Is

REVISIT is a white-label SaaS digital loyalty platform for bars and restaurants. Restaurants subscribe, configure their loyalty program, and their customers receive a branded digital card in their phone wallet (Apple Wallet) — no app download, no physical card. Points accumulate automatically on every visit.

## Core Value

A customer can register in under 60 seconds and immediately have a working loyalty card in their phone wallet that accumulates points every time they visit — zero friction.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Owner can sign up, configure a loyalty program, and have it ready to accept customers
- [ ] Customer can register with name + phone and immediately receive an Apple Wallet card
- [ ] Manager can look up a customer by card number, confirm identity, and register a sale in under 30 seconds
- [ ] Points are credited automatically based on sale value, configurable rate, and rank multiplier
- [ ] Rank system promotes customers automatically based on visit count
- [ ] Wallet card updates automatically (points balance, rank, card color)
- [ ] Push notifications sent on key events (points credited, rank up, reward available)
- [ ] Owner can view analytics dashboard (customers, points, sales, revenue, rank distribution)
- [ ] Owner can view full customer list and sales log
- [ ] Owner can send push notifications (all customers or segmented by rank)
- [ ] Owner can create and manage manager accounts
- [ ] Card numbers use #XXXX-D format with check-digit validation
- [ ] Reward system (cashback, free product, or progressive discount — one per restaurant)
- [ ] Full multi-tenant data isolation between restaurants
- [ ] White-label: customer-facing pages branded as the restaurant, REVISIT invisible
- [ ] All UI in Brazilian Portuguese (pt-BR)

### Out of Scope

- QR code scanning at register — card number typed manually for POC
- Customer-facing web portal or app — wallet card is the only customer interface
- Stripe billing / subscription management — POC has no payment
- Multiple restaurants per owner account — one restaurant per owner for POC
- API integrations with POS systems — manual sale entry only
- Advanced analytics (cohort analysis, churn prediction) — basic dashboard only
- Points expiration enforcement — configurable but not enforced in POC
- Google Wallet — Apple Wallet first, Google later
- Internationalization — pt-BR only for POC

## Context

- Target market: Brazilian bars and restaurants
- Customers never interact with REVISIT directly — their only touchpoint is the wallet card and push notifications
- Registration flow: restaurant landing page → name + phone → "Add to Apple Wallet" button → done
- Manager panel: dedicated /manager route with stripped-down single-function UI (lookup customer, register sale)
- Owner panel: full dashboard at app.revisit.com/dashboard with analytics, customer list, sales log, notifications, settings
- Customer-facing pages: app.revisit.com/{restaurant-slug} for landing page and registration
- Card delivery: redirect after form submit shows "Add to Wallet" button (no SMS)
- Default ranks: Bronze (0+ visits, 1x), Prata (5+ visits, 1.5x), Gold (15+ visits, 2x), VIP (30+ visits, 3x) — fully configurable per restaurant
- Default points rate: 2 points per R$1 spent — configurable per restaurant
- Two-step confirmation on sale registration to eliminate errors

## Constraints

- **Tech stack**: Next.js + Supabase — deployed on Vercel
- **Wallet**: Apple Wallet (.pkpass) first — Google Wallet deferred
- **Language**: Brazilian Portuguese (pt-BR) for all UI
- **Auth**: Email + password for owner/manager registration
- **Multi-tenancy**: Row-level security in Supabase, full data isolation per restaurant
- **POC timeline**: Must be demo-ready end-to-end for a single restaurant

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js + Supabase | Fast iteration, built-in auth/RLS, Vercel deployment, real-time subscriptions for wallet updates | — Pending |
| Apple Wallet first | iOS dominant in target market, .pkpass is well-documented, Google Wallet added later | — Pending |
| Separate manager panel route | Managers need a single-function UI with no distractions, role-based routing would expose navigation elements | — Pending |
| Same domain for admin + customer | Simpler infrastructure for POC, URL slug routing (/{restaurant-slug}) for customer pages | — Pending |
| Card number typed (no QR) | Reduces complexity for POC, QR scanning added in future iteration | — Pending |
| Redirect-based card delivery | Simplest flow — no SMS provider needed for POC | — Pending |

---
*Last updated: 2026-02-20 after initialization*
