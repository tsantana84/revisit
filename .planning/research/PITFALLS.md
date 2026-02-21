# Pitfalls Research

**Domain:** Digital loyalty SaaS platform — white-label, multi-tenant, Apple Wallet integration
**Researched:** 2026-02-20
**Confidence:** HIGH (Apple Wallet / APNs: official docs verified) | MEDIUM (multi-tenant RLS, white-label patterns: multiple credible sources) | MEDIUM (UX patterns: industry research)

---

## Critical Pitfalls

Mistakes in this category cause rewrites, production incidents, or security breaches.

---

### Pitfall 1: APNs Push Updates Silently Break When the Pass Type Certificate Expires

**What goes wrong:**
Apple Wallet pass updates depend on APNs. The Pass Type ID Certificate used to both sign passes and send APNs push notifications has a 1-year validity. When it expires, push notifications stop being delivered — but silently. Passes already installed on devices simply stop updating. Points balances, tier changes, and promotions no longer reflect on the card. Neither Apple nor the device reports an error back to the server.

**Why it happens:**
Teams treat the certificate as a one-time setup artifact. There is no built-in Apple mechanism to alert the server operator that APNs delivery is failing. The failure mode looks identical to "user has not used the app recently." Developers only discover it when customers complain their points aren't updating.

**How to avoid:**
- Set a calendar reminder 60 days before certificate expiry to renew. Apple passes expire 1 year from issuance.
- Monitor APNs delivery receipts — implement a webhook or job that checks for APNs `410 Gone` responses (invalid token) and logs them. A sudden spike in 410s often precedes or coincides with certificate issues.
- Store the certificate expiry date in environment configuration as a first-class value (e.g., `PASS_CERT_EXPIRES=2026-03-15`) and surface it in an admin health-check endpoint.
- Rotate to token-based APNs authentication (`.p8` key) instead of certificate-based. Token-based keys do not expire and eliminate this entire failure class.

**Warning signs:**
- No pass updates received by any device for 24+ hours despite transactions being recorded in the DB.
- APNs push responses returning `TopicDisallowed` or `ExpiredProviderToken`.
- Customer support tickets saying "my points are not changing on my card."

**Phase to address:** Foundation / Apple Wallet integration phase. Design the renewal monitoring before any pass goes to production.

---

### Pitfall 2: Multi-Tenant Data Isolation Failure via Misconfigured Supabase RLS

**What goes wrong:**
One tenant's manager can query or modify another tenant's customer records, loyalty transactions, or pass data. This is not a theoretical risk — misconfigured RLS policies are the top reported cause of cross-tenant data leaks in Supabase-based multi-tenant apps.

**Why it happens:**
Three specific mistakes account for most incidents:
1. A new table is created in a migration and RLS is never enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is forgotten). Supabase's default is RLS disabled — every row is accessible via the API.
2. RLS is enabled but no policies are added — all queries return empty results silently (no error), which looks like a bug rather than a security issue, and developers disable RLS to "fix" it.
3. A USING clause is written as `USING (true)` or uses `user_metadata` claims (which are user-modifiable) instead of the tenant_id from a server-side JWT claim or profiles table.

