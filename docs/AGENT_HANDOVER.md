# Cursor Agent Handover Manifest: AIB Smart ERP Engine

## 1. System Persona & Strict Compliance Rule
You are an Elite Enterprise Full-Stack Engineer and Core Database Architect. You are taking over the building of the "AIB Smart ERP" platform.
- **Absolute Mandate**: Before generating any database query, schema modification, frontend screen, form component, or API routing path, you MUST read and follow the constraints defined in:
  1. `@docs/DATA_STANDARDS.md` (Relational UUIDv4 constraints, NUMERIC(15,4) and NUMERIC(15,6) financial scales, UTC timezones)
  2. `@docs/DESIGN_SYSTEM.md` (Three-Zone Dashboard layouts, Mobile responsive grid stacks, Progressive disclosure toggles)

## 2. Current Project State Architecture
The fundamental multi-tenant network topology is constructed, initialized, and synchronized live with the cloud Supabase Sandbox via an automated GitHub Actions CI/CD engine (`.github/workflows/deploy.yml`).

### Database Deployment Rule (Agents — Do Not Violate)
- **Supabase CLI is not installed locally** on the developer machine. Do **not** run `supabase link`, `supabase db push`, or other Supabase CLI commands in the agent terminal.
- **Schema changes ship via Git only:** add or edit SQL files under `supabase/migrations/`, then the user commits and pushes to GitHub.
- **CI/CD applies migrations automatically:**
  - Push to `develop` → workflow `deploy-sandbox` runs `supabase db push --yes` against the AIB Sandbox (`SUPABASE_SANDBOX_PROJECT_ID`).
  - Push to `main` → workflow `deploy-production` runs against production.
- **Agent responsibility:** write correct migration files and mention that the user should commit/push to `develop` when a schema change needs to land. Never suggest or attempt local CLI deployment.
- **Sandbox project ref (reference only):** `jmqdzmgxzwkfnjbciufl` — used by CI secrets, not for local linking.

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
- `apps/web/app/dashboard/` -> Command Hub landing dashboard (M10): live metrics, workspace controls, tax policy grid.
- `apps/web/app/items/categories/` -> Category Management Core (Sprint 1): tree + metadata viewport + RightDrawer create form.
- `supabase/migrations/20260527210000_save_system_category_rpc.sql` -> `save_system_category` RPC for atomic `item_categories` insert.
- `supabase/migrations/20260527213000_save_system_category_update_rpc.sql` -> extends `save_system_category` with `p_category_id` for tenant-scoped category updates.

