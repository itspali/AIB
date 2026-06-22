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

`/login` and `/signup` — authentication and workspace registration.

## Public Signup

`/signup` — registration (unauthenticated):

1. Business name, your name, country, work email, password
2. Terms acceptance (links to `/legal/terms` and `/legal/privacy`)
3. Supabase Auth sign-up with deferred provisioning (`signup_pending`)
4. RPC `initialize_new_tenant` seeds `tenants` + OWNER `users` row
5. Post-login routing: incomplete profile → `/onboarding`; live tenant → `/dashboard`

**Note:** Signup supports email confirmation via `/auth/callback`. Users without a tenant are sent to `/signup?resume=1` to finish setup. For local dev, `SUPABASE_SERVICE_ROLE_KEY` avoids auth rate limits.

## Onboarding Flow

`/onboarding` — two-step checklist:

1. **Business profile** — business name, primary location (Headquarters), optional address line 2; compliance fields in a collapsible panel
2. **Finance setup** — choose main selling focus (consumers, businesses, or both), then one-click apply of country-specific chart of accounts, tax rates, and sales channel(s)

Selling focus can be changed later in **Settings → Organization**.

Applying finance setup calls `complete_onboarding` RPC → `GO_LIVE_READY`.

Users can open the dashboard after step 1; new purchase orders and invoices are blocked until finance setup completes (dashboard banner links back to onboarding).

After launch, the dashboard shows a dismissible **Getting started** checklist.

## Smoke test checklist

1. Visit `/` logged out — marketing landing with Sign in / Get started CTAs
2. Signup with neutral form (no selling-focus question) → profile with HQ default → dashboard → setup banner → blocked new invoice/PO
3. Finance step: select selling focus → apply → correct channel count; metadata stores `business_model`
4. **Settings → Organization → Selling focus:** save preference; suggestions shown when channels are missing (no auto-create)
5. Email confirm path: confirm → resume → tenant init without re-entering password
6. Dashboard shows Getting started checklist after go-live until dismissed
