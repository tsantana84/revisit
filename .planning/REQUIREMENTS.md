# Requirements: REVISIT

**Defined:** 2026-02-20
**Core Value:** A customer can register in under 60 seconds and immediately have a working loyalty card in their phone wallet that accumulates points every time they visit — zero friction.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Multi-tenancy

- [x] **AUTH-01**: Owner can sign up with email and password
- [x] **AUTH-02**: Owner can log in and access their restaurant dashboard
- [x] **AUTH-03**: Owner can create manager accounts with email and password
- [x] **AUTH-04**: Manager can log in and access the dedicated manager panel
- [x] **AUTH-05**: Each restaurant's data is fully isolated — customers, points, sales, and configurations never visible to other restaurants (Supabase RLS)

### Customer Registration & Wallet

- [ ] **CARD-01**: Customer can register with only name and phone number on a white-label landing page
- [ ] **CARD-02**: Customer receives an Apple Wallet card immediately after registration via "Add to Wallet" button
- [x] **CARD-03**: Each customer gets a unique card number in #XXXX-D format with algorithmic check-digit validation
- [ ] **CARD-04**: Wallet card displays: restaurant name/logo, customer name, card number, current points balance, current rank
- [ ] **CARD-05**: Wallet card background color changes to reflect the customer's current rank

### Points Engine

- [ ] **PTS-01**: Points are awarded per sale based on: sale value (R$) × points per R$ × rank multiplier
- [ ] **PTS-02**: Owner can configure the points-per-R$ earn rate (default: 2 points per R$1)
- [ ] **PTS-03**: Points are credited automatically after manager confirms a sale
- [ ] **PTS-04**: Wallet card updates automatically after every transaction (points balance)
- [x] **PTS-05**: Owner can configure point expiry rules (expiry not enforced in POC, but configurable)

### Rank System

- [ ] **RANK-01**: Owner can configure rank names, visit thresholds, and point multipliers
- [x] **RANK-02**: Default ranks are: Bronze (0+ visits, 1x), Prata (5+ visits, 1.5x), Gold (15+ visits, 2x), VIP (30+ visits, 3x)
- [ ] **RANK-03**: Customer rank is determined by total number of visits (not points)
- [ ] **RANK-04**: When a customer crosses a rank threshold, they are promoted automatically
- [ ] **RANK-05**: Wallet card color changes and customer receives a push notification on rank promotion

### Rewards

- [ ] **RWRD-01**: Owner chooses one reward model per restaurant: cashback, free product, or progressive discount
- [ ] **RWRD-02**: Cashback: points convert to R$ credit at the register
- [ ] **RWRD-03**: Free product: a specific product is unlocked at a point threshold
- [ ] **RWRD-04**: Progressive discount: percentage discount grows with rank (e.g., Bronze 5%, Gold 15%)
- [ ] **RWRD-05**: Reward redemption is always confirmed by the manager at the panel

### Manager Panel

- [ ] **MGR-01**: Manager panel is a dedicated route with a single-function UI
- [ ] **MGR-02**: Manager can look up a customer by typing their card number
- [ ] **MGR-03**: System validates the check digit and rejects invalid card numbers before lookup
- [ ] **MGR-04**: System shows customer name and rank for visual identity confirmation
- [ ] **MGR-05**: Manager can enter the sale value in R$
- [ ] **MGR-06**: System shows "This will credit X points to [Name]. Confirm?" before crediting
- [ ] **MGR-07**: Manager cannot access analytics, customer lists, configurations, or any other section

### Owner Dashboard

- [ ] **DASH-01**: Owner can view analytics overview: total customers, total points issued, total sales, total revenue tracked, rank distribution chart
- [ ] **DASH-02**: Owner can view searchable customer list with rank, points, visits, total spend, and registration date
- [ ] **DASH-03**: Owner can view full sales log: customer, card number, value, points credited, which manager registered, date and time
- [ ] **DASH-04**: Owner can see audit log of all manager activity
- [x] **DASH-05**: Owner can configure program settings: program name, colors, ranks, multipliers, reward type

### Push Notifications

- [ ] **PUSH-01**: Customer receives a welcome push notification on registration
- [ ] **PUSH-02**: Customer receives a push notification when points are credited after a sale
- [ ] **PUSH-03**: Customer receives a push notification on rank promotion
- [ ] **PUSH-04**: Customer receives a push notification when a reward is available
- [ ] **PUSH-05**: Owner can send a push notification to all customers or segmented by rank

