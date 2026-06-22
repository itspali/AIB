# App Console — Implementation Phases

Internal reference for building the **App Console** (`/console`): the private surface where AIB operators manage tenants, signups, groups, auth, and platform settings.

---

## Purpose & scope

| Surface | Route | Audience | Access model |
|---------|-------|----------|--------------|
| **App Console** | `/console` | AIB internal team only | `app_console_operators` + server-side service role |
| **Tenant ERP** | `/dashboard`, modules | Customer org | JWT `tenant_id` + RLS |
| **Tenant settings** | `/settings` | Customer admins | Same as tenant ERP |
| **Supplier portal** | `/portal` | External suppliers | Portal auth (separate) |

**Principles**

- Console manages *accounts and the platform*; tenants manage *their business*.
- All cross-tenant reads/writes use `createAdminClient()` on the server only — never from the browser.
- Every mutating action writes to `app_console_audit_log`.
- Impersonation defaults to **read-only**.
- Console UI reuses the AIB design system via **`ConsoleShell`** — see **UI & dashboard design**.
- Console operators authenticate with **email + password + TOTP (authenticator app)** in production — see **Authentication & operators**.

---

## Architecture summary

```
Browser → Next.js Server Action / RSC
       → requireConsoleAccess()
       → createAdminClient() (service role)
       → PostgreSQL (+ audit log)
```

Tenant routes remain unchanged: `createClient()` + JWT `app_metadata.tenant_id` + RLS.

---

## Authentication & operators

Console access uses **two layers**: Supabase Auth (identity) and `app_console_operators` (authorization). These are separate from tenant RBAC (`OWNER`, `ADMIN`, `MANAGER`, `STAFF`).

### Identity vs authorization

| Layer | Table / system | Question answered |
|-------|----------------|-------------------|
| **Identity** | `auth.users` + Supabase session JWT | Who is logged in? |
| **Console authorization** | `app_console_operators` | May this user enter `/console`? |
| **Console permissions** | `app_console_operators.role` | What may they do inside the console? |
| **Tenant authorization** | JWT `app_metadata.tenant_id` + `users.role` | What may they do in the ERP? |

A tenant `ADMIN` is **not** a console user unless they also have an active row in `app_console_operators`.

### Console users (`app_console_operators`)

Each console operator is a normal Supabase Auth user linked by `user_id`:

```
auth.users  →  app_console_operators  →  app_console_role (VIEWER | OPERATOR | ADMIN)
```

- Operators may or may not have `tenant_id` in JWT (e.g. internal testers with a workspace).
- Console access does **not** require `tenant_id`.
- No self-registration into the console — operators are granted by an existing ADMIN or seeded at bootstrap.

**Bootstrap (first operators)**

1. Create the user in Supabase Auth (or use an existing account).
2. Insert into `app_console_operators` via migration or Supabase SQL Editor:

```sql
INSERT INTO public.app_console_operators (user_id, email, role, notes)
VALUES (
  '<auth-users-uuid>',
  'you@yourcompany.com',
  'ADMIN',
  'Bootstrap operator'
);
```

3. Production: maintain **at least two** active `ADMIN` operators (dev/staging may seed one).

**MFA at bootstrap**

After first login, bootstrap ADMIN must enroll TOTP before using `/console` in production (or set `APP_CONSOLE_MFA_OPTIONAL=true` locally only).

### Authentication flow (v1)

Shared login with the tenant app — no separate console password system in v1.

1. User signs in at `/login` (Supabase Auth, session cookie).
2. User navigates to `/console`.
3. Middleware: require valid JWT; **do not** require `tenant_id` on `/console` routes.
4. Server (`requireConsoleAccess`): verify JWT via `getClaims()`, then load active operator row via service role.
5. If no active operator → **403 Access denied**.

Optional later: `/console/login` redirecting to the same Supabase flow with `?next=/console`. The login page must honor a safe `next` query param after successful auth (including MFA) — see Appendix G.

### Multi-factor authentication (TOTP / authenticator apps)

Console operators **must** be able to sign in with **authenticator apps** (TOTP) in addition to email and password. This uses **Supabase Auth MFA** — compatible with Google Authenticator, Microsoft Authenticator, Authy, 1Password, Bitwarden, and any RFC 6238 TOTP app.

**Policy (production)**

| Operator role | MFA for `/console` |
|---------------|-------------------|
| **ADMIN** | Required |
| **OPERATOR** | Required |
| **VIEWER** | Required in production; optional in local dev when `APP_CONSOLE_MFA_OPTIONAL=true` |

Password-only sessions (**AAL1**) are **not** sufficient for console access when MFA is required. Operators need **AAL2** (MFA verified in the current session).

**Login flow**

```
1. Operator → /login?next=/console
2. Email + password → Supabase signInWithPassword
3. If user has enrolled TOTP factor(s):
     → MFA challenge screen (6-digit code from authenticator app)
     → supabase.auth.mfa.challengeAndVerify(...)
4. Session upgraded to AAL2
5. requireConsoleAccess(): operator row active AND (AAL2 OR MFA not required for env)
6. Redirect to /console (or safe `next` path)
```

**Enrollment flow (first-time setup)**

- Route: `/console/settings/security` (Phase 0/4) or shared `/settings/security` for operators
- Steps:
  1. `supabase.auth.mfa.enroll({ factorType: 'totp' })` → QR code + manual secret
  2. Operator scans QR in authenticator app
  3. Verify with one TOTP code → factor status `verified`
- Show recovery guidance: store backup codes if Supabase/project enables them; document Supabase Dashboard factor reset for break-glass

**Enforcement layers**

| Layer | Check |
|-------|--------|
| Middleware | `/console/*`: if operator + `console_mfa_required` + session AAL1 → redirect `/login/mfa-challenge?next=...` |
| `requireConsoleAccess()` | Reject with clear error if MFA required but JWT not AAL2 |
| `platform_config` | `console_mfa_required` (boolean, default `true` in production) |
| `app_console_operators` | Optional column `mfa_enforced BOOLEAN DEFAULT TRUE` per operator (override for break-glass VIEWER only) |

**JWT / session**

Use Supabase `getAuthenticatorAssuranceLevel()` (client) or read `aal` from verified claims (server) after MFA step. Do not cache MFA satisfaction in a custom cookie — rely on Supabase session.

**UI components (expected)**

```
apps/web/app/login/mfa-challenge/page.tsx    # TOTP entry after password
apps/web/components/auth/mfa-challenge-form.tsx
apps/web/app/console/settings/security/page.tsx   # enroll / list factors
apps/web/lib/auth/mfa.ts                     # enroll, verify, AAL helpers
```

**Audit**

- Log `MFA_ENROLL`, `MFA_VERIFY_SUCCESS`, `MFA_VERIFY_FAILED` (optional `app_console_action` values or auth audit only)
- Failed MFA attempts: rate-limit UI; no sensitive error leakage

**Break-glass**

- Lost authenticator device: Supabase Dashboard → Auth → user → remove MFA factors (project owner), then operator re-enrolls on next console login
- Document in operator runbook; never bypass MFA via service role for browser sessions

**Supabase project settings**

- Enable TOTP MFA in Supabase Dashboard → Authentication → MFA (if not already on)
- Confirm project allows `aal2` sessions for enrolled users

**JWT `app_metadata` (optional cache only)**

May include `app_console: true` or `app_console_role` for fast-path checks. **Source of truth remains `app_console_operators`** so revoke takes effect without waiting for token refresh.

### Console roles & permissions

Use **`ADMIN`** in code and UI — not “superadmin” — to avoid confusion with tenant `ADMIN`.

| Role | Permissions |
|------|-------------|
| **VIEWER** | Read all console pages: tenants, signup pipeline, groups, audit, plans, subscriptions |
| **OPERATOR** | VIEWER + suspend/reactivate tenants, signup recovery, user deactivate, force onboarding, trial extend/convert/end, assign/change plan |
| **ADMIN** | OPERATOR + grant/revoke console operators, platform config, subscription plan CRUD, impersonation write (if enabled) |