**How to avoid:**
- Add a CI check that fails if any table in the public schema lacks RLS enabled. Script: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_tables WHERE relrowsecurity = true)`.
- Always derive `tenant_id` from a server-controlled JWT claim (using `auth.jwt() -> 'app_metadata' ->> 'tenant_id'`), never from `user_metadata` which the user can modify.
- Write integration tests that authenticate as Tenant A and attempt to read Tenant B's data — these must return empty results or 403, never Tenant B's rows.
- Add indexes on every `tenant_id` column used in RLS policies. Missing indexes cause RLS to perform sequential scans, which become unacceptably slow at scale.
- Test RLS from the client SDK, not the SQL Editor. The SQL Editor runs as the superuser and bypasses RLS entirely.

**Warning signs:**
- Any query that returns results across multiple `tenant_id` values when authenticated as a single tenant.
- A table created in a migration that has no corresponding RLS policy added in the same migration.
- Performance degradation on tenant-filtered queries (suggests missing index on `tenant_id`).

**Phase to address:** Foundation / database schema phase. Every table must have RLS enabled at creation. Never retrofit.

---

### Pitfall 3: WWDR Certificate Version Mismatch Prevents Pass Installation

**What goes wrong:**
Generated `.pkpass` files are cryptographically valid but iOS refuses to install them with no user-visible error. The pass simply does not open.

**Why it happens:**
Apple's passkit-generator (the dominant Node.js library) requires WWDR (Worldwide Developer Relations) Certificate G4 specifically. Certificates G2, G3, G5, and G6 cause validation failures. WWDR G1 expired on February 7, 2023 and is no longer usable. Many tutorials and older blog posts still reference G1 or G3.

Additionally, the `passTypeIdentifier` in `pass.json` must exactly match the Pass Type ID in the signing certificate, and the `teamIdentifier` must match the Team ID (`OU` field) in the certificate. A mismatch causes silent rejection.

**How to avoid:**
- Download WWDR G4 exclusively from Apple's certificate authority page. Store the exact URL in the project README.
- Write a startup validation that reads the cert and asserts: (a) `passTypeIdentifier` matches, (b) `teamIdentifier` matches, (c) cert is not expired. Fail fast on boot rather than at pass generation time.
- Store certificates as environment variables (PEM text), not file paths, to avoid path resolution errors in serverless environments.

**Warning signs:**
- `Invalid PEM formatted message` error from passkit-generator.
- Pass downloads successfully but iOS shows no add-to-wallet prompt.
- `PKZipArchiver: archive_entry with no path after sanitization encountered` — this is a serverless ZIP encoding issue; serve the `.pkpass` as a base64-decoded binary buffer, not a raw stream.

**Phase to address:** Apple Wallet integration phase. Validate cert chain in a test before building the full pass generation flow.

---

### Pitfall 4: Authentication Token Changed in Pass Update Breaks Existing Devices

**What goes wrong:**
Devices that installed a pass with the original `authenticationToken` can no longer authenticate update requests after the token is rotated. From the device's perspective, all subsequent update requests return 401. The pass stops updating permanently for those devices.

**Why it happens:**
Apple's design requires the `authenticationToken` in `pass.json` to remain constant for the lifetime of the pass. Because updates are not guaranteed (push notifications can be dropped, coalesced, or delayed), devices may still hold old pass versions with old tokens. If the server validates only against the current token, old devices are locked out.

**How to avoid:**
- Never rotate the `authenticationToken` after a pass is issued. Treat it as an immutable identifier.
- Store the original token in the database alongside the pass serial number. Always validate incoming device requests against this stored token, not a regenerated one.
- If a pass must be invalidated (e.g., account closure), mark it as voided server-side and let the device fetch the voided version rather than revoke the token.

**Warning signs:**
- A sudden drop in APNs push delivery success rate after a code change that touched pass generation.
- Device registrations (`POST /v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}`) returning 401 for previously registered devices.

**Phase to address:** Apple Wallet integration phase, specifically when designing the web service endpoints for pass updates.

---

### Pitfall 5: White-Label Branding Leak — REVISIT Brand Surfaces to End Customers

**What goes wrong:**
End customers (bar/restaurant patrons) see "REVISIT" in email footers, browser tab titles, error messages, APNs sender names, or pass issuer fields — breaking the white-label promise and undermining the venue's brand.

**Why it happens:**
Branding is treated as a theme variable (colors, logo) but dozens of other surfaces carry the platform brand by default: `<title>` tags, email `From:` headers, APNs `alert` text, `pass.json`'s `organizationName` field, Supabase auth emails, error pages, og:image metadata, and favicon. Each surface requires explicit tenant override, and teams underestimate how many surfaces exist.

**How to avoid:**
- Build a Branding Audit Checklist at the start of the project. Every surface that can display text or imagery gets a row. Each row maps to a tenant configuration field.
- The `organizationName` in `pass.json` must come from the tenant's brand config, not a platform default.
- Override Supabase Auth email templates per tenant (custom SMTP + templates) — Supabase sends auth emails using its own domain by default.
- Use a reverse proxy or Next.js middleware to enforce tenant context on every request. If no tenant is resolved, show a 404, not the platform homepage.
- Test by creating a test tenant with a unique brand name and auditing every pixel of every flow.

**Warning signs:**
- Any hardcoded string "REVISIT" in template files, email templates, or `pass.json` fields.
- Supabase auth emails arriving from `noreply@supabase.io` instead of the tenant's domain.
- Browser tab showing "REVISIT | Login" when accessed via tenant subdomain.

**Phase to address:** Foundation / white-label architecture phase. Define the tenant brand config schema before building any user-facing UI.

---

### Pitfall 6: Points Calculation Rounding Creates Accumulated Ledger Errors

**What goes wrong:**
Applying floating-point arithmetic to `sale_value × rate × rank_multiplier` produces rounding errors that accumulate across thousands of transactions. A customer's displayed balance diverges from their actual earned points. Disputes arise; customer trust is damaged.

**Why it happens:**
JavaScript's `number` type (IEEE 754 double) cannot represent many decimal fractions exactly. `0.1 + 0.2 !== 0.3` is the canonical example. When a loyalty rate is `0.1` points per BRL and a sale is `R$29.90`, the result `2.99` stored as a float accumulates error across thousands of rows. Multiplied across tiers and bonus events, balances diverge.

**How to avoid:**
- Store all monetary values and point balances as integers in the database (cents for currency, whole points for balances). Never store points as decimals.
- Define rounding rules explicitly and enforce them at the calculation layer: always round half-up, always round to the nearest whole point. Document this in code as a named function, not an inline expression.
- Use Postgres `NUMERIC` type (arbitrary precision) for intermediate calculations, not `FLOAT` or `DOUBLE PRECISION`.
- Write golden-path tests with known inputs and exact expected outputs. `sale=29.90 BRL, rate=0.1, rank_multiplier=1.5 → 4 points` (not 4.485 or 4.4849999...).

**Warning signs:**
- Any use of JavaScript `number` for point calculations without explicit rounding.
- Points balance in the UI differing by ±1 from what a customer manually calculated.
- Database column type `FLOAT` or `DOUBLE PRECISION` for points or currency.

**Phase to address:** Loyalty engine / points calculation phase. Define and test the rounding contract before any transaction processing is built.

---

### Pitfall 7: Vercel Serverless Read-Only File System Breaks pkpass Generation

**What goes wrong:**
Pass generation code that writes temporary files to disk (e.g., `fs.writeFileSync('/tmp/pass.pkpass', ...)`) works in local development but fails silently or throws `EROFS: read-only file system` on Vercel production.

**Why it happens:**
Vercel serverless functions run on a read-only filesystem except for `/tmp`. The `/tmp` directory is available but ephemeral and size-limited. Libraries that internally zip files and write to the process working directory will fail. Additionally, serving binary ZIP content (`.pkpass`) requires correct `Content-Type: application/vnd.apple.pkpass` and binary buffer response — returning a stream or a stringified buffer corrupts the file.

**How to avoid:**
- Ensure passkit-generator writes to `/tmp` or operates entirely in memory. Test pass generation in a Vercel preview deployment before production.
- Encode `.pkpass` output as a `Buffer` and return it directly. Do not convert to string. In Next.js API routes, use `res.setHeader('Content-Type', 'application/vnd.apple.pkpass')` and write the buffer.
- Keep pass generation logic in a dedicated API route, not a server action or middleware, to control the response binary handling explicitly.

**Warning signs:**
- Pass generation works locally but fails on Vercel with a 500 error.
- Downloaded `.pkpass` file cannot be opened on iOS (corrupted ZIP archive).
- `PKZipArchiver: archive_entry with no path` error in Vercel function logs.

**Phase to address:** Apple Wallet integration phase, specifically the server-side pass generation endpoint.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip RLS on internal/admin tables | Faster development | Any admin-scope breach exposes all tenants | Never |
| Hardcode tenant branding in components | Ships faster | Every new tenant requires code changes | Never |
| Use JavaScript `number` for points math | Simpler code | Ledger drift, customer disputes | Never |
| Share one APNs connection pool across tenants | Less infra | If one tenant's cert expires, debugging is harder | Never — isolate per tenant |
| Generate passes synchronously in the HTTP request | Simpler architecture | Timeouts on Vercel (default 10s limit), poor UX under load | MVP only, plan async queue early |
| Store pass signing certs as file paths in config | Easier local dev | Breaks on Vercel and any container rebuild | Never in production |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| APNs (Apple Push) | Using certificate-based auth with a `.p12` cert that expires annually | Use token-based auth with a `.p8` key (does not expire) |
| APNs | Sending rich payload in push notification body | Send empty `{}` payload only — device pulls pass data from your server |
| APNs | Pushing to all devices when a pass changes | Push only to devices registered for that specific pass serial number |
| passkit-generator | Using WWDR G1/G2/G3 certificate | Use WWDR G4 exclusively — only version accepted by current iOS |
| passkit-generator | Loading certs from file paths in serverless | Pass PEM text as environment variables; use in-memory cert loading |
| Supabase Auth | Relying on `user_metadata` in RLS policies | Use `app_metadata` (server-controlled) for tenant_id claims |
| Supabase Auth emails | Default Supabase email domain | Configure custom SMTP per tenant; override all email templates |
| Supabase Storage | Public bucket URLs exposing platform domain | Use signed URLs or a custom CDN domain; never expose `supabase.co` to end users |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No index on `tenant_id` in RLS-filtered tables | Queries slow down proportionally with total row count across all tenants | Index every `tenant_id` column at table creation | ~10K rows per table |
| Synchronous pass generation on every scan | Timeout errors under concurrent load; poor response time at busy restaurant POS | Generate passes async, cache signed pass per customer, regenerate only on data change | >5 concurrent scans/second |
| Fetching full customer list without pagination in manager panel | Manager panel hangs on large customer bases | Server-side pagination from the start; never load all rows | >500 customers per tenant |
| APNs push sent per-transaction (every sale triggers a push) | APNs rate limits triggered; notifications coalesced and lost | Batch pushes or debounce: push once after transaction settles, not per event | >100 transactions/minute across platform |
| Recalculating points balance from full transaction history on every request | Slow balance queries; DB load spikes | Store running balance in `customers` table, update atomically with each transaction | >1000 transactions per customer |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| RLS policy using `USING (true)` or missing tenant_id filter | Cross-tenant data exposure — Tenant A reads Tenant B's customers and transactions | Policy must always filter by `tenant_id` derived from server-controlled JWT claim |
| Exposing the pass `authenticationToken` in client-side code or logs | Attacker can impersonate the device and manipulate pass update endpoints | Keep token server-side only; never log it; treat it as a secret |
| Generating predictable card numbers (sequential or timestamp-based) | Attacker guesses valid card numbers, earns points without purchasing | Use cryptographically random base + Luhn check digit; validate uniqueness in DB with a unique constraint |
| Admin manager endpoint without tenant scoping | A manager from one venue can access another venue's data by modifying request params | Every API endpoint must derive tenant from the authenticated session, never from a request parameter |
| Storing Apple Developer certificate private key in source control | Key compromise allows anyone to sign passes as your platform | Store in environment secrets (Vercel encrypted env vars); rotate immediately if leaked |
| Supabase service role key used in client-side code | Full database access bypasses all RLS | Service role key is server-only; anon key for client; never expose service role to browser |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Points shown with decimals (e.g., "4.85 pts") | Confuses customers; implies precision that doesn't exist | Always display whole points; round at calculation time |
| Unclear how many points are needed for next reward | Customers disengage when progress is invisible | Always show: current points / threshold, and how many visits until next tier |
| Complex sign-up flow (email + password + profile) during checkout | Customers abandon; manager queue builds up | Mobile number or QR scan as primary onboarding; collect email optionally later |
| Manager panel requires multiple taps to record a sale | Manager refuses to use it during rush hour | Primary action (record sale) must be ≤2 taps from app open |
| Push notification when customer hasn't earned anything new | Users disable notifications; APNs throttles platform | Only notify on meaningful events: reward earned, tier change, expiry warning |
| "REVISIT" visible anywhere in the customer-facing flow | Breaks venue's trust with their customers; violates white-label contract | Full white-label audit at every release; automated test that scans rendered HTML for platform name |
| No feedback after recording a transaction | Manager unsure if scan worked; double-records | Always show a clear success state with points awarded and new balance within 1 second |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Apple Wallet pass generation:** Pass installs on simulator — verify it installs on a real device AND that updates propagate via APNs push (simulator does not support APNs)
- [ ] **Pass updates:** Update endpoint returns 200 — verify device actually receives push notification AND fetches updated pass (end-to-end test on real device required)
- [ ] **Multi-tenant isolation:** All features work for Tenant A — verify Tenant A's authenticated session cannot access Tenant B's data (automated cross-tenant test required)
- [ ] **White-label branding:** Logo and colors are correct — verify email subjects, email From headers, browser tab title, APNs sender, pass `organizationName`, and error pages all use tenant brand
- [ ] **Points calculation:** Manual test shows correct points — verify rounding behavior with edge cases (sale = R$0.01, rate = 0.1; sale = R$9.99 with 1.5x multiplier)
- [ ] **Card number uniqueness:** Card numbers generate without errors — verify DB has a unique constraint AND application code handles collision retry
- [ ] **APNs certificate:** Push works today — verify cert expiry date is tracked, there is a renewal process, and APNs token-based auth is preferred over cert-based
- [ ] **Manager panel on mobile:** Works in Chrome desktop — test on an actual iPhone in portrait mode with one hand, in a dim-light environment, under time pressure
- [ ] **Supabase RLS:** Queries return correct data — verify tests run from the client SDK (not SQL Editor) and a service-role bypass does not exist in any API route

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| APNs cert expired, passes not updating | MEDIUM | Renew cert → re-sign new pass versions → push to all registered devices → verify propagation. Old passes that can't receive push will update on next manual open. |
| Cross-tenant data leak discovered | HIGH | Immediately revoke affected API keys → audit access logs for scope of breach → fix RLS policy → notify affected tenants → post-mortem. LGPD notification obligations apply. |
| Pass auth token rotated, devices locked out | HIGH | Cannot recover automatically — issue new passes to affected customers (new serial numbers), require them to re-add to wallet. Prevent with immutable token policy. |
| Points ledger drift discovered | MEDIUM | Freeze new transactions → audit transaction log → recalculate balances from transaction history (if stored) → apply corrections → resume. Requires an audit-grade transaction log from day one. |
| REVISIT brand leaked to customers | LOW | Patch and redeploy → notify affected tenant → audit all surfaces. Primarily a trust issue, not a technical one. |
| Card number collision (duplicate issued) | MEDIUM | Detect via unique constraint violation → retry with new random number → ensure retry logic exists in application code (do not surface DB error to user). |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| APNs cert expiry breaks pass updates | Apple Wallet integration | Health-check endpoint reports cert expiry; monitoring alert configured |
| Tenant isolation failure via RLS | Foundation / database schema | Automated cross-tenant access test passes from client SDK |
| WWDR cert version mismatch | Apple Wallet integration | Startup validation rejects wrong WWDR version; real-device installation test passes |
| Auth token rotation locks out devices | Apple Wallet integration | Integration test verifies token is immutable across pass updates |
| White-label branding leak | Foundation / white-label architecture | Automated scan finds zero "REVISIT" strings in rendered customer UI |
| Points calculation rounding error | Loyalty engine / points | Unit tests with known inputs and exact integer output pass |
| Vercel read-only filesystem breaks pass generation | Apple Wallet integration | Pass generation API route tested on Vercel preview env |
| Cross-tenant API access via manipulated params | Foundation / API design | Every API route scopes tenant from session, never from request body |
| Supabase storage URL exposes platform domain | Foundation / white-label architecture | Storage URLs use custom CDN domain; no `supabase.co` in rendered HTML |
| Floating point in DB columns | Foundation / database schema | Schema review confirms `NUMERIC` type for points; no `FLOAT` columns |

---

## Sources

- [Apple Wallet Developer Guide: Updating Passes](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Updating.html) — HIGH confidence (official Apple docs)
- [Apple: Create Wallet Identifiers and Certificates](https://developer.apple.com/help/account/capabilities/create-wallet-identifiers-and-certificates/) — HIGH confidence (official Apple docs)
- [Apple Developer Forums: APNs Push Notifications for Wallet Passes](https://developer.apple.com/forums/thread/758991) — MEDIUM confidence
- [passkit-generator: Troubleshooting Wiki](https://github.com/alexandercerutti/passkit-generator/wiki/Troubleshooting-(Self-help)) — MEDIUM confidence (library maintainer)
- [passkit-generator: Generating Certificates Wiki](https://github.com/alexandercerutti/passkit-generator/wiki/Generating-Certificates) — MEDIUM confidence (library maintainer)
- [Supabase Docs: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH confidence (official Supabase docs)
- [AntStack: Multi-Tenant Applications with RLS on Supabase](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — MEDIUM confidence (verified against official docs)
- [DesignRevision: Supabase Row Level Security Complete Guide 2026](https://designrevision.com/blog/supabase-row-level-security) — MEDIUM confidence
- [Vercel Knowledge Base: How to Use Files in Serverless Functions](https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions) — HIGH confidence (official Vercel docs)
- [Vercel Community: EROFS read-only file system](https://github.com/vercel/community/discussions/314) — MEDIUM confidence
- [Voucherify: Loyalty Programs UX and UI Best Practices](https://www.voucherify.io/blog/loyalty-programs-ux-and-ui-best-practices) — MEDIUM confidence
- [PassCreator: Apple Wallet Pass Updates and Push Notifications](https://www.passcreator.com/en/blog/apple-wallet-pass-updates-and-push-notifications-how-they-work-and-how-to-use-them) — MEDIUM confidence
- [PassKit Support: Understanding Push Notifications for Apple and Google Wallet Passes](https://help.passkit.com/en/articles/11905171-understanding-push-notifications-for-apple-and-google-wallet-passes) — MEDIUM confidence

---
*Pitfalls research for: REVISIT — white-label digital loyalty SaaS (bars and restaurants, Brazil)*
*Researched: 2026-02-20*
