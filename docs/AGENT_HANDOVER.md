# Cursor Agent Handover Manifest: AIB Smart ERP Engine

## 1. System Persona & Strict Compliance Rule
You are an Elite Enterprise Full-Stack Engineer and Core Database Architect. You are taking over the building of the "AIB Smart ERP" platform.
- **Absolute Mandate**: Before generating any database query, schema modification, frontend screen, form component, or API routing path, you MUST read and follow the constraints defined in:
  1. `@docs/DATA_STANDARDS.md` (Relational UUIDv4 constraints, NUMERIC(15,4) and NUMERIC(15,6) financial scales, UTC timezones)
  2. `@docs/DESIGN_SYSTEM.md` (Three-Zone Dashboard layouts, Mobile responsive grid stacks, Progressive disclosure toggles)

## 2. Current Project State Architecture
The fundamental multi-tenant network topology is constructed, initialized, and synchronized live with the cloud Supabase Sandbox via an automated GitHub Actions CI/CD engine (`.github/workflows/deploy.yml`).

The folder tree structure is:
- `docs/DATA_STANDARDS.md` -> Global data integrity regulations.
- `docs/DESIGN_SYSTEM.md` -> UI canvas breakpoints and style paradigms.
- `supabase/config.toml` -> Local-to-cloud infrastructure properties map.
- `supabase/migrations/20260526000000_init_tenants.sql` -> Houses initial core tables.
- `supabase/migrations/20260527123000_create_master_product_and_inventory_catalog.sql` -> Contains product engines and append-only inventory ledger.
- `supabase/migrations/20260527134500_create_procurement_and_control_registry.sql` -> Houses procurement, sequences, layout templates, and configuration preferences.
- `supabase/migrations/20260527143000_create_inventory_transfers_and_valuation.sql` -> Houses multi-warehouse stock transfer matrices, en-route incidental logging tables, and the automated Moving Weighted Average Costing (MWAC) engine.
- `supabase/migrations/20260527150000_create_sales_outbound_and_omnichannel_integrations.sql` -> Houses the progressive outbound trade engine, omnichannel conditional return engines, multi-vector state monitors, payment clearing paths, and the bounding-box packaging matrix. **M7 RAISE fix:** line 1127 uses `%` format placeholders (not `%%`).
- `supabase/migrations/20260527170000_create_financial_accounting_and_ledger_automation.sql` -> Houses the unified Chart of Accounts (COA), date-bound tax rate registries with HSN/SAC return tokens, fiscal period lockout calendar gates, multi-state address nexus tax splits, and real-time trigger-driven forex variance sub-ledgers.
- `supabase/migrations/20260527180000_create_tenant_signup_initialization.sql` -> Deferred auth provisioning and `initialize_new_tenant` RPC for public B2B signup bootstrap.
- `supabase/migrations/20260527200000_onboarding_corporate_profile_rpc.sql` -> Atomic `save_onboarding_corporate_profile` RPC for Step 1 tenant + location save.
- `apps/web/app/signup/` -> Public organization registration canvas and silent signup API.
- `apps/web/app/onboarding/` -> Horizontal multi-step onboarding wizard (`OnboardingWizard`, step rail + viewport + footer).

## 3. Active System Tables Definition (Do Not Re-create)
The database contains forty-five active models, protected by Row-Level Security:
- `tenants`, `tenant_locations`, `users`, `entities`, `entity_contacts`, `item_categories`, `items`, `item_variants`, `item_uoms`, `supplier_items`, `price_books`, `price_book_entries`, `storefront_channels`, `storefront_items`, `item_media`, `tags`, `workspace_control_registry`, `document_layout_templates`, `document_sequences`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `purchase_order_grn_mappings`, `purchase_invoices`, `purchase_invoice_items`, `stock_transfers`, `stock_transfer_items`, `stock_transfer_incidents`, `transfer_discrepancy_claims`, `item_valuations`, `inventory_buffer_thresholds`, `sales_quotations`, `sales_orders`, `sales_invoices`, `sales_shipments`, `payment_gateway_vouchers`, `customer_payments`, `payment_applications`, `sales_credit_notes`, `sales_returns`, `document_approvals`, `accounts`, `tax_rate_registry`, `return_policies`, `currency_exchange_rates`, `general_ledger_headers`, `general_ledger_entries`, `inventory_ledger`.

**Schema sync:** Use `supabase db push --linked` against sandbox project `jmqdzmgxzwkfnjbciufl`. Do not apply manual SQL hotfixes for `accounts` / `tax_rate_registry` / `return_policies` — they bypass RLS policies and drift from migrations.

## 4. Pending Backlog Roadmap (For Discussion & Planning Sprints Only)
CRITICAL: Do not write code or migrations for these tasks automatically. The user will initiate a planning chat to refine these points. Only execute migrations when the user explicitly states: "The plan is frozen. Please execute."

### Task Sequence 9: Public Organization Registration Funnel (Sign-Up) & Post-Login Setup Routing [IMPLEMENTED]
- **Public B2B Signup Gate Canvas:** `/signup` — organization registration with design-system card layout.
- **Atomic Registration RPC:** `public.initialize_new_tenant` (SECURITY DEFINER) with deferred `handle_new_auth_user` trigger path.
- **Post-Login Routing:** `resolvePostLoginRoute` — zero `tenant_locations` or incomplete onboarding → `/onboarding`; live tenant → `/dashboard`.

### Task Sequence 10: Horizontal Onboarding Wizard [IMPLEMENTED]
- **Wizard shell:** Left step rail (`WizardStepNav`) + right viewport + footer (`WizardFooter` with Back / Save & Continue / Launch).
- **Step 1:** Corporate profile + home location via `save_onboarding_corporate_profile` RPC.
- **Steps 2–4:** COA deploy, tax registry, omnichannel channels — completion gated by row counts on `accounts`, `tax_rate_registry`, `storefront_channels`.
- **Resilience:** `fetchOnboardingSnapshot` distinguishes missing-table (`schemaWarning`) vs RLS denial (`rlsWarning`).
