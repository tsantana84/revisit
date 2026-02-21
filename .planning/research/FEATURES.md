# Feature Research

**Domain:** Digital loyalty SaaS platform — Brazilian bars and restaurants (white-label, no-app model)
**Researched:** 2026-02-20
**Confidence:** MEDIUM (WebSearch verified across multiple industry sources; Brazil-specific restaurant loyalty market has limited deep coverage)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unprofessional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Customer registration via phone number | Industry standard — phone is the universal identifier; email creates friction | LOW | Name + phone is the minimum. Don't ask for more at registration. |
| Points earning on purchase | Core mechanic — no loyalty without earning | LOW | Must credit automatically after manager logs sale; manual entry is a failure mode |
| Points balance visible to customer | Customers need to know where they stand to stay motivated | LOW | Apple Wallet card updates are the delivery mechanism for REVISIT |
| Reward redemption | Earning without redeeming is a scam — customers leave | MEDIUM | Must be clear when/how rewards unlock; ambiguity kills programs |
| At least one reward type (free product, discount, or cashback) | Expected in any loyalty product | LOW | Choosing one for MVP is fine; the type matters less than clarity |
| Manager POS registration flow | Staff need a fast, error-tolerant way to log sales against a card number | MEDIUM | The card number lookup must be fast; slow POS lookup kills manager adoption |
| Owner dashboard with basic analytics | Owners invest in loyalty to see ROI — blind programs get cancelled | MEDIUM | Minimum: member count, visits, redemptions. Advanced: cohort analysis, LTV |
| White-label branding | Restaurant owners won't use a loyalty product branded by someone else | MEDIUM | Custom logo, colors, program name per tenant |
| Push notifications (balance/status updates) | Customers expect notifications when their balance changes | MEDIUM | Apple Wallet supports lock-screen notifications triggered by value changes — this is how REVISIT delivers without an app |
| Point expiry rules | Programs without expiry create liability and reduce urgency to return | LOW | Configurable inactivity window (e.g., 12 months of no visits = points expire) |
| Frictionless customer onboarding | If registration takes more than 30 seconds, drop-off is high | LOW | Name + phone → Wallet card. One step. |
| Apple Wallet card issuance | In 2025–2026 the wallet IS the homepage for app-free loyalty; expected for no-app programs | HIGH | Requires PassKit-style backend, Apple Developer account per tenant or shared issuer, HTTPS, signed passes |

### Differentiators (Competitive Advantage)

