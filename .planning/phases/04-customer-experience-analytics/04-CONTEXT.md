# Phase 4: Customer Experience + Analytics - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Customer-facing registration funnel (white-labeled landing page + signup flow with card creation) and owner-facing analytics dashboard (overview metrics, customer list, sales log, manager audit log). Apple Wallet pass generation, push notifications, and Google Wallet are NOT in scope for this phase.

</domain>

<decisions>
## Implementation Decisions

### Landing page presentation
- Full marketing page layout: hero with restaurant logo, benefits section, how-it-works steps, rank progression, footer CTA
- Restaurant's primary color as dominant background/accents, white content areas, logo prominent at top
- Casual and warm copy tone in pt-BR — "Ganhe pontos toda vez que nos visitar!" style, informal (você)
- Rank progression (Bronze → Prata → Gold → VIP) displayed in how-it-works section with colored visual badges and brief benefit descriptions per rank

### Registration & onboarding
- CTA opens a modal/drawer with the registration form — customer stays on the same page
- Form fields: name and phone number only (as specified in requirements)
- Phone number uses input mask (XX) XXXXX-XXXX format — no SMS verification for POC
- Post-registration: visual preview of their loyalty card (name, card number, rank) + "Adicionar à Apple Wallet" button below
- Apple Wallet button is the only post-registration action — no Android fallback, customers without iPhones see their card number on the preview only

### Analytics overview
- Top row of 4-5 stat cards: total customers, total points issued, total sales count, total revenue tracked
- Rank distribution chart — Claude's discretion on chart type (bar vs donut)
- Period selector: 7d / 30d / 90d / All time — metrics and charts update per selection
- Analytics as a section/tab within the existing owner dashboard layout (sidebar navigation), not a separate route

### Customer list & logs
- Full text search across name, phone, and card number
- Paginated table: 20-50 rows per page with next/previous navigation
- Sales log ("Vendas") and manager audit log ("Atividade") as separate tabs — clear separation
- Clicking a customer row opens a slide-out side panel with full customer details and transaction history

### Claude's Discretion
- Rank distribution chart type (horizontal bar vs donut/pie)
- Loading skeleton design for analytics
- Exact stat card styling and spacing
- Error state handling across all surfaces
- Side panel layout for customer detail view
- Table column widths and responsive behavior

</decisions>

<specifics>
## Specific Ideas

- Landing page should feel like a restaurant's own loyalty program page — not a generic SaaS product
- Card preview on post-registration should visually match what the customer will see in Apple Wallet (name, number, rank badge)
- Analytics dashboard should live alongside the existing config pages (branding, loyalty config, team) in the sidebar — owner navigates between them naturally

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-customer-experience-analytics*
*Context gathered: 2026-02-21*