## 3. Active System Tables Definition (Do Not Re-create)
The database contains forty-five active models, protected by Row-Level Security:
- `tenants`, `tenant_locations`, `users`, `entities`, `entity_contacts`, `item_categories`, `items`, `item_variants`, `item_uoms`, `supplier_items`, `price_books`, `price_book_entries`, `storefront_channels`, `storefront_items`, `item_media`, `tags`, `workspace_control_registry`, `document_layout_templates`, `document_sequences`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`, `purchase_order_grn_mappings`, `purchase_invoices`, `purchase_invoice_items`, `stock_transfers`, `stock_transfer_items`, `stock_transfer_incidents`, `transfer_discrepancy_claims`, `item_valuations`, `inventory_buffer_thresholds`, `sales_quotations`, `sales_orders`, `sales_invoices`, `sales_shipments`, `payment_gateway_vouchers`, `customer_payments`, `payment_applications`, `sales_credit_notes`, `sales_returns`, `document_approvals`, `accounts`, `tax_rate_registry`, `return_policies`, `currency_exchange_rates`, `general_ledger_headers`, `general_ledger_entries`, `inventory_ledger`.

**Schema sync:** Commit migration files and push to `develop`; GitHub Actions applies them to sandbox. Do not run Supabase CLI locally. Do not apply manual SQL hotfixes for `accounts` / `tax_rate_registry` / `return_policies` — they bypass RLS policies and drift from migrations.

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

### Task Sequence 11: Multi-Tenant Command Hub Landing Dashboard [IMPLEMENTED]
- **Route:** `/dashboard` — three-zone shell (utility strip, left rail / mobile drawer, workspace canvas `bg-muted/20`).
- **Zone A:** Cmd/Ctrl+K command search block; managerial approval badge counts `sales_orders` (`PENDING_APPROVAL`, `CREDIT_HOLD`), `purchase_orders` (`document_status = PENDING_APPROVAL`), `stock_transfers` (`current_status = PENDING_APPROVAL`).
- **Metrics:** Net capital exposure (GL `1200-AR` net minus unpaid `purchase_invoices.total_liability_amount`); inventory valuation from `item_valuations`; pipeline velocity badges from `sales_orders`.
- **Controls:** `workspace_control_registry` upserts for `SALES_SETTINGS.allow_line_item_discounts` and `FINANCIAL_SETTINGS.accounting_period_closing_date`.
- **Tax grid:** Read/write `tax_rate_registry` with inline add form; server actions in `apps/web/app/dashboard/actions.ts`; queries in `apps/web/lib/dashboard/queries.ts`.

### Task Sequence 12: Master Data — Category Management Core [IMPLEMENTED — Sprint 1]
- **Route:** `/items/categories` — 1/3 + 2/3 split canvas inside `DashboardShell`.
- **Left:** Searchable recursive folder tree from `item_categories` with ACTIVE/INACTIVE badges.
- **Right:** Metadata viewport (lineage, timestamps, attribute_templates) or empty state CTA; **Edit Category** opens drawer pre-filled.
- **RightDrawer:** Resizable 40/60/80% width; create/edit form with essentials + advanced attribute template builder (17 field types, auto-suggested keys from labels, select options).
- **RPC:** `public.save_system_category(p_name, p_parent_id, p_is_active, p_attribute_templates, p_category_id)` — tenant-scoped insert when `p_category_id` is null; update when set.
- **Pending Sprint 2:** `/items` Product Master Catalog Terminal (item + variant create form).

### Task Sequence 15: Product Master Catalog Terminal [IMPLEMENTED]
- **Route:** `/items` — 1/3 + 2/3 split canvas inside `DashboardShell` (left stream panel `lg:col-span-4`, right canvas `lg:col-span-8`).
- **Left stream:** Real-time search across name, SKU, category; category facet filter; summary cards with ACTIVE/ARCHIVED badges.
- **Right canvas modes:** Empty state CTA, read-only detail viewport, create/edit form with progressive disclosure (**Show Advanced Parameters**).
- **Essentials (Section A):** classification, name, master SKU, base UOM (PCS/KG/LTRS/BOX), category node.
- **Advanced (Section B):** HSN/SAC, return eligibility, dead weight (kg), L×W×H (cm) — right-aligned numeric fields.
- **Form stack:** react-hook-form + Zod; footer **Cancel** / **Save Product Master Profile** with Cmd/Ctrl+Enter shortcut.
- **Lib:** [apps/web/lib/products/](apps/web/lib/products/) — types, schemas, queries, classification labels, UOM options.
- **Server actions:** [apps/web/app/items/actions.ts](apps/web/app/items/actions.ts) — `saveProductMasterProfile`, `getProductDetail`.
- **Migration:** [20260530120000_save_product_master_profile_rpc.sql](supabase/migrations/20260530120000_save_product_master_profile_rpc.sql) — `PHYSICAL_GOOD` enum value + atomic `save_product_master_profile` RPC (insert/update parent `items` + master `item_variants`).
- **Sub-nav:** Products (`/items`) and Categories (`/items/categories`); module nav primary href → `/items`.

### Task Sequence 13: Zone A User Profile Dropdown Menu [IMPLEMENTED]
- **Trigger:** Avatar or user icon in [top-utility-strip.tsx](apps/web/components/layout/top-utility-strip.tsx) opens `UserProfileMenu` flyout (`w-72`, click-outside + Esc).
- **Section 1:** Operator identity from `public.users` + tenant/location labels via [lib/user/queries.ts](apps/web/lib/user/queries.ts).
- **Section 2:** Duty availability selector (`metadata_json.duty_status` via `update_user_duty_status` RPC) + Dark Theme Override switch synced with strip `ThemeToggle`.
- **Section 3:** `/settings/profile` settings link (alias `/account`), conditional workspace switch (hidden until multi-tenant memberships exist), sign-out → `/login`.
- **Migration:** [20260528120000_user_duty_status_rpc.sql](supabase/migrations/20260528120000_user_duty_status_rpc.sql) — patches duty status through SECURITY DEFINER RPC with relaxed self-update guard.

### Task Sequence 14: Account Settings & Security Center [IMPLEMENTED]
- **Primary route:** `/settings/profile` — 70/30 split canvas (`lg:grid-cols-10`, `col-span-7` / `col-span-3`) inside `DashboardShell`.
- **Alias route:** `/account` re-exports the same page component.
- **Left canvas (70%):** Personal identity (name grid, read-only email badge, E.164 phone, drag-drop avatar uploader) + localization preferences (`metadata_json.timezone`, `metadata_json.ui_density`).
- **Right security rail (30%):** Password change via Supabase Auth, MFA TOTP enroll modal (requires MFA enabled in Supabase dashboard), live session telemetry grid with revoke-other-sessions.
- **Form stack:** react-hook-form + Zod; sticky header **Reset Changes** / **Apply Profile & Security Updates**; success toast: *Profile Properties Synchronized Successfully*.
- **Lib:** [apps/web/lib/settings/](apps/web/lib/settings/) — types, schemas, queries, timezone options, avatar signed URLs, session fingerprint helper.
- **Server actions:** [apps/web/app/settings/profile/actions.ts](apps/web/app/settings/profile/actions.ts) — `applyProfileSecurityUpdates`, `registerSessionTelemetry`, `revokeOtherSessions`.
- **Migrations (CI deploy only):**
  - [20260529120000_user_preferences_rpc.sql](supabase/migrations/20260529120000_user_preferences_rpc.sql) — `update_user_preferences` RPC; self-update guard allows `timezone` + `ui_density` patches.
  - [20260529130000_user_auth_sessions.sql](supabase/migrations/20260529130000_user_auth_sessions.sql) — `user_auth_sessions` table + `register_user_auth_session` / `revoke_other_auth_sessions` RPCs.
  - [20260529140000_user_avatars_storage.sql](supabase/migrations/20260529140000_user_avatars_storage.sql) — private `user-avatars` bucket with tenant/user-scoped RLS.
- **MFA prerequisite:** Enable TOTP in Supabase Auth settings; modal shows instructional empty state if enrollment fails.
- **Avatar storage path:** `{tenant_id}/{user_id}/avatar.{ext}` in bucket `user-avatars` (max 2MB; JPEG/PNG/WebP).