Features that set REVISIT apart. Not universally expected, but valued where present.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Configurable rank/tier system | Tiers increase visit frequency — customers chase next level. Most small-restaurant solutions don't offer this. | MEDIUM | Bronze/Silver/Gold nomenclature is configurable. Multipliers per rank (1x, 2x, 3x) drive aspirational behavior. |
| Point multipliers per rank | Behavior-shaping mechanic absent from most simple punch-card alternatives | LOW | Depends on rank system. e.g., Gold members earn 3x points per real for every sale logged. |
| Multiple reward types (cashback + free product + progressive discount) | Flexibility lets owners match reward to their business model; most platforms force one type | MEDIUM | Progressive discount (e.g., 5% → 10% → 15% per tier) is rare and high-value for bars |
| No customer app required | Removes the #1 adoption barrier for small businesses — customers won't download yet another app | HIGH | Apple Wallet is the differentiator. 70%+ of users drop off at mandatory app registration. Wallet pass = no install, instant value. |
| Per-tenant program configuration | Each restaurant brand has its own program logic, rewards, ranks, and branding | HIGH | Multi-tenant architecture. This is the core of the white-label SaaS model. |
| Google Wallet support | Android users are excluded without it (Android ~75% of Brazilian smartphone market) | HIGH | Brazil has high Android penetration — Google Wallet is not optional for serious market fit. Absence here is a competitive gap. |
| Pix-based cashback integration | Brazil-specific: Pix is ubiquitous and expected for cashback delivery in Brazil by 2026 | HIGH | Direct cashback to Pix keys is the local expectation. Without it, cashback feels abstract. Requires financial infrastructure. |
| Owner-configurable reward thresholds | Owners set their own point costs per reward — flexibility vs rigid defaults | LOW | Low complexity, high trust signal for restaurant owners who distrust locked-in platforms |
| Automated win-back campaigns | Send push notification to lapsed members (e.g., no visit in 60 days) | MEDIUM | Belly (competitor) claims 10% win-back rate from this mechanic. Requires scheduled notification job + pass update logic. |
| Visit frequency analytics | Cohort view: how often do members return vs non-members? | MEDIUM | Core ROI metric for owners. Requires tracking visit timestamps, not just cumulative points. |
| Birthday reward triggers | Industry-standard personalization with measurable visit lift | LOW | Requires DOB collection at registration or separate opt-in field |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for REVISIT's scope, market, and architecture.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Branded customer mobile app | "We want our own app" — perceived prestige | Massive scope: App Store/Play Store submission, maintenance, update cycle, iOS/Android dev cost. Apple Wallet already delivers the customer experience without this. 70%+ of users abandon app-based onboarding. | Apple/Google Wallet passes. 30% of Wallet users organically download the brand app later if needed. |
| Coalition loyalty (earn at multiple brands) | "Let customers earn across all bars in the network" | Fundamentally changes the business model from per-tenant to coalition. Requires shared point ledger, legal agreements, complex reconciliation. | Keep programs isolated per tenant for v1. Coalition is a separate product category. |
| Customer-facing web portal | Customers want to check balance online | Creates auth, session management, a new UI surface. The Wallet card already shows real-time balance. | Wallet card is the customer portal. If needed later, add a read-only balance check page via magic link (no login required). |
| Online ordering integration | "Connect loyalty to delivery orders" | Requires integrations with iFood, Rappi, etc. Each is a separate API contract, certification, and ongoing maintenance burden. Not achievable at MVP scale. | Focus on in-person visits. Log delivery sales manually if needed. |
| Gamification (badges, leaderboards, challenges) | "Make it fun" — valid user desire | High implementation complexity with low retention payoff for small restaurants. Leaderboards require social graph. Challenges require campaign management UI. Evidence shows simpler programs outperform complex ones for small operators. | Tiers and point multipliers deliver the aspiration mechanic with 10% of the complexity. |
| Real-time POS sync via API | "Integrate with our POS automatically" | Every POS (TOTVS, Linx, Stone, Ifood POS) has a different API, certification process, and update cycle. Integration maintenance is a product in itself. | Manager manually logs the sale with card number. Simple, reliable, zero integration maintenance. |
| Customer-to-customer referral system | "Let members earn by bringing friends" | Requires referral code generation, tracking, anti-fraud logic, new earning mechanic. Scope expansion. | Acquisition via physical card sharing is the natural referral for bar/restaurant context. |
| Subscription/membership fee model | "Charge members a monthly fee for premium tier" | Creates billing infrastructure, refund handling, failed payment flows, regulatory complexity in Brazil. | Tiered rank system delivers premium feel without subscription mechanics. |
| AI-powered personalization | Individualized offer targeting | Requires substantial historical data to train models. Not viable until 10k+ active members per tenant. Builds false expectation for small operators. | Segment-based targeting (tier + visit frequency + birthday) delivers 80% of the value at 5% of the complexity. |

---

## Feature Dependencies

```
Customer Registration (name + phone)
    └──requires──> Apple Wallet Card Issuance
                       └──requires──> PassKit/Wallet backend infrastructure
                       └──requires──> Apple Developer account + pass signing

Manager Sale Logging (card number lookup)
    └──requires──> Customer Registration (card exists in system)
    └──requires──> Points Engine (rules for earning)

Points Engine
    └──requires──> Rank System configuration (to know multiplier)
    └──requires──> Reward threshold configuration (to know when to unlock)

Reward Redemption
    └──requires──> Points Engine
    └──requires──> Reward type configuration (cashback / free product / discount)

Push Notifications (balance update)
    └──requires──> Apple Wallet Card Issuance (pass update mechanism)
    └──requires──> Points Engine (triggers after sale logged)

Owner Analytics Dashboard
    └──requires──> Manager Sale Logging (data source)
    └──requires──> Reward Redemption events (data source)

White-Label Branding per Tenant
    └──requires──> Multi-tenant data isolation (owner ↔ their customers only)

Win-Back Campaigns (differentiator)
    └──requires──> Push Notifications (delivery mechanism)
    └──requires──> Visit timestamp tracking (to detect lapse)

Point Multipliers
    └──requires──> Rank System (multiplier is rank-specific)

Google Wallet (differentiator)
    └──enhances──> Customer Registration (parallel card issuance)
    └──requires──> Google Pay Passes API (separate integration from Apple)

Pix Cashback (differentiator)
    └──requires──> Reward type: cashback
    └──requires──> Pix API integration + financial account management
    └──conflicts──> MVP scope (defer to v2)
```