**Enforcement**

| Layer | Check |
|-------|--------|
| Layout / pages | `requireConsoleAccess("VIEWER")` minimum |
| Server actions | `requireConsoleAccess("OPERATOR")` or `"ADMIN"` per action |
| Database | Console tables: RLS enabled, no policies for `authenticated` / `anon`; cross-tenant data via service role only |

**ADMIN rules (Phase 4)**

- Grant/revoke operators via `/console/settings/admins` — ADMIN only, audited.
- Cannot revoke the **last** active `ADMIN`.
- Prefer granting `VIEWER` or `OPERATOR` over `ADMIN` for day-to-day support.

### Request flow

```
User → /login → Supabase Auth (session JWT)
     → GET /console
     → Middleware: JWT valid? (/console skips tenant_id requirement)
     → requireConsoleAccess(): user_id in app_console_operators?
         ├─ yes → render console (role gates actions)
         └─ no  → 403
```

### Login backup & break-glass

Recovery when operators cannot access the console UI.

**Tier 1 — Normal**

| Scenario | Recovery |
|----------|----------|
| Forgot password | Supabase password reset on `/login` |
| Operator deactivated by mistake | Another ADMIN reactivates via `/console/settings/admins` |
| Need read-only access | Grant `VIEWER` to teammate |

**Tier 2 — Console UI unavailable, Supabase accessible**

Use **Supabase Dashboard → SQL Editor** (project owner access):

```sql
-- Reactivate operator
UPDATE public.app_console_operators
SET is_active = TRUE, revoked_at = NULL, role = 'ADMIN'
WHERE email = 'you@yourcompany.com';

-- Or insert bootstrap operator (replace UUID and email)
INSERT INTO public.app_console_operators (user_id, email, role, notes)
VALUES ('<auth-users-uuid>', 'you@yourcompany.com', 'ADMIN', 'Break-glass grant');
```

Keep a secure internal **runbook** with these statements and operator UUIDs.

**Tier 3 — Optional break-glass config**

`platform_config` key `break_glass_emails` (string array) plus env `APP_CONSOLE_BREAK_GLASS=true` for emergency VIEWER or one-time ADMIN — use sparingly; always audit. Not required for v1.

**Tier 4 — Auth or platform failure**

| Scenario | Recovery |
|----------|----------|
| Supabase Auth outage | Wait for restore; no app login works |
| Lost Supabase org / project access | Supabase account recovery via org owner |
| Lost `SUPABASE_SERVICE_ROLE_KEY` | Regenerate in Supabase Dashboard; update Vercel server env |

The service role key is **not** a user login — it bypasses RLS for server-side ops only. Never expose it to the browser.

### Security recommendations

- [ ] Seed 2+ bootstrap `ADMIN` operators before production (1 acceptable for local dev only)
- [ ] **Require TOTP (authenticator app) for ADMIN and OPERATOR console access in production**
- [ ] Enable MFA in Supabase project; verify enrollment + challenge flows before go-live
- [ ] Restrict operator grants to company email domain (policy, enforced at grant time)
- [ ] Test: tenant `ADMIN` without operator row → cannot access `/console`
- [ ] Test: operator without `tenant_id` → can access `/console`
- [ ] Test: revoke operator → denied on next request
- [ ] Optional: IP allowlist on `/console` in Vercel middleware for production

### Related implementation (by phase)

| Concern | Phase |
|---------|-------|
| `app_console_operators` table + seed | Phase 0 |
| `requireConsoleAccess()` + middleware `/console` bypass | Phase 0 |
| **MFA enrollment + challenge (TOTP / authenticator apps)** | Phase 0 |
| Operator management UI | Phase 4 |
| Impersonation sessions (separate from operator auth) | Phase 3 |

---

## UI & dashboard design

The App Console must feel **sophisticated, modern, and intuitive** while reusing the existing AIB design system — not a separate CSS stack or chart-heavy admin template.

**Source of truth:** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md). All buttons, tables, badges, drawers, and layout tokens come from `@/components/ui/*` and established dashboard patterns. Raw unstyled HTML is prohibited (per `.cursorrules`).

### Strategy: same design language, different product skin

| Tenant ERP | App Console |
|------------|-------------|
| `DashboardShell` + module rail | **`ConsoleShell`** + ops nav |
| “Command Hub” — run the business | **“Control Plane”** — run the platform |
| Green “Live sync” status pills | Amber **“Internal · App Console”** strip |
| Tenant-scoped KPIs | Cross-tenant funnel, queues, platform health |

Do **not** mount console routes under `DashboardShell`. Build a dedicated `ConsoleShell` with ops navigation only.

### Console shell (`ConsoleShell`)

```
┌─────────────────────────────────────────────────────────────┐
│ Top strip (h-16): Console mark · App Console · ⌘K · user    │
│ Amber internal banner: "App Console · Internal"               │
├──────────┬──────────────────────────────────────────────────┤
│ Ops nav  │  Canvas (scroll) — overview / lists / detail    │
│ w-56     │                                                   │
│ Overview │                                                   │
│ Tenants  │                                                   │
│ Signups  │                                                   │
│ Trials   │  (Phase 5)                                        │
│ Plans    │  (Phase 5)                                        │
│ Groups   │                                                   │
│ Audit    │                                                   │
│ Settings │                                                   │
└──────────┴──────────────────────────────────────────────────┘
```

**Visual identity (instant “internal ops”)**

- Persistent amber strip: `border-amber-500/30 bg-amber-500/5` — *App Console · Internal*
- Console logo mark: distinct gradient from tenant org tile (e.g. violet/slate vs emerald)
- Operator role badge in header: `VIEWER` / `OPERATOR` / `ADMIN`
- “Exit to ERP” link in user menu when operator has a tenant workspace

Reuse top-strip patterns from `apps/web/components/layout/top-utility-strip.tsx`: `h-16`, `backdrop-blur-xl`, omnibar slot.

**Files (expected)**

```
apps/web/components/console/console-shell.tsx
apps/web/components/console/console-top-strip.tsx
apps/web/components/console/console-nav.tsx
apps/web/app/console/layout.tsx          # wraps ConsoleShell
```

### Overview dashboard (`/console`)

Adapt tenant `CommandHubHeader` → **`ConsoleHubHeader`**.

**Hero band**

- Title: **Control Plane** (subtitle: platform health in one line)
- Clickable pills: `X tenants live` · `Y trials expiring` · `Z signups stuck`
- Optional: deploy / migration version from env or `platform_config`

**KPI row (4–6 cards)**

Reuse `MetricCard` + `HubPanel` from `apps/web/components/dashboard/` with click-through `href`:

| Card | Accent | Links to |
|------|--------|----------|
| Active tenants | emerald | `/console/tenants?status=ACTIVE` |
| On trial | amber | `/console/trials` |
| Signups (7d) | cyan | `/console/signups` |
| Stuck onboarding | violet | `/console/signups?issue=B` |
| Past due | amber | `/console/subscriptions?status=PAST_DUE` |
| MRR | cyan | `/console/subscriptions` |

Add `MetricSparkline` when time-series signup data is available.

**Signup funnel bar (`SignupFunnelBar`)**

Horizontal step funnel — primary “modern SaaS ops” element on the home page:

```
Registered → Verified → Provisioned → Live → Trial → Paying
```

- Each step: count + % conversion from previous step
- Click step → `/console/signups?stage=...`
- Red indicator on step when stuck count > 0

**Action queues (below fold, two columns on `lg+`)**

1. **Needs attention** — top stuck signups (buckets A/B/C), trials expiring in 7d, suspended tenants
2. **Recent activity** — tail of `app_console_audit_log`