### White-Label

- [x] **WL-01**: Customer-facing pages (landing page, registration) are branded as the restaurant
- [x] **WL-02**: The customer never sees the name "REVISIT" on any customer-facing surface
- [x] **WL-03**: Each restaurant has its own URL slug (app.revisit.com/{restaurant-slug})
- [x] **WL-04**: Colors, logo, and program name are fully configurable per restaurant
- [x] **WL-05**: Digital wallet card shows only the restaurant's branding

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Wallet Expansion

- **WEXP-01**: Customer can receive a Google Wallet card in addition to Apple Wallet
- **WEXP-02**: Customer receives SMS with wallet card download link as backup delivery

### Advanced Analytics

- **ANLYT-01**: Owner can view cohort retention analysis (visit frequency over time)
- **ANLYT-02**: Owner can view customer lifetime value estimates

### Engagement

- **ENG-01**: System sends automated win-back push to customers inactive for configurable period
- **ENG-02**: System sends birthday reward to customers (requires DOB collection)
- **ENG-03**: Points expiration is enforced after configurable inactivity period

### Payments

- **PAY-01**: Restaurants pay for REVISIT via Stripe subscription with Pix support
- **PAY-02**: Pix-based cashback disbursement directly to customer Pix keys

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| QR code scanning at register | Card number typed manually for POC — reduces complexity |
| Customer-facing web portal or app | Wallet card is the only customer interface — no auth/session needed |
| Multiple restaurants per owner account | One restaurant per owner for POC |
| API integrations with POS systems | Manual sale entry only — avoids per-POS integration maintenance |
| Google Wallet | Apple Wallet first — Google added in v1.x |
| Internationalization (i18n) | pt-BR only for POC |
| Branded customer mobile app | Apple Wallet delivers the experience without app download friction |
| Coalition loyalty (earn across brands) | Fundamentally different business model — programs isolated per tenant |
| Online ordering integration | Requires iFood/Rappi API integrations — not achievable at MVP scale |
| Gamification (badges, leaderboards) | High complexity, low retention payoff for small restaurants |
| Customer-to-customer referrals | Scope expansion — organic referral via card sharing is sufficient |
| AI-powered personalization | Requires substantial historical data — not viable until 10k+ members per tenant |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 1 | Complete |
| CARD-01 | Phase 5 | Pending |
| CARD-02 | Phase 4 | Pending |
| CARD-03 | Phase 3 | Complete |
| CARD-04 | Phase 4 | Pending |
| CARD-05 | Phase 4 | Pending |
| PTS-01 | Phase 3 | Pending |
| PTS-02 | Phase 3 | Pending |
| PTS-03 | Phase 3 | Pending |
| PTS-04 | Phase 4 | Pending |
| PTS-05 | Phase 3 | Complete |
| RANK-01 | Phase 3 | Pending |
| RANK-02 | Phase 3 | Complete |
| RANK-03 | Phase 3 | Pending |
| RANK-04 | Phase 3 | Pending |
| RANK-05 | Phase 3 | Pending |
| RWRD-01 | Phase 3 | Pending |
| RWRD-02 | Phase 3 | Pending |
| RWRD-03 | Phase 3 | Pending |
| RWRD-04 | Phase 3 | Pending |
| RWRD-05 | Phase 3 | Pending |
| MGR-01 | Phase 3 | Pending |
| MGR-02 | Phase 3 | Pending |
| MGR-03 | Phase 3 | Pending |
| MGR-04 | Phase 3 | Pending |
| MGR-05 | Phase 3 | Pending |
| MGR-06 | Phase 3 | Pending |
| MGR-07 | Phase 3 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |
| DASH-03 | Phase 5 | Pending |
| DASH-04 | Phase 5 | Pending |
| DASH-05 | Phase 2 | Complete |
| PUSH-01 | Phase 4 | Pending |
| PUSH-02 | Phase 4 | Pending |
| PUSH-03 | Phase 4 | Pending |
| PUSH-04 | Phase 4 | Pending |
| PUSH-05 | Phase 4 | Pending |
| WL-01 | Phase 2 | Complete |
| WL-02 | Phase 2 | Complete |
| WL-03 | Phase 2 | Complete |
| WL-04 | Phase 2 | Complete |
| WL-05 | Phase 2 | Complete |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0

---
*Requirements defined: 2026-02-20*
*Last updated: 2026-02-20 after roadmap creation — all 47 v1 requirements mapped*
