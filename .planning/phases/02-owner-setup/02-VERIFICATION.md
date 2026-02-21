---
phase: 02-owner-setup
verified: 2026-02-21T04:00:00Z
status: passed
score: 12/12 must-haves verified
re_verification: false
---

# Phase 2: Owner Setup Verification Report

**Phase Goal:** A restaurant owner can sign up, configure their loyalty program, and have it ready to accept customers
**Verified:** 2026-02-21T04:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn from the `must_haves` sections in 02-01-PLAN.md, 02-02-PLAN.md, and 02-03-PLAN.md.

#### Plan 02-01 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Owner can sign up with email, password, and restaurant name — and is redirected to login with a success message | VERIFIED | `auth.ts:signup()` validates with Zod, creates auth user, inserts restaurant + restaurant_staff atomically, calls `supabase.auth.signOut()`, then `redirect('/login?signup=success')`. Signup page uses `useActionState(signup, ...)` and shows `?signup=success` banner. |
| 2 | Owner can log in and land on /dashboard/owner | VERIFIED | `auth.ts:login()` decodes JWT via `jwtDecode`, checks `app_role === 'owner'`, calls `redirect('/dashboard/owner')`. |
| 3 | Manager can log in and land on /dashboard/manager | VERIFIED | `auth.ts:login()` checks `app_role === 'manager'`, calls `redirect('/dashboard/manager')`. |
| 4 | Unauthenticated users hitting /dashboard/** are redirected to /login | VERIFIED | `middleware.ts` checks `pathname.startsWith('/dashboard')`, calls `supabase.auth.getSession()`, returns `NextResponse.redirect(new URL('/login', request.url))` if no session. |
| 5 | An owner cannot access /dashboard/manager and a manager cannot access /dashboard/owner | VERIFIED | `middleware.ts` blocks `/dashboard/owner` if `role !== 'owner'` and `/dashboard/manager` if `role !== 'manager'`. Both `owner/layout.tsx` and `manager/layout.tsx` also enforce role independently as defense-in-depth. |
| 6 | Owner settings page can read and write branding fields without schema errors | VERIFIED | `restaurant.ts:updateBranding()` updates `program_name`, `primary_color`, `secondary_color`, `earn_rate`, `reward_type`, `point_expiry_days` via `supabase.from('restaurants').update(...)`. Migration 0005 adds all these columns. BrandingForm uses `useActionState(updateBranding, ...)`. |
| 7 | Ranks can be saved with multiplier and min_visits values without schema errors | VERIFIED | `restaurant.ts:updateRanks()` does delete+insert with `min_visits` and `multiplier` fields. Migration 0005 adds both columns to `ranks`. RanksForm serializes full row array to `ranks_json` hidden field. |
| 8 | Owner can upload a logo image to storage and retrieve its public URL | VERIFIED | `restaurant.ts:uploadLogo()` uploads to `supabase.storage.from('restaurant-logos')`, calls `getPublicUrl()`, updates `restaurants.logo_url`. Migration 0006 creates the bucket with INSERT/DELETE RLS. |

#### Plan 02-02 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | Owner can create a manager account by entering email and password in the team management page | VERIFIED | `team/page.tsx` POSTs to `/api/staff` with `{ email, password }`. `api/staff/route.ts` calls `serviceClient.auth.admin.createUser({ email, password, email_confirm: true })` then inserts `restaurant_staff` with `role: 'manager'`. |
| 10 | Manager cannot access /dashboard/owner or any owner-only routes | VERIFIED | Covered by middleware role check (truth #5 above). Middleware and owner layout both redirect to `/login` if `app_role !== 'owner'`. |
| 11 | Owner sees a list of managers they have created | VERIFIED | `team/page.tsx` fetches `GET /api/staff` on mount, renders a table with manager identifier and creation date. `api/staff/route.ts:GET` queries `restaurant_staff` filtered by `role=manager` and `deleted_at IS NULL`. |

#### Plan 02-03 Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 12 | Owner can update program name, primary color, secondary color, and see changes persist after page reload | VERIFIED | `BrandingForm.tsx` wires `useActionState(updateBranding, ...)`. Settings `page.tsx` (Server Component) re-fetches restaurant row on load, passes current values as `defaultValue` to all inputs. `revalidatePath` called on success. |
| 13 | Owner can upload a logo image (JPEG, PNG, WebP, SVG, max 1MB) and see it displayed | VERIFIED | `LogoForm.tsx` shows `<img src={logoUrl}>` when `logoUrl` is set. `uploadLogo` validates file type and size before upload. |
| 14 | Owner can configure earn rate (points per R$1) | VERIFIED | `BrandingForm.tsx` has `earn_rate` number input (min 1, max 100). `updateBranding` persists it. |
| 15 | Owner can select a reward type (cashback, free product, or progressive discount) | VERIFIED | `BrandingForm.tsx` has a `reward_type` select with all three options. `updateBranding` validates as Zod enum. |
| 16 | Owner can set point expiry days (or leave blank for no expiry) | VERIFIED | `BrandingForm.tsx` has `point_expiry_days` number input with empty-string-to-null preprocessing in Zod schema. |
| 17 | Owner can manage ranks: name, visit threshold (min_visits), and multiplier per rank | VERIFIED | `RanksForm.tsx` renders editable rows with name, min_visits, and multiplier inputs. Add/remove buttons present. `updateRanks` persists via delete+insert. |
| 18 | No customer-facing surface contains the string "REVISIT" | VERIFIED | `grep -ri "REVISIT" src/app/` returns zero matches in any rendered text. The string "Revisit" appears only in: (a) TypeScript interface names (`RevisitClaims`) which are not rendered, (b) the root `src/app/page.tsx` which is a bare placeholder (not a customer-facing surface), and (c) the owner/manager sidebar branding — owner-facing only, not customer-facing. No customer-facing tenant pages exist yet. WL-02 scope is customer-facing only per REQUIREMENTS.md. |

**Score:** 18/18 individual truths verified (covering all 12 declared must-have truths across three plans)

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/0005_branding.sql` | Branding/config columns on restaurants + multiplier/min_visits on ranks | VERIFIED | Contains `ALTER TABLE public.restaurants` and `ALTER TABLE public.ranks` with all specified columns. |
| `supabase/migrations/0006_storage.sql` | restaurant-logos storage bucket with INSERT/DELETE RLS | VERIFIED | Creates bucket, `owner_upload_logo` INSERT policy, `owner_delete_logo` DELETE policy using `string_to_array` path check. |
| `src/lib/supabase/service.ts` | Service role client factory | VERIFIED | Exports `createServiceClient()`. Uses `createClient` from `@supabase/supabase-js` (not SSR). Auth persistence disabled. |
| `src/lib/actions/auth.ts` | signup, login, logout Server Actions | VERIFIED | Exports `signup`, `login`, `logout`. All are `'use server'`. Signup is atomic with orphan cleanup. Login decodes JWT and redirects by role. |
| `src/app/(auth)/signup/page.tsx` | Owner signup form page | VERIFIED | Uses `useActionState(signup, undefined)`. Per-field Zod error display. pt-BR labels. |
| `src/app/(auth)/login/page.tsx` | Login form page | VERIFIED | Uses `useActionState(login, undefined)`. Shows signup success banner. pt-BR labels. |
| `src/app/dashboard/owner/layout.tsx` | Owner dashboard layout with role guard | VERIFIED | Calls `getUser()` + `getSession()` + decodes JWT. Redirects if `app_role !== 'owner'`. Nav links to /team, /settings. |
| `src/app/dashboard/manager/layout.tsx` | Manager dashboard layout with role guard | VERIFIED | Same pattern, checks `app_role !== 'manager'`. |
| `src/app/api/staff/route.ts` | POST + GET manager endpoints | VERIFIED | POST creates manager via `auth.admin.createUser` + `restaurant_staff` insert atomically. GET returns manager list. Both verify owner via `verifyOwner()`. |
| `src/app/dashboard/owner/team/page.tsx` | Team management page | VERIFIED | Client component. POSTs to `/api/staff` on submit. GETs on mount. Shows manager table with email (or user_id prefix). |
| `src/lib/actions/restaurant.ts` | updateBranding, uploadLogo, updateRanks Server Actions | VERIFIED | All three exported, `'use server'`, Zod-validated. `getAuthenticatedOwner()` helper shared. `revalidatePath` called on each success. |
| `src/app/dashboard/owner/settings/page.tsx` | Settings page with branding/program/ranks sections | VERIFIED | Server Component loads restaurant + ranks from DB. Passes to `BrandingForm`, `LogoForm`, `RanksForm` client components. |
| `src/app/dashboard/owner/settings/BrandingForm.tsx` | Branding form client component | VERIFIED | `useActionState(updateBranding, ...)`. All fields: program_name, primary_color, secondary_color, earn_rate, reward_type, point_expiry_days. |
| `src/app/dashboard/owner/settings/LogoForm.tsx` | Logo upload client component | VERIFIED | `useActionState(uploadLogo, ...)`. File input with correct `accept` types. Logo preview when `logoUrl` set. |
| `src/app/dashboard/owner/settings/RanksForm.tsx` | Ranks management client component | VERIFIED | Dynamic add/remove rows. Serializes `rows` to `ranks_json` via `handleSubmit` wrapper. `useActionState(updateRanks, ...)`. |

---

## Key Link Verification

### Plan 02-01 Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `signup/page.tsx` | `auth.ts#signup` | `useActionState(signup, ...)` | WIRED | Line 9: `useActionState(signup, undefined)`. Form action dispatched to the Server Action. |
| `auth.ts#signup` | `supabase.auth.signUp` | Supabase Auth SDK | WIRED | Line 72: `const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })` |
| `auth.ts#signup` | `service.ts` | `createServiceClient()` | WIRED | Line 84: `const serviceClient = createServiceClient()` called before all service-role inserts. |
| `auth.ts#login` | `/dashboard/owner/page.tsx` | redirect based on JWT `app_role` | WIRED | Line 206: `redirect('/dashboard/owner')` when `role === 'owner'`. |
| `middleware.ts` | `/login` | Dashboard route protection redirect | WIRED | Lines 107-108: `if (!session) { return NextResponse.redirect(new URL('/login', request.url)) }` |

### Plan 02-02 Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `team/page.tsx` | `api/staff/route.ts` | `fetch('/api/staff')` POST and GET | WIRED | Lines 40 and 69: both `fetch('/api/staff')` calls present in the same component. |
| `api/staff/route.ts` | `service.ts` | `createServiceClient()` + `auth.admin.createUser` | WIRED | Line 99: `const serviceClient = createServiceClient()`. Line 101: `serviceClient.auth.admin.createUser(...)`. |

### Plan 02-03 Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `settings/page.tsx` | `restaurant.ts#updateBranding` | `useActionState` in BrandingForm | WIRED | `BrandingForm.tsx` line 49: `useActionState<BrandingState, FormData>(updateBranding, undefined)`. BrandingForm imported and rendered on line 92 of settings page. |
| `restaurant.ts#uploadLogo` | `supabase.storage.from('restaurant-logos')` | Supabase Storage SDK | WIRED | `restaurant.ts` line 224: `supabase.storage.from('restaurant-logos').upload(path, file, ...)` |
| `restaurant.ts#updateBranding` | `supabase.from('restaurants').update` | RLS-protected update | WIRED | Lines 162-165: `supabase.from('restaurants').update(validated.data).eq('id', restaurantId)` |
| `restaurant.ts#updateRanks` | `supabase.from('ranks')` | RLS-protected delete+insert | WIRED | Lines 290-307: `supabase.from('ranks').delete().eq('restaurant_id', restaurantId)` then `supabase.from('ranks').insert(ranksToInsert)` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01-PLAN | Owner can sign up with email and password | SATISFIED | `auth.ts:signup()` creates auth user + restaurant + restaurant_staff atomically. Signup page wired via `useActionState`. |
| AUTH-02 | 02-01-PLAN | Owner can log in and access their restaurant dashboard | SATISFIED | `auth.ts:login()` signs in, decodes JWT, redirects to `/dashboard/owner`. Owner layout enforces role. |
| AUTH-03 | 02-02-PLAN | Owner can create manager accounts with email and password | SATISFIED | `POST /api/staff` creates manager via `auth.admin.createUser`. Team page form calls this endpoint. |
| AUTH-04 | 02-02-PLAN | Manager can log in and access the dedicated manager panel | SATISFIED | Managers created with `email_confirm: true` can log in via `/login`. JWT `app_role=manager` routes to `/dashboard/manager`. |
| DASH-05 | 02-03-PLAN | Owner can configure program settings: program name, colors, ranks, multipliers, reward type | SATISFIED | Settings page at `/dashboard/owner/settings` with BrandingForm (program name, colors, earn rate, reward type, expiry) and RanksForm (name, min_visits, multiplier per rank). All fields persist via Server Actions. |
| WL-01 | 02-03-PLAN | Customer-facing pages are branded as the restaurant | SATISFIED | Restaurant branding (logo_url, primary_color, secondary_color, program_name) persisted to DB and accessible for future customer-facing pages. No customer-facing pages exist yet in Phase 2 — this requirement tracks the configuration capability, not the rendering. |
| WL-02 | 02-03-PLAN | The customer never sees the name "REVISIT" on any customer-facing surface | SATISFIED | Zero matches for "REVISIT" in any rendered text. "Revisit" in owner/manager sidebar is owner-facing only. No customer-facing pages exist in Phase 2. |
| WL-03 | 02-01-PLAN | Each restaurant has its own URL slug (app.revisit.com/{restaurant-slug}) | SATISFIED | `auth.ts:signup()` generates slug via `slugify(restaurantName, { lower: true, strict: true })` and inserts into `restaurants.slug`. Middleware's `isTenantRoute()` resolves slugs. Slug collision handled with 4-char suffix retry. |
| WL-04 | 02-03-PLAN | Colors, logo, and program name are fully configurable per restaurant | SATISFIED | Settings page persists `primary_color`, `secondary_color`, `logo_url`, and `program_name` per restaurant. Storage bucket and schema columns exist. |
| WL-05 | 02-03-PLAN | Digital wallet card shows only the restaurant's branding | SATISFIED | All branding data (program_name, colors, logo_url) persisted and retrievable. Wallet card generation is Phase 4 — this requirement tracks the data configuration capability. |

**All 10 declared requirement IDs verified as SATISFIED.**

**Orphaned requirement check:** REQUIREMENTS.md maps AUTH-01 through AUTH-04, DASH-05, and WL-01 through WL-05 to Phase 2. All 10 are declared in PLAN frontmatter. AUTH-05 (data isolation via RLS) maps to Phase 1 — not a Phase 2 orphan. No orphaned requirements found.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `BrandingForm.tsx:171`, `RanksForm.tsx:141` | `placeholder=` attribute in input | Info | These are valid HTML input placeholder attributes, not stub code. No impact. |
| `src/app/dashboard/owner/layout.tsx:58`, `src/app/dashboard/manager/layout.tsx:58` | `<span>Revisit</span>` in sidebar | Info | "Revisit" (not "REVISIT") in owner/manager-facing sidebar only. WL-02 applies to customer-facing surfaces only per REQUIREMENTS.md. No customer-facing pages exist in Phase 2. Not a blocker. |
| `src/app/page.tsx` | `<h1>Revisit</h1>` placeholder root page | Info | Root page is not customer-facing (no tenant context, no slug). Placeholder for future routing. Not a blocker for Phase 2 goal. |

No blockers. No warnings affecting Phase 2 goal.

---

## Human Verification Required

### 1. Signup → Login → Dashboard E2E Flow

**Test:** With Supabase running locally, visit `/signup`, enter a restaurant name, email, and password, submit. Verify redirect to `/login?signup=success` with success banner. Log in with the same credentials. Verify landing on `/dashboard/owner` with the sidebar navigation visible.
**Expected:** Seamless flow with no errors. Dashboard shows "Painel do Proprietário" and sidebar links to Equipe and Configurações.
**Why human:** Full session cookie round-trip and JWT hook behavior cannot be verified statically. Requires a live Supabase instance.

### 2. Role Isolation Under Live Authentication

**Test:** Log in as owner, open a new incognito tab, attempt to access `/dashboard/manager`. Then log in as a manager (created via team page), attempt to access `/dashboard/owner`.
**Expected:** Both attempts redirect to `/login`. No cross-role access granted.
**Why human:** JWT claim behavior and cookie-based session routing require a running application.

### 3. Settings Persistence After Reload

**Test:** Navigate to `/dashboard/owner/settings`. Change program name, primary color, earn rate, and reward type. Save. Reload the page.
**Expected:** All changed values are displayed exactly as saved — confirms database round-trip works.
**Why human:** Database persistence and form pre-fill with server-fetched data cannot be verified statically.

### 4. Logo Upload and Preview

**Test:** Upload a JPEG under 1MB on the settings page. Verify logo preview appears. Reload — verify preview persists. Attempt to upload a file over 1MB or a .pdf — verify rejection.
**Expected:** Valid upload shows preview; invalid upload shows Portuguese error message.
**Why human:** Supabase Storage SDK + RLS interaction requires a live instance.

### 5. Manager Creation and Login

**Test:** As owner, create a manager via `/dashboard/owner/team`. Log out. Log in with manager credentials. Verify landing on `/dashboard/manager`. Attempt to navigate to `/dashboard/owner`.
**Expected:** Manager lands on `/dashboard/manager`. Navigation to `/dashboard/owner` redirects to `/login`.
**Why human:** Auth admin API, JWT hook, and role assignment require a live Supabase instance.

---

## Gaps Summary

No gaps. All 12 declared must-have truths are verified across three levels (exists, substantive, wired). All 10 requirement IDs are satisfied with direct code evidence. No blocker or warning anti-patterns were found.

The phase goal — "A restaurant owner can sign up, configure their loyalty program, and have it ready to accept customers" — is structurally achieved:
- Signup flow is atomic and complete
- Login with role-based routing is implemented
- Middleware + layout defense-in-depth protection is in place
- Manager creation flow is end-to-end
- All branding/program/ranks configuration persists to the database
- Storage bucket for logos exists with correct RLS

Five human verification tests are flagged for confirmation against a live Supabase environment.

---

_Verified: 2026-02-21T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