Each row: entity name, issue label, primary action (“Retry provision”, “Extend trial”).

### List pages (tenants, signups, subscriptions)

Follow **Items Master / ListModuleShell** pattern from `DESIGN_SYSTEM.md` §3:

- Full-width canvas, filter toolbar, paginated table (default 50 rows)
- Row click → **right drawer** quick peek (`RightDrawer`); “Open full record →” for detail page
- Bulk actions only where explicitly required (v1: row actions via ⋮ menu)

**Signup pipeline table columns**

| Column | UI treatment |
|--------|----------------|
| Company + email | Primary line + muted email |
| Pipeline stage | Colored `Badge` (see status vocabulary) |
| Account status | `TRIAL` amber, `ACTIVE` emerald, `SUSPENDED` red |
| Onboarding | Mini stepper (5 `tenant_onboarding_status` steps) |
| Issue | None, or `A`/`B`/`C` chip with tooltip |
| Plan / trial end | Phase 5; “3d left” in amber when soon |
| Actions | ⋮ menu: View, Retry, Confirm email, Suspend |

**Toolbar:** search (name, email, `ORG-XXXXXX`), stage filter, status filter, date range, “Issues only” toggle.

### Tenant detail (`/console/tenants/[tenantId]`)

Shadcn `Tabs` — avoid one endless scroll:

| Tab | Content |
|-----|---------|
| Overview | Profile + lifecycle timeline + quick actions |
| People | Users / memberships table |
| Billing | Plan, trial, Stripe links (Phase 5) |
| Health | KPI cards: items, POs, locations (head counts) |
| Activity | Audit log filtered to tenant |

**Lifecycle timeline (`LifecycleTimeline`)**

Vertical timeline from `onboarding_status` + derived signals (has locations, finance gate complete).

**Action panel**

Sticky right column (desktop) or sticky footer (mobile): Suspend, Extend trial, Impersonate, View in ERP. Destructive actions → `AlertDialog` + required **reason** textarea.

### Status badge vocabulary

Centralize in `apps/web/lib/console/status-badges.ts` — same mapping on every page:

| Status | Color family |
|--------|----------------|
| `TRIAL` / `TRIALING` | amber |
| `ACTIVE` / `LIVE` | emerald |
| `PAST_DUE` | orange |
| `SUSPENDED` / `CHURNED` | destructive |
| In-progress pipeline stages | muted / slate |

### High-impact UX patterns

| Pattern | Purpose |
|---------|---------|
| **Global search (⌘K)** | Search tenants by name, email, `ORG-`/`GRP-` codes; jump to “Signups stuck”, “Trials expiring”; recent tenants |
| **MFA challenge UI** | 6-digit TOTP input with autofocus, paste support, clear errors (Phase 0) |
| **Peek drawer** | Row click → drawer with key fields, badges, last 3 audit events, primary actions |
| **Skeleton loading** | Reuse `dashboard-skeletons.tsx` patterns for KPI row and tables |
| **Empty states** | “All clear” with success tone when queues empty — not blank tables |
| **Confirmations that teach** | Destructive dialogs explain impact + audit logging |
| **Impersonation banner** | Full-width amber bar above tenant shell when impersonating (Phase 3) |

### Component reuse map

| Console need | Reuse from codebase |
|--------------|---------------------|
| KPI cards | `MetricCard`, `HubPanel`, `MetricSparkline` |
| Hero header | Pattern from `command-hub-header.tsx` |
| Section headings | `HubSectionHeading` |
| Lists | `ListModuleShell`, list table chrome (Items Master) |
| Drawer peek | `RightDrawer` |
| Primitives | `@/components/ui/*` (Button, Badge, Tabs, AlertDialog, …) |
| Settings sub-landings | `ModuleOverview` |
| Skeletons | `dashboard-skeletons.tsx` |

**Console-specific components (new)**

```
apps/web/components/console/
  console-shell.tsx
  console-hub-header.tsx
  signup-funnel-bar.tsx
  pipeline-stage-badge.tsx
  onboarding-stepper.tsx
  lifecycle-timeline.tsx
  tenant-peek-drawer.tsx
  action-queue-panel.tsx
  console-omnibar.tsx          # ⌘K (Phase 1+)
```

### What to avoid

- Separate chart library or admin template CSS — inconsistent with ERP, slow to ship
- Reusing tenant `DashboardShell` — wrong nav and mental model
- Tables with 15+ visible columns — use drawer + tabs instead
- Modals for every interaction — drawer for peek, dialog only for destructive confirm
- Building Phase 5 billing UI before Phase 1 signup pipeline + funnel

### UI build order (within phases)

1. `ConsoleShell` + nav + internal banner (Phase 0)
2. Overview: `ConsoleHubHeader` + KPI cards + `SignupFunnelBar` (Phase 1)
3. Tenant directory: table + filters + peek drawer (Phase 1)
4. Signup pipeline unified table (Phase 1)
5. Tenant detail tabs + action panel (Phase 1–2)
6. Trials / plans / audit pages (Phases 4–5)
7. Console omnibar ⌘K (Phase 1 polish or Phase 2)

### UI acceptance criteria

- [ ] Console visually distinct from tenant ERP (amber internal strip, separate shell)
- [ ] Overview KPI cards link to filtered list pages
- [ ] Signup funnel bar clickable; stages match pipeline query logic
- [ ] List row opens peek drawer; full detail available without losing list context
- [ ] Status badges consistent across tenants, signups, subscriptions
- [ ] Destructive actions require reason + use `AlertDialog`
- [ ] Loading skeletons on overview and list pages
- [ ] All interactive elements use UI kit — no raw unstyled controls
- [ ] Responsive: usable on tablet; mobile supported but ops-primary is desktop

---

## Phase overview

| Phase | Name | Goal | Est. effort |
|-------|------|------|-------------|
| **0** | Foundation | Secure shell; only operators can enter | 0.5–1 day |
| **1** | Read-only ops | See and diagnose all tenants/signups | 2–3 days |
| **2** | Lifecycle controls | Fix and control tenant accounts | 2–3 days |
| **3** | Impersonation | View tenant UI safely as support | 1–2 days |
| **4** | Platform maturity | Global knobs, internal admin management | 1–2 days |
| **5** | Billing, plans & trials | Subscription catalog, signup funnel, trial ops | 3–5 days |

**Phases 0–4 (App Console v1):** ~10–15 working days for one developer.

**Phases 0–5 (App Console v1 + commercial ops):** ~13–20 working days. Phases are logical groupings, not mandatory separate releases.

---

## Phase 0 — Foundation

### Goal

Establish secure access, database primitives, and a console shell. No tenant management features yet beyond proving the gate works.

### Deliverables

**Database (single migration)**

Full column definitions: **Appendix A**. Summary:

- Enums: `app_console_role`, `app_console_action` (full list in Appendix A)
- Tables:
  - `app_console_operators` (includes `is_active`, `revoked_at`, `mfa_enforced`, …)
  - `app_console_audit_log`
  - `app_console_impersonation_sessions` (schema only; used in Phase 3)
  - `platform_config` (schema only; used in Phase 4; seed `console_mfa_required`)
- Private helpers: `private.is_app_console_operator()`, `private.app_console_role()`, `private.assert_app_console_role()`
- RLS enabled on console tables with **no** policies for `authenticated` / `anon`
- Seed at least one operator row for dev; **two** `ADMIN` rows for production

**Application**

- `apps/web/lib/console/require-console.ts` — mirrors `requireTenantId`; checks operator row + MFA/AAL when required
- `apps/web/lib/console/audit.ts` — `logConsoleAction()` helper
- `apps/web/lib/console/types.ts`
- `apps/web/lib/auth/mfa.ts` — TOTP enroll, verify, AAL helpers (Supabase MFA API)
- `apps/web/app/login/mfa-challenge/page.tsx` — authenticator code entry after password
- `apps/web/app/console/unauthorized/page.tsx` — not an operator (403 UX)
- `apps/web/app/console/layout.tsx` — distinct chrome, **`ConsoleShell`** (see UI & dashboard design)
- `apps/web/app/console/page.tsx` — placeholder overview