### Dependency Notes

- **Apple Wallet Card Issuance requires PassKit infrastructure:** Pass signing requires a valid Apple Developer certificate, a backend capable of generating signed `.pkpass` files, and HTTPS endpoints Apple can call to update pass data. This is the highest-risk infrastructure dependency in the project.
- **Points Engine requires Rank System before Multipliers work:** You cannot implement multipliers without ranks; build ranks first even if only one tier exists at launch.
- **Push Notifications depend on Wallet pass updates, not a push server:** Apple Wallet notifications are triggered by updating the pass payload and pinging Apple's push service (APNS) with a pass update notification. This is different from traditional push notification infrastructure.
- **Google Wallet conflicts with Apple-only MVP:** Building both simultaneously doubles credential management, pass generation logic, and testing surface. Defer Google Wallet to v1.x unless Android market share data for the target restaurants demands it earlier.
- **Pix Cashback conflicts with MVP:** Requires financial infrastructure (holding/disbursing BRL), regulatory consideration, and Pix API integration. This is a v2+ feature.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed for the first paying restaurant to run their loyalty program end-to-end.

- [ ] Customer registration via name + phone — minimal friction entry point
- [ ] Apple Wallet card issuance — the no-app customer experience; core differentiator
- [ ] Manager sale logging with card number lookup — the POS moment
- [ ] Points Engine with configurable earn rate — basic X points per R$Y spent
- [ ] Rank system (at minimum 1 tier, configurable to 3) — enables multipliers
- [ ] Point multipliers per rank — the behavioral mechanic
- [ ] At least one reward type (free product recommended for MVP simplicity) — redemption closes the loop
- [ ] Push notification on balance change (via Wallet pass update) — reinforces engagement
- [ ] Owner analytics dashboard: member count, visits, redemptions — basic ROI visibility
- [ ] White-label branding per tenant (logo, colors, program name) — required for sale
- [ ] Point expiry configuration — prevents zombie point liability

### Add After Validation (v1.x)

Features to add once core loop is working and at least 3–5 tenants are active.

- [ ] Cashback reward type — add when restaurants with cash-flow model onboard
- [ ] Progressive discount reward type — add when tier programs are proven working
- [ ] Birthday reward trigger — add when operators ask for personalization
- [ ] Win-back campaign (automated push to lapsed members) — add after visit frequency analytics confirm lapse patterns
- [ ] Google Wallet card issuance — add when Android user complaints are received or before targeting regions with >70% Android share
- [ ] Advanced analytics (cohort retention, LTV estimates) — add when owners ask "is this working for me?"

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Pix cashback disbursement — requires financial infrastructure; build only after cashback reward type is proven
- [ ] Automated segmented campaigns (beyond birthday + win-back) — build when tenants have enough member data to segment meaningfully
- [ ] Multi-location support per tenant — build when a franchise or chain onboards
- [ ] Manager role permissions and audit log — build when teams > 1 manager per location
- [ ] Referral tracking mechanics — defer; organic referral via physical card is sufficient early

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Customer registration (name + phone) | HIGH | LOW | P1 |
| Apple Wallet card issuance | HIGH | HIGH | P1 |
| Manager sale logging | HIGH | MEDIUM | P1 |
| Points Engine (earn rules) | HIGH | MEDIUM | P1 |
| Rank system + multipliers | HIGH | MEDIUM | P1 |
| Reward redemption (free product) | HIGH | MEDIUM | P1 |
| Push notifications via Wallet update | HIGH | MEDIUM | P1 |
| Owner analytics (basic) | HIGH | MEDIUM | P1 |
| White-label branding | HIGH | MEDIUM | P1 |
| Point expiry configuration | MEDIUM | LOW | P1 |
| Cashback reward type | MEDIUM | MEDIUM | P2 |
| Progressive discount reward type | MEDIUM | LOW | P2 |
| Birthday rewards | MEDIUM | LOW | P2 |
| Win-back campaigns | MEDIUM | MEDIUM | P2 |
| Google Wallet card issuance | HIGH | HIGH | P2 |
| Advanced analytics (cohort/LTV) | MEDIUM | HIGH | P2 |
| Pix cashback disbursement | MEDIUM | HIGH | P3 |
| Multi-location management | LOW | HIGH | P3 |
| Manager audit log | LOW | MEDIUM | P3 |
| Gamification (badges, challenges) | LOW | HIGH | P3 — anti-feature |
| Branded customer mobile app | LOW | VERY HIGH | P3 — anti-feature |
| Coalition loyalty | LOW | VERY HIGH | P3 — anti-feature |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Stamp Me | Punchh (PAR) | Belly | REVISIT Approach |
|---------|----------|--------------|-------|-----------------|
| Customer app required | Yes | Yes | Yes (iPad kiosk) | No — Apple Wallet only |
| White-label | Yes | Yes (enterprise) | No | Yes — per tenant |
| Tier/rank system | Basic | Advanced | No | Configurable (3 tiers) |
| Point multipliers | No | Yes | No | Yes — per rank |
| Multiple reward types | Limited | Yes | Yes | Cashback + free product + progressive discount |
| Push notifications | Via app | Via app | Via email | Via Wallet pass update (no app) |
| POS integration | Manual | Deep API | iPad kiosk | Manual — intentionally no API |
| Analytics dashboard | Basic | Advanced | Basic | Configurable per owner |
| Google Wallet | No | Yes | No | v1.x |
| Brazil market fit | Low | Low | No | Native (Pix planned, PT-BR) |
| Target segment | SMB cafes | Enterprise QSR | SMB | SMB bars and restaurants |

