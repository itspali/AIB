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

## Public Signup

`/signup` — B2B organization registration (unauthenticated):

1. Organization name, administrator name, work email, password
2. Supabase Auth sign-up with deferred provisioning (`signup_pending`)
3. RPC `initialize_new_tenant` seeds `tenants` + OWNER `users` row
4. Post-login routing: zero locations → `/onboarding`; complete tenant → `/dashboard`

**Note:** Signup requires an immediate auth session. Disable email confirmation in Supabase Auth for local dev, or confirm email before the RPC runs.

## Onboarding Flow

`/onboarding` — four-step milestone checklist wired to Supabase:

1. Tenant locations
2. Chart of accounts template deploy
3. Tax rate registry
4. Storefront channels & return policies

Completing all steps enables **Complete Setup & Launch Workspace** (`onboarding_status = GO_LIVE_READY`).