**Middleware**

- Update `apps/web/lib/supabase/middleware.ts`:
  - `/console` routes require auth but **do not** require `tenant_id`
  - Exclude `/console` from onboarding redirects and `aib-onboarded` logic
  - If operator session is AAL1 and MFA required → redirect `/login/mfa-challenge?next=...`

**Root layout / route groups**

Use a **`(console)` route group** (or pathname guard in root layout) so `getAppShellBootstrap()` does not run tenant onboarding queries when `tenantId` is null. Console layout wraps `ConsoleShell` only — no `DashboardShell`, no tenant `OnboardingProvider` assumptions.

**Environment variables**

See **Appendix E** (`SUPABASE_SERVICE_ROLE_KEY`, `CONSOLE_IMPERSONATION_SECRET`, `APP_CONSOLE_MFA_OPTIONAL`, …).

### Acceptance criteria

- [ ] Operator can open `/console` while logged in (with AAL2 when MFA required)
- [ ] Non-operator gets `/console/unauthorized` or clear 403
- [ ] Unauthenticated user redirected to `/login?next=/console`
- [ ] Console works without `tenant_id` in JWT
- [ ] **Operator with MFA enrolled must complete TOTP (authenticator app) before `/console` access**
- [ ] **MFA enrollment available at `/console/settings/security` (or documented interim path)**
- [ ] Service role key mismatch surfaces same error pattern as signup (`getServiceRoleKeyMismatch()`)
- [ ] Audit log table accepts test insert from server action

### Dependencies

- `SUPABASE_SERVICE_ROLE_KEY` in server env (already used by `apps/web/lib/supabase/admin.ts`)
- Bootstrap operator `auth.users.id` known for seed

### Files (expected)

```
supabase/migrations/YYYYMMDD_app_console_foundation.sql
apps/web/lib/console/require-console.ts
apps/web/lib/console/audit.ts
apps/web/lib/console/types.ts
apps/web/lib/auth/mfa.ts
apps/web/app/login/mfa-challenge/page.tsx
apps/web/components/auth/mfa-challenge-form.tsx
apps/web/app/console/unauthorized/page.tsx
apps/web/app/console/settings/security/page.tsx
apps/web/components/console/console-shell.tsx
apps/web/components/console/console-top-strip.tsx
apps/web/components/console/console-nav.tsx
apps/web/app/console/layout.tsx
apps/web/app/console/page.tsx
apps/web/lib/supabase/middleware.ts          (modify)
apps/web/app/login/login-client.tsx          (modify: safe `next` redirect)
packages/database/schema.sql                 (sync after migration — see Cross-cutting)
```

---

## Phase 1 — Read-only operations

### Goal

Full visibility into tenants, groups, signups, and auth users — without mutating anything except audit reads.

### Deliverables

**Overview dashboard (`/console`)**

See **UI & dashboard design** for layout. Phase 1 delivers `ConsoleHubHeader`, KPI cards, `SignupFunnelBar`, and action queues.

| Metric | Source |
|--------|--------|
| Total / active / trial / suspended tenants | `tenants.status`, `tenants.is_active` |
| New signups (7d) | `auth.users.created_at` and/or `tenants.created_at` |
| Stuck onboarding count | Tenants without locations or non-`GO_LIVE_READY` |
| Signup pipeline funnel | Unified pipeline stages (see below) |
| Stuck signup totals | Issue buckets A/B/C (filters on pipeline) |
| Trials expiring (7d) | `tenant_subscriptions.trial_ends_at` (Phase 5) |

**Tenant directory (`/console/tenants`)**

- Search by name, email, `organization_code` (`ORG-XXXXXX`)
- Filters: `status`, `onboarding_status`, `onboarding_source`, country, date range
- Columns: code, name, status, onboarding stage, owner email, user count, location count, group, created date
- Phase 5 adds: plan name, subscription status, trial end date
- Pagination (default 50)

**Tenant detail (`/console/tenants/[tenantId]`)**

Tabs or sections:

1. **Profile** — legal/trade name, emails, phones, country, timezone, locale, `metadata_json`
2. **Lifecycle** — `status`, `onboarding_status`, `onboarding_source`, `created_at`, `created_by_user_id`
3. **People** — `users` + `user_tenant_memberships` (role, active, last login)
4. **Structure** — locations list (read-only), group link if `group_id` set
5. **Health** — counts: items, entities, POs, etc. (head-only queries)
6. **Onboarding diagnosis** — computed stuck reason (e.g. “no locations → wizard step 1 incomplete”)
7. **Billing** (Phase 5) — plan, subscription status, trial/period dates, Stripe links, trial actions

**Tenant groups (`/console/groups`, `/console/groups/[groupId]`)**

- List groups with `group_code` (`GRP-XXXXXX`), status, member org count
- Detail: member workspaces (reuse logic from `private.list_group_organizations`)

**Signup pipeline (`/console/signups`) — enhanced**

Primary view: a **unified, paginated list** of every signup attempt — not only stuck rows. Each row joins `auth.users` (when present) with `tenants`, `users`, and (Phase 5) `tenant_subscriptions` / `subscription_plans`.

**Pipeline stages** (computed column `pipeline_stage`):

| Stage | Code | Condition |
|-------|------|-----------|
| Registered | `REGISTERED` | Auth user exists |
| Email verified | `EMAIL_VERIFIED` | `auth.users.email_confirmed_at IS NOT NULL` |
| Tenant provisioned | `TENANT_CREATED` | `public.users` row exists (or tenant row linked) |
| Onboarding in progress | `ONBOARDING` | Tenant exists, `onboarding_status != 'GO_LIVE_READY'` |
| Live | `LIVE` | `onboarding_status = 'GO_LIVE_READY'` |
| Trial | `TRIAL` | `tenants.status = 'TRIAL'` (Phase 5: or subscription `TRIALING`) |
| Paying | `PAYING` | `tenants.status = 'ACTIVE'` + active subscription (Phase 5) |
| Churned / blocked | `CHURNED` | `SUSPENDED`, `PAST_DUE`, or `is_active = false` |

**Pipeline stage precedence** (when multiple conditions match, use the **first** matching row from top):

1. `CHURNED` — suspended, past due, or inactive  
2. `PAYING` — Phase 5: active paid subscription; or `tenants.status = 'ACTIVE'` without trial subscription  
3. `TRIAL` — `tenants.status = 'TRIAL'` or subscription `TRIALING`  
4. `LIVE` — `onboarding_status = 'GO_LIVE_READY'`  
5. `ONBOARDING` — tenant exists, not go-live ready  
6. `TENANT_CREATED` — `public.users` / tenant linked  
7. `EMAIL_VERIFIED` — auth user, email confirmed, no tenant yet  
8. `REGISTERED` — auth user only  

Implement in `apps/web/lib/console/pipeline-stage.ts` (single source of truth for funnel + table).

**List columns**

- Signup date (`auth.users.created_at`, fallback `tenants.created_at`)
- Company name (tenant name or `user_metadata.company_name`)
- Owner email
- Email confirmed (yes/no)
- Workspace code (`ORG-XXXXXX`) when tenant exists
- Pipeline stage
- Onboarding status (`tenant_onboarding_status`)
- Account status (`tenant_account_status`)
- Plan name + trial end date (Phase 5)
- Issue flag (none / A / B / C)

**Filters**

- Pipeline stage, account status, onboarding status, onboarding source, country
- Date range (signup date)
- Email confirmed: yes / no
- Has issue: A / B / C / any / none
- Trial expiring within N days (Phase 5)

