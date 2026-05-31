# AIB Smart ERP — Web Frontend

Next.js App Router application for tenant onboarding and dashboard modules.

## Setup

```bash
cd apps/web
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# Optional but recommended for dev signup (avoids Supabase email rate limits):
# SUPABASE_SERVICE_ROLE_KEY from Supabase Dashboard → Settings → API → service_role
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Public entry

`/` — marketing landing for visitors; authenticated users route to onboarding or dashboard.

`/login` and `/signup` — B2B authentication and workspace registration.

## Public Signup

`/signup` — B2B organization registration (unauthenticated):

1. Organization name, administrator name, country, work email, password
2. Terms acceptance (links to `/legal/terms` and `/legal/privacy`)
3. Supabase Auth sign-up with deferred provisioning (`signup_pending`)
4. RPC `initialize_new_tenant` seeds `tenants` + OWNER `users` row
5. Post-login routing: incomplete onboarding → `/onboarding`; live tenant → `/dashboard`

**Note:** Signup supports email confirmation via `/auth/callback`. Users without a tenant are sent to `/signup?resume=1` to finish workspace setup. For local dev, `SUPABASE_SERVICE_ROLE_KEY` avoids auth rate limits.

## Onboarding Flow

`/onboarding` — four-step milestone checklist wired to Supabase:

1. Company & location
2. Chart of accounts (country-specific template: India GST, US sales tax, or international VAT)
3. Tax rates (country presets from signup/location)
4. Sales channels & return policies

Saving the final step auto-launches the workspace (`complete_onboarding` RPC → `GO_LIVE_READY`).

`onboarding_status` progresses: `ORGANIZATION_CONFIGURED` → `DATABASE_SEEDED` → `COMPLIANCE_VERIFIED` → `GO_LIVE_READY`.

After launch, the dashboard shows a dismissible **Getting started** checklist (first product, categories, org review, locations).

## Smoke test checklist

1. Visit `/` logged out — marketing landing with Sign in / Create workspace CTAs
2. US signup → onboarding Step 2 deploys US COA (no IGST/CGST/SGST accounts)
3. IN signup → India COA + GST tax presets
4. Complete Step 4 — redirects to dashboard without a separate launch click
5. Dashboard shows Getting started checklist until dismissed