---

## Sources

- [The Future of Restaurant Loyalty: Trends to Watch in 2026 — DoorDash Merchants](https://merchants.doordash.com/en-us/blog/future-of-restaurant-loyalty) — MEDIUM confidence
- [The Wallet Is the New Homepage — PAR Engagement / Punchh](https://punchh.com/blog/2025/12/14/the-wallet-is-the-new-homepage-why-apple-and-google-wallet-are-becoming-the-center-of-restaurant-loyalty/) — MEDIUM confidence
- [POS Loyalty Program for Restaurants: Complete Guide 2025 — Rezku](https://rezku.com/blog/pos-loyalty-program/) — MEDIUM confidence
- [Best Restaurant Loyalty Programs 2026 — EatApp](https://restaurant.eatapp.co/blog/best-restaurant-loyalty-apps-and-programs) — MEDIUM confidence
- [Best Loyalty Programs for Restaurants in 2025 — Restolabs](https://www.restolabs.com/blog/best-restaurant-loyalty-software-for-customer-retention) — MEDIUM confidence
- [Top 12 White Label Loyalty Program Vendors 2026 — White Label Wonder](https://whitelabelwonder.com/the-top-12-white-label-loyalty-program-app-vendors-for-2026/) — MEDIUM confidence (503 during fetch; referenced from search results)
- [How Some Restaurants Are Rethinking Loyalty by Ditching the App — Restaurant Technology News](https://restauranttechnologynews.com/2025/08/how-some-restaurants-are-rethinking-loyalty-by-ditching-the-app/) — MEDIUM confidence
- [Top 8 Loyalty Programs in Brazil — White Label Loyalty](https://whitelabel-loyalty.com/blog/loyalty/top-8-loyalty-programs-in-brazil/) — MEDIUM confidence
- [Brazil Loyalty Programs Market 2025 — GlobeNewswire](https://www.globenewswire.com/news-release/2025/09/09/3146640/28124/en/Brazil-Loyalty-Programs-Intelligence-Report-2025-Market-to-Reach-3-33-Billion-by-2029-Personalization-and-Coalition-Models-Drive-Success.html) — MEDIUM confidence
- [Understanding Push Notifications for Apple and Google Wallet Passes — PassKit](https://help.passkit.com/en/articles/11905171-understanding-push-notifications-for-apple-and-google-wallet-passes) — HIGH confidence (official PassKit documentation)
- [Loyalty Passes — Apple Developer](https://developer.apple.com/wallet/loyalty-passes/) — HIGH confidence (Apple official)
- [Restaurant Loyalty Programs: Why Restaurant Chains Are Revamping — Restaurant Business Online](https://www.restaurantbusinessonline.com/technology/why-so-many-restaurant-chains-are-revamping-their-loyalty-programs) — MEDIUM confidence

---
*Feature research for: Digital loyalty SaaS platform — Brazilian bars and restaurants*
*Researched: 2026-02-20*