**Funnel summary** (top of page)

Counts and conversion rates between stages, e.g. Registered → Verified → Provisioned → Live → Trial → Paying. Shown as a compact bar or step summary on the overview dashboard and signup page.

**Issue buckets** (filters on the unified list — not a separate page)

| Bucket | Condition | Meaning |
|--------|-----------|---------|
| **A** | Auth user exists, no `public.users` row, `signup_pending` / `provision_deferred` | Deferred signup not finished |
| **B** | Tenant exists, no `tenant_locations` | Wizard incomplete (same signal as `tenantHasLocations()`) |
| **C** | Auth `app_metadata.tenant_id` set, no `public.users` row | Broken provisioning / metadata mismatch |

**Reference query shape** (server-side, service role):

```sql
-- One row per signup lead: auth user left join tenant via users / app_metadata
SELECT
  au.id AS auth_user_id,
  au.email,
  au.created_at AS signup_at,
  au.email_confirmed_at,
  t.id AS tenant_id,
  t.organization_code,
  t.name AS company_name,
  t.status AS account_status,
  t.onboarding_status,
  t.onboarding_source,
  -- pipeline_stage + issue_bucket computed in TS or SQL CASE
FROM auth.users au
LEFT JOIN public.users pu ON pu.id = au.id
LEFT JOIN public.tenants t ON t.id = COALESCE(pu.tenant_id, (au.raw_app_meta_data ->> 'tenant_id')::uuid)
ORDER BY signup_at DESC;
```

**Auth user lookup (`/console/users`)**

- Search by email
- Show: auth user id, email confirmed, `app_metadata`, linked tenant(s), memberships

**Audit log viewer (`/console/audit`)**

- Paginated list: operator, action, target, tenant, timestamp
- Filter by action type, operator, tenant, date range

### Queries module

```
apps/web/lib/console/queries/
  overview-metrics.ts
  tenant-directory.ts
  tenant-detail.ts
  signup-pipeline.ts       # unified list + funnel counts
  signup-issue-buckets.ts  # A/B/C filters (used by signup-pipeline)
  group-directory.ts
  auth-user-lookup.ts
  audit-log.ts
```

### Acceptance criteria

- [ ] Find any tenant in under 5 seconds by code, name, or email
- [ ] Unified signup pipeline lists all signups with stage, status, and issue flag
- [ ] Funnel summary shows counts per pipeline stage
- [ ] Filter pipeline by issue buckets A, B, C without losing full-list context
- [ ] View group membership for enterprise customers
- [ ] Look up auth user and see tenant linkage
- [ ] No write actions exposed in UI (read-only phase)
- [ ] All list pages paginated; no unbounded cross-tenant scans from client

### Dependencies

- Phase 0 complete
- Existing schema: `tenants.organization_code`, `tenant_groups.group_code`, onboarding enums

---

## Phase 2 — Lifecycle controls

### Goal

Operators can fix common support issues and control tenant access — every mutation audited with optional `reason`.

### Deliverables

**Tenant lifecycle actions**

| Action | Effect | Min role |
|--------|--------|----------|
| Suspend tenant | `is_active = false`, `status = 'SUSPENDED'` | OPERATOR |
| Reactivate tenant | Reverse suspend | OPERATOR |
| Update account status | `TRIAL` / `ACTIVE` / `PAST_DUE` / `SUSPENDED` | OPERATOR |
| Force onboarding status | Update `onboarding_status` enum | OPERATOR (+ reason) |

**Suspension gate (middleware)**

- For tenant routes (`/dashboard`, modules, `/settings`, etc.):
  - If tenant `SUSPENDED` or `is_active = false` → redirect to `/suspended`
- New page: **`/suspended`** — tenant-facing message (not console). Copy and layout: **Appendix D**.

**Maintenance gate (Phase 4)**

- When `platform_config.maintenance_mode = true`, tenant routes redirect to **`/maintenance`** (console exempt). See Appendix D.

**Signup recovery actions**

| Action | Implementation |
|--------|----------------|
| Retry tenant provisioning | Call `initialize_new_tenant` for stuck Bucket A users (via admin client / console wrapper) |
| Confirm email | `admin.auth.admin.updateUserById({ email_confirm: true })` — pattern from `api/signup/silent/route.ts` |
| Send password reset | Supabase Admin API |

**User actions (within tenant)**

| Action | Effect |
|--------|--------|
| Deactivate user | `users.is_active = false` + membership |
| Reactivate user | Reverse |

**Server actions module**

```
apps/web/lib/console/actions/
  tenant-lifecycle.ts
  signup-recovery.ts
  auth-tools.ts
  user-lifecycle.ts
```

**Audit requirements**

- Every action above calls `logConsoleAction()`
- Suspend, force onboarding, deactivate require `reason` text in `payload`

### Acceptance criteria

- [ ] Suspend tenant → user cannot access `/dashboard` (middleware gate works)
- [ ] Reactivate restores access
- [ ] Retry provisioning fixes Bucket A/C without manual SQL
- [ ] Email confirm works for unverified signups
- [ ] Every mutation appears in audit log with operator, target, reason
- [ ] VIEWER role cannot mutate (403)

### Dependencies

- Phase 1 (tenant detail pages host action buttons)
- Existing RPC: `public.initialize_new_tenant`
- Existing admin client: `createAdminClient()` in `apps/web/lib/supabase/admin.ts`

---

## Phase 3 — Impersonation

### Goal

Operators can view the tenant ERP as the customer sees it — read-only by default, time-boxed, fully audited.

### Deliverables

**Start impersonation**

- From tenant detail: select tenant (+ optional user), enter **reason**
- Creates `app_console_impersonation_sessions` row
- Sets httpOnly cookie `aib-console-impersonation` (signed payload: session id, tenant id, user id, mode, expiry). Sign with **`CONSOLE_IMPERSONATION_SECRET`** (Appendix E).
- Default mode: `READ_ONLY`
- Default expiry: 1 hour

**Middleware / session handling**

- When impersonation cookie present on tenant routes:
  - Validate session (`ended_at IS NULL`, not expired)
  - Allow navigation to `/dashboard` and modules using target `tenant_id`
  - Do not require operator’s own JWT `tenant_id` to match

**UI**

- Persistent banner on tenant shell: *“Viewing {tenant name} ({ORG-XXXXXX}) — read-only impersonation — Exit”* (full-width amber bar above Zone A — see UI & dashboard design)
- Exit button clears cookie, sets `ended_at`, writes audit row

**Write protection**

- All tenant server actions blocked during read-only impersonation
- Optional `WRITE` mode: **ADMIN only**, off by default even after build

**Console page**

- `/console` or tenant detail shows active impersonation sessions
- Admin can force-end a session

### Acceptance criteria

- [ ] Operator views tenant dashboard without knowing customer password
- [ ] Banner visible on every impersonated page
- [ ] Read-only: no PO create, no settings save, etc.
- [ ] Session expires automatically
- [ ] Exit impersonation returns operator to `/console`
- [ ] `IMPERSONATION_START` and `IMPERSONATION_END` in audit log with reason

### Dependencies

- Phase 2 (stable middleware)
- Phase 0 (`app_console_impersonation_sessions` table)

### Security notes

- Never share or log service role key
- WRITE mode disabled in production until explicitly enabled per policy
- Consider IP allowlist for `/console` in production (optional)

---

## Phase 4 — Platform maturity

### Goal

Manage who has console access and global product switches — foundation for billing and feature flags later.

### Deliverables

**Internal admin management (`/console/settings/admins`)**

| Action | Min role |
|--------|----------|
| List operators | VIEWER |
| Grant access (by email / user id) | ADMIN |
| Revoke / deactivate operator | ADMIN |
| Change operator role | ADMIN |

- Grant flow: lookup `auth.users` by email → insert `app_console_operators`
- Cannot revoke last active ADMIN

