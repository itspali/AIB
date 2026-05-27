# AIB Smart ERP — Web Frontend

Next.js App Router application for tenant onboarding and dashboard modules.

## Setup

```bash
cd apps/web
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Onboarding Flow

`/onboarding` — four-step milestone checklist wired to Supabase:

1. Tenant locations
2. Chart of accounts template deploy
3. Tax rate registry
4. Storefront channels & return policies

Completing all steps enables **Complete Setup & Launch Workspace** (`onboarding_status = GO_LIVE_READY`).