**Platform config (`/console/settings/platform`)**

Seed keys in `platform_config`:

| Key | Type | Purpose |
|-----|------|---------|
| `signup_enabled` | boolean | Block new `/signup` when false |
| `maintenance_mode` | boolean | Show maintenance page for tenants |
| `console_mfa_required` | boolean | Require AAL2 (authenticator TOTP) for `/console` |
| `allowed_country_codes` | string[] | Restrict signup countries (optional) |

- Middleware or signup route checks `signup_enabled`
- Maintenance mode redirect for tenant routes (console exempt)

**Per-tenant feature flags (optional v1)**

- Store in `tenants.metadata_json` under `_platform.features` or dedicated table later
- Console UI: toggle modules per tenant (read from metadata, write with audit)

### Acceptance criteria

- [ ] ADMIN can add/remove console operators without SQL
- [ ] Disabling signup prevents new registrations
- [ ] Maintenance mode blocks tenant app; console still accessible
- [ ] Platform config changes audited

### Dependencies

- Phases 0–2 (audit + roles established)

### Explicitly out of scope for Phase 4

- Subscription plan catalog and tenant subscriptions (Phase 5)
- Stripe webhook integration (Phase 5)
- Usage metering
- GDPR export / tenant hard delete
- Slack/email alerting

---

## Phase 5 — Billing, plans & trials

### Goal

Commercial operations: define subscription plans, attach tenants to plans, manage trial lifecycles, and connect signup pipeline stages to revenue status. Stripe integration is optional in v1 of this phase — manual plan assignment works without payment provider.

### Relationship to existing schema

`tenants.status` (`TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`) remains the **access gate** for middleware. Phase 5 adds **commercial detail** in separate tables; keep them in sync via console actions or webhooks.

| Layer | Field / table | Purpose |
|-------|---------------|---------|
| Access | `tenants.status`, `tenants.is_active` | Can user log in and use ERP? (**middleware reads this**) |
| Commercial | `tenant_subscriptions` | Plan, trial dates, billing period, Stripe IDs |
| Catalog | `subscription_plans` | What you sell (price, limits, features) |

**Status sync rules:** **Appendix C**. Summary: middleware and suspend actions use **`tenants`**; Stripe webhooks and subscription jobs update **`tenant_subscriptions`** then mirror into **`tenants.status`** via a single server helper (`syncTenantAccessFromSubscription`).

### Deliverables

**Database (new migration)**

Enums:

```sql
CREATE TYPE public.subscription_plan_interval AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE public.tenant_subscription_status AS ENUM (
  'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'
);
```

Tables:

```sql
CREATE TABLE public.subscription_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                VARCHAR(40) NOT NULL UNIQUE,     -- e.g. 'STARTER', 'GROWTH'
  name                TEXT NOT NULL,
  description         TEXT,
  price_amount        NUMERIC(15, 4) NOT NULL DEFAULT 0,
  price_currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  billing_interval    public.subscription_plan_interval NOT NULL DEFAULT 'MONTHLY',
  trial_days          INT NOT NULL DEFAULT 14,
  limits_json         JSONB NOT NULL DEFAULT '{}'::jsonb,   -- { "users": 5, "locations": 2 }
  features_json       JSONB NOT NULL DEFAULT '{}'::jsonb,     -- { "procurement": true, "manufacturing": false }
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  is_public           BOOLEAN NOT NULL DEFAULT TRUE,          -- show on marketing / signup
  sort_order          INT NOT NULL DEFAULT 0,
  stripe_product_id   TEXT,
  stripe_price_id     TEXT,
  metadata_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.tenant_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  plan_id                 UUID NOT NULL REFERENCES public.subscription_plans (id),
  status                  public.tenant_subscription_status NOT NULL DEFAULT 'TRIALING',
  trial_started_at        TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  canceled_at             TIMESTAMPTZ,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  assigned_by             UUID REFERENCES auth.users (id) ON DELETE SET NULL,  -- console operator
  metadata_json           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tenant_subscriptions_one_active_per_tenant
    UNIQUE (tenant_id)  -- one subscription row per tenant in v1; revise for plan history later
);
```

RLS: same pattern as console tables — enabled, no policies for `authenticated` / `anon`. Console reads/writes via service role only.

**Seed default plans** (example):

| Code | Name | Trial | Notes |
|------|------|-------|-------|
| `TRIAL` | Trial | 14 days | Auto-assigned on signup |
| `STARTER` | Starter | 0 | Entry paid tier |
| `GROWTH` | Growth | 0 | Mid tier |

**On signup hook** (extend `initialize_new_tenant` RPC **or** post-provision server action — prefer RPC in migration for atomicity):

- Insert `tenant_subscriptions` with default plan (`TRIAL` or configured default)
- Set `trial_started_at = NOW()`, `trial_ends_at = NOW() + trial_days`
- Keep `tenants.status = 'TRIAL'`

**Plan catalog (`/console/plans`)**

| Action | Min role |
|--------|----------|
| List / view plans | VIEWER |
| Create / edit plan | ADMIN |
| Archive plan (`is_active = false`) | ADMIN |
| Reorder plans | ADMIN |

Fields editable in UI: name, description, price, currency, interval, trial days, limits, features, public visibility, Stripe IDs (when integrated).

**Subscriptions directory (`/console/subscriptions`)**

- All tenants with plan name, subscription status, trial end, period end, MRR estimate
- Filters: plan, subscription status, trial expiring within N days, `PAST_DUE`
- Link to tenant detail

**Trials (`/console/trials` or tab on subscriptions)**

| View | Filter |
|------|--------|
| Active trials | `status = 'TRIALING'` |
| Expiring in 7 days | `trial_ends_at BETWEEN now() AND now() + 7 days` |
| Expired (not converted) | `trial_ends_at < now()` AND status still `TRIALING` |

| Action | Effect | Min role |
|--------|--------|----------|
| Extend trial | Set new `trial_ends_at` (+ N days) | OPERATOR (+ reason) |
| Convert to paid | Assign paid plan, set subscription `ACTIVE`, `tenants.status = 'ACTIVE'` | OPERATOR |
| End trial early | Set `EXPIRED` or suspend tenant | OPERATOR (+ reason) |
| Change plan | Update `plan_id` with audit | OPERATOR |

**Tenant detail — Billing tab**

- Current plan, subscription status, trial/period dates
- Stripe customer link (when present)
- Actions: extend trial, change plan, mark past due, cancel

**Signup pipeline integration**

Extend Phase 1 pipeline list with plan + trial columns (see Phase 1). Funnel adds Trial → Paying step using subscription status.

**Stripe integration (optional sub-deliverable)**

| Component | Purpose |
|-----------|---------|
| `POST /api/webhooks/stripe` | Sync subscription status, `PAST_DUE`, cancellations |
| Checkout / portal links | Tenant self-serve upgrade (tenant-facing, not console) |
| Console read-only Stripe IDs | Support lookup |

Verify webhook signatures with `STRIPE_WEBHOOK_SECRET`; idempotent event handling by Stripe event id.

When Stripe is connected, console actions that change plan/status should prefer Stripe API where applicable; manual override remains for ops with audit.

**Automated trial expiry (cron / Supabase pg_cron or edge function)**

- Daily job: subscriptions where `trial_ends_at < now()` AND `status = 'TRIALING'`
- Policy (configurable in `platform_config`):
  - `trial_expiry_action`: `SUSPEND` | `DOWNGRADE` | `NOTIFY_ONLY`
- Set `tenants.status = 'SUSPENDED'` or subscription `EXPIRED` per policy
- Log to audit (system actor) or `tenant_subscription_events` table (optional)

**New audit actions** (extend `app_console_action` enum):

- `PLAN_CREATE`, `PLAN_UPDATE`, `PLAN_ARCHIVE`
- `SUBSCRIPTION_ASSIGN`, `SUBSCRIPTION_CHANGE_PLAN`
- `TRIAL_EXTEND`, `TRIAL_CONVERT`, `TRIAL_END`
- `SUBSCRIPTION_CANCEL`, `SUBSCRIPTION_MARK_PAST_DUE`

### Application files (expected)

```
supabase/migrations/YYYYMMDD_subscription_plans_and_trials.sql
apps/web/app/console/plans/
  page.tsx
  [planId]/page.tsx
apps/web/app/console/subscriptions/
  page.tsx
apps/web/app/console/trials/
  page.tsx
apps/web/lib/console/queries/
  subscription-plans.ts
  tenant-subscriptions.ts
  trial-queue.ts
apps/web/lib/console/actions/
  plan-management.ts
  subscription-lifecycle.ts
  trial-management.ts
apps/web/app/api/webhooks/stripe/route.ts   (optional)
```

### Acceptance criteria

- [ ] ADMIN can create and edit subscription plans in console
- [ ] New tenant signup auto-gets default trial subscription with `trial_ends_at`
- [ ] Signup pipeline shows plan + trial end for each row
- [ ] Operator can extend trial with reason; change appears in audit log
- [ ] Operator can convert trial to paid plan; `tenants.status` becomes `ACTIVE`
- [ ] Trials expiring in 7 days visible on overview and `/console/trials`
- [ ] Expired trial job suspends or flags tenant per platform config
- [ ] (Optional) Stripe webhook updates subscription status without manual console action

### Dependencies

- Phases 0–2 (console access, tenant detail, lifecycle suspend)
- Phase 1 enhanced signup pipeline
- Existing `tenant_account_status` enum on `tenants`

### Explicitly out of scope for Phase 5

- Usage-based billing / metering
- Invoicing inside ERP (tenant AR/AP is separate)
- Multi-currency price books beyond single currency per plan
- Subscription history / multiple concurrent plans per tenant (v1 = one row per tenant)
- Customer self-serve billing portal (can be a follow-up tenant-facing `/settings/billing`)

---

## Cross-cutting requirements (all phases)

See **Authentication & operators** above for identity, bootstrap, break-glass, and enforcement layers. See **UI & dashboard design** for shell, dashboard, and component standards.

### Roles

| Role | Permissions |
|------|-------------|
| **VIEWER** | Read all console pages, plans, subscriptions, signup pipeline |
| **OPERATOR** | VIEWER + suspend, signup recovery, user deactivate, force onboarding, trial extend/convert/end, assign/change plan |
| **ADMIN** | OPERATOR + grant/revoke operators, platform config, plan catalog CRUD, impersonation write (if enabled) |

### Audit log contract

Every mutation records:

```
operator_id, operator_email, action, target_type, target_id,
tenant_id (if applicable), payload (incl. reason), ip, user_agent, created_at
```

### Code conventions

- Match existing patterns: `requireTenantId` → `requireConsoleAccess`
- Server actions only (`"use server"`)
- Use UI kit components — no raw unstyled buttons/tables (per `.cursorrules`)
- TypeScript throughout
- After each console migration, align **`packages/database/schema.sql`** with new platform tables/enums

### Testing checklist (before merge)

- [ ] Non-operator blocked from `/console`
- [ ] Operator without tenant_id can use console
- [ ] **MFA: operator with enrolled TOTP cannot reach `/console` until challenge succeeds**
- [ ] **MFA: `APP_CONSOLE_MFA_OPTIONAL=true` allows password-only in dev only**
- [ ] Tenant user cannot query console tables via anon client
- [ ] Suspend → `/suspended` → reactivate restores access
- [ ] Signup pipeline funnel and issue buckets accurate against test data
- [ ] Impersonation read-only blocks writes
- [ ] Audit log complete for sample workflow
- [ ] (Phase 5) Trial extend/convert updates subscription + tenant status
- [ ] UI acceptance criteria (see **UI & dashboard design**)
- [ ] `npx tsc --noEmit` and `npm test` in `apps/web`

---

## Single-branch implementation order

When building all phases at once, implement in this order:

1. Phase 0 — migration, auth gate, **MFA (TOTP)**, **`ConsoleShell`**, middleware
2. Phase 1 — read-only pages + **overview dashboard UI** (tenants, signup pipeline, groups, users, audit)
3. Phase 2 — mutations + suspension middleware + `/suspended`
4. Phase 3 — impersonation (read-only only at launch)
5. Phase 4 — internal admins + platform config
6. Phase 5 — subscription schema, plans UI, trials, pipeline billing columns; Stripe webhooks last

Phase 5 can start after Phase 2 (needs tenant detail + suspend) but signup pipeline billing columns require Phase 1 pipeline first.

---

## Definition of done

### App Console v1 (Phases 0–4)

- [ ] Find tenant by name, email, or `ORG-XXXXXX`
- [ ] Unified signup pipeline with funnel + issue buckets A/B/C
- [ ] **Console shell distinct from tenant ERP; overview funnel + KPI cards**
- [ ] **List peek drawer + consistent status badges**
- [ ] Suspend / reactivate tenant with audit trail
- [ ] Retry broken provisioning without SQL
- [ ] Confirm email / deactivate user from console
- [ ] Impersonate tenant read-only with banner
- [ ] View audit history
- [ ] Manage console operator access
- [ ] Toggle signup and maintenance mode
- [ ] **TOTP (authenticator app) required for console operators in production**

### App Console v1 + commercial ops (Phases 0–5)

- [ ] All v1 criteria above
- [ ] Create and manage subscription plans
- [ ] Every tenant has a subscription row with trial dates
- [ ] Extend, convert, and end trials from console
- [ ] Signup pipeline shows plan + trial status
- [ ] Trials expiring soon visible on dashboard
- [ ] Auto-expire trials per platform policy

---

## Appendices

### Appendix A — Phase 0 schema sketch

Reference DDL for `supabase/migrations/YYYYMMDD_app_console_foundation.sql` (adjust names/dates as needed).

```sql
CREATE TYPE public.app_console_role AS ENUM ('VIEWER', 'OPERATOR', 'ADMIN');

CREATE TYPE public.app_console_action AS ENUM (
  'TENANT_VIEW', 'TENANT_SUSPEND', 'TENANT_REACTIVATE', 'TENANT_STATUS_UPDATE',
  'ONBOARDING_FORCE_STATUS',
  'USER_DEACTIVATE', 'USER_REACTIVATE',
  'AUTH_EMAIL_CONFIRM', 'AUTH_PASSWORD_RESET',
  'SIGNUP_RETRY_PROVISION',
  'IMPERSONATION_START', 'IMPERSONATION_END',
  'GROUP_VIEW', 'GROUP_SUSPEND',
  'PLATFORM_CONFIG_UPDATE',
  'INTERNAL_ADMIN_GRANT', 'INTERNAL_ADMIN_REVOKE',
  'MFA_ENROLL', 'MFA_VERIFY_SUCCESS', 'MFA_VERIFY_FAILED',
  -- Phase 5 extends: PLAN_*, SUBSCRIPTION_*, TRIAL_*
  'PLAN_CREATE', 'PLAN_UPDATE', 'PLAN_ARCHIVE',
  'SUBSCRIPTION_ASSIGN', 'SUBSCRIPTION_CHANGE_PLAN',
  'TRIAL_EXTEND', 'TRIAL_CONVERT', 'TRIAL_END',
  'SUBSCRIPTION_CANCEL', 'SUBSCRIPTION_MARK_PAST_DUE'
);

CREATE TABLE public.app_console_operators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            public.app_console_role NOT NULL DEFAULT 'VIEWER',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enforced    BOOLEAN NOT NULL DEFAULT TRUE,
  granted_by      UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT app_console_operators_email_lowercase_chk CHECK (email = lower(email))
);

CREATE TABLE public.app_console_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     UUID NOT NULL REFERENCES public.app_console_operators (id),
  operator_email  TEXT NOT NULL,
  action          public.app_console_action NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT,
  tenant_id       UUID REFERENCES public.tenants (id) ON DELETE SET NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.app_console_impersonation_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id      UUID NOT NULL REFERENCES public.app_console_operators (id),
  target_tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
  target_user_id   UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  mode             TEXT NOT NULL DEFAULT 'READ_ONLY'
    CHECK (mode IN ('READ_ONLY', 'WRITE')),
  reason           TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  ended_by         UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE public.platform_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_by  UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_config (key, value) VALUES
  ('signup_enabled', 'true'::jsonb),
  ('maintenance_mode', 'false'::jsonb),
  ('console_mfa_required', 'true'::jsonb),
  ('trial_expiry_action', '"SUSPEND"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS: enabled, no policies for authenticated/anon on all four tables
```

Sync resulting enums/tables to `packages/database/schema.sql` after migration lands.

### Appendix B — Pipeline stage precedence

When computing `pipeline_stage` for funnel and signup table, evaluate in order — **first match wins**:

1. `CHURNED` — `NOT tenants.is_active` OR `tenants.status IN ('SUSPENDED', 'PAST_DUE')`
2. `PAYING` — Phase 5: `tenant_subscriptions.status = 'ACTIVE'` on a non-trial plan; else `tenants.status = 'ACTIVE'`
3. `TRIAL` — `tenants.status = 'TRIAL'` OR subscription `TRIALING`
4. `LIVE` — `onboarding_status = 'GO_LIVE_READY'`
5. `ONBOARDING` — tenant row exists, not go-live ready
6. `TENANT_CREATED` — `public.users` row or linked tenant
7. `EMAIL_VERIFIED` — auth user with `email_confirmed_at`, no tenant
8. `REGISTERED` — auth user exists

Implement once in `apps/web/lib/console/pipeline-stage.ts`.

**Signup list primary key:** prefer `auth.users.id` when present; fall back to `tenants.id` for rows created outside normal signup (rare).

### Appendix C — `tenants.status` vs `tenant_subscriptions.status`

| Concern | Source of truth | Consumer |
|---------|-----------------|----------|
| Login / ERP access | `tenants.is_active`, `tenants.status` | Middleware suspend/maintenance gates |
| Commercial / billing | `tenant_subscriptions`, Stripe | Console billing tab, MRR, trial dates |
| Past due | Stripe webhook → subscription `PAST_DUE` → sync helper sets `tenants.status = 'PAST_DUE'` | Both |
| Trial expired (job) | Job sets subscription `EXPIRED` + `tenants.status = 'SUSPENDED'` (or per `trial_expiry_action`) | Both |

**Rule:** All writes that change commercial state go through **`syncTenantAccessFromSubscription(tenantId)`** so `tenants` mirrors subscription for access control.

**Conflict resolution:** If console operator manually sets `tenants.status` while subscription disagrees, audit log records override; optional banner on tenant detail: “Status out of sync with subscription”.

**Group billing (future):** `tenant_groups.status` is out of scope for Phase 5 v1; document when enterprise group plans ship.

### Appendix D — Tenant-facing system pages

| Route | When shown | UX notes |
|-------|------------|----------|
| `/suspended` | `tenants.is_active = false` OR `status = 'SUSPENDED'` | Explain account suspended; contact support email; link to `/login` only (no ERP nav) |
| `/maintenance` | `platform_config.maintenance_mode = true` | Platform maintenance message; retry later; no console link |
| `/console/unauthorized` | Logged in, not in `app_console_operators` | “No console access”; link to ERP or logout |

Use UI kit (`Card`, `Button`); minimal layout without `DashboardShell`. Suspended users may still authenticate — they must not reach `/dashboard`.

### Appendix E — Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client auth (login, MFA enroll/challenge) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (console) | Server-only cross-tenant queries |
| `CONSOLE_IMPERSONATION_SECRET` | Phase 3+ | Sign/httpOnly impersonation cookie (32+ byte random) |
| `APP_CONSOLE_MFA_OPTIONAL` | No | `true` = allow AAL1 for `/console` in dev only |
| `APP_CONSOLE_BREAK_GLASS` | No | Tier 3 break-glass (default off) |
| `STRIPE_WEBHOOK_SECRET` | Phase 5 optional | Verify Stripe webhooks |

Never expose service role or impersonation secret to the client.

### Appendix F — Plan limits enforcement (post Phase 5)

`subscription_plans.limits_json` (e.g. max users, locations) is stored in Phase 5 but **enforcement** in the tenant app is a follow-up:

- Check limits in invite-user and create-location server actions
- Optional: middleware banner when over limit (soft) vs block (hard)
- Console shows limit vs usage on tenant detail **Health** tab

Not required for App Console v1 launch.

### Appendix G — Login `next` redirect safety

After password login and MFA challenge, redirect to `next` query param when:

- Path is relative (`/console`, `/dashboard`, …)
- Path starts with `/` but not `//` (open redirect protection)
- Default fallback: tenant `resolvePostLoginRoute` for non-console; `/console` when `next=/console`

Update `apps/web/app/login/login-client.tsx` and MFA challenge page to share this helper (`lib/auth/safe-next-path.ts`).

---

## Future work (post Phase 5)

- Stripe Customer Portal for tenant self-serve billing
- Usage-based billing / metering
- Per-tenant feature flags table (beyond `features_json` on plans)
- Subscription history (multiple rows per tenant over time)
- Observability dashboard (Supabase logs, error rates)
- GDPR export / tenant deletion workflow
- Impersonation WRITE mode (if ever needed)
- IP allowlist / VPN requirement for production console
- WebAuthn / passkeys as additional MFA factor (Supabase supported)
- CSV export for tenant and signup lists
- In-app operator runbook / tooltips
- Link from [`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md) and [`NAVIGATION.md`](./NAVIGATION.md) to this doc

---

## Related codebase references

| Concern | Location |
|---------|----------|
| Service role client | `apps/web/lib/supabase/admin.ts` |
| Tenant session gate | `apps/web/lib/supabase/require-tenant.ts` |
| Middleware | `apps/web/lib/supabase/middleware.ts` |
| Session claims | `apps/web/lib/supabase/session-claims.ts`, `apps/web/lib/supabase/auth.ts` |
| Signup provisioning | `supabase/migrations/20260527180000_create_tenant_signup_initialization.sql` |
| Workspace codes | `supabase/migrations/20260610100000_workspace_public_codes.sql` |
| Tenant lifecycle enums | `packages/database/schema.sql` (`tenant_account_status`, `tenant_onboarding_status`) |
| Onboarding status | `apps/web/lib/onboarding/status.ts`, `apps/web/app/onboarding/actions.ts` |
| Tenant groups | `supabase/migrations/20260609100000_tenant_groups_foundation.sql` |
| Supplier portal (separate) | `apps/web/app/portal/layout.tsx` |
| Default trial on tenant | `tenants.status` defaults to `'TRIAL'` in `packages/database/schema.sql` |
| Phase 5 schema (planned) | `subscription_plans`, `tenant_subscriptions` — see Phase 5 migration |
| Design system | [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) |
| Tenant dashboard UI patterns | `apps/web/components/dashboard/` (`HubPanel`, `MetricCard`, `command-hub-header.tsx`) |
| List + drawer pattern | `DESIGN_SYSTEM.md` §3, `apps/web/components/ui/right-drawer.tsx` |
| Tenant shell (do not reuse for console) | `apps/web/components/layout/dashboard-shell.tsx` |
| Login (extend for `next` + MFA redirect) | `apps/web/app/login/login-client.tsx` |
| Supabase MFA (TOTP) | [Supabase Auth MFA docs](https://supabase.com/docs/guides/auth/auth-mfa) — enroll/challenge APIs |
