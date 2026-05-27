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

## 3. Active System Tables Definition (Do Not Re-create)
The cloud database currently possesses exactly twenty-eight operational entity models, matching dependencies perfectly:
- `tenants` -> Primary corporate identities and root corporate tax definitions.
- `tenant_locations` -> Physical space branch networks, modified with regional tax identifiers and registered trade names.
- `users` -> Corporate workforce registry bound via custom private roles and department settings.
- `entities` -> Business partners profile center ('CUSTOMER', 'SUPPLIER', 'MUTUAL_PARTNER') with active credit tracking layers.
- `entity_contacts` -> Subsidiary human index ensuring single-primary contact index validation per account.
- `item_categories` -> Template trees handling relational parameters and schema-less item dynamic variable arrays.
- `items` & `item_variants` -> Structural parent-child master catalog splitting global parameters from individual physical child SKUs.
- `item_uoms` -> Decoupled packaging conversion coefficient grids with strict positive multiplier controls.
- `supplier_items` -> Multi-vendor procurement catalogues enforcing preferred-source partial indexes.
- `price_books` & `price_book_entries` -> Multi-tier volume discount frameworks and currency matrices.
- `storefront_channels` & `storefront_items` -> Multi-brand commerce engines hosting visual style configurations and store-facing text overrides.
- `item_media` & `tags` -> Hierarchical asset and faceting tag directories.
- `workspace_control_registry` -> Centralized preference engine controlling feature gates (`is_po_mandatory_for_grn`, `is_qc_required_before_stocking`, `allow_negative_inventory`).
- `document_layout_templates` -> Cross-channel view design matrix handling explicit presentation rules for `SCREEN_GRID`, `PDF_PRINT`, and `EMAIL_HTML` contexts.
- `document_sequences` -> Transaction-isolated series counter utilizing explicit row-locking block mechanics.
- `purchase_orders` & `purchase_order_items` -> Contractual purchasing records, custom pricing layers, and fulfillment metrics.
- `goods_receipts` & `goods_receipt_items` -> Asynchronous material receiving logs that trigger automated landed-cost costing distributions.
- `purchase_order_grn_mappings` -> Retroactive junction matrix allowing operators to link standalone receipts to purchasing contracts after execution.
- `purchase_invoices` & `purchase_invoice_items` -> Corporate financial liabilities and regional tax bookkeeping records.
- `stock_transfers` & `stock_transfer_items` -> Two-stage logistics matrix splitting dispatch from destination receipt and routing shortages to scrap or write-off nodes.
- `stock_transfer_incidents` -> Polymorphic ledger tracking en-route unexpected costs (tolls, vehicle breakdowns) with billable transporter flags.
- `transfer_discrepancy_claims` -> Settlement audit tracker for short-landed warehouse transfers.
- `item_valuations` -> Location-bound material repository tracking running quantities and true Moving Weighted Average Costs (MWAC).
- `inventory_buffer_thresholds` -> Safety triggers specifying min, max, and reorder point zones per branch warehouse.
- `inventory_ledger` -> Strict append-only tracking database engine with native triggers entirely prohibiting row updates or deletions.

## 4. Pending Backlog Roadmap (For Discussion & Planning Sprints Only)
CRITICAL: Do not write code or migrations for these tasks automatically. The user will initiate a planning chat to refine these points. Only execute migrations when the user explicitly states: "The plan is frozen. Please execute."

### Task Sequence 6 & 7: Progressive Outbound Trade, Cash Clearing Accounts, and Carrier Metrics [CURRENT MILESTONE]
- **Compile Omnichannel Commercial Matrices:** Map out progressive transaction ancestry pointers spanning Quotations, Sales Orders, Tax Invoices, and Shipments with structural fractional conversion guards.
- **Implement Triple-Vector Status Engines:** Segment tracking variables into concurrent Commercial, Logistical, and Financial states, dynamically assigning initial profiles using JSONB presets based on the originating storefront channel.
- **Enforce Contextual Multi-Conditional Return Policies:** Bridge a centralized Return Policies engine with channel rows to parse and validate eligibility based on promo codes, discount bounds, and expiration periods.
- **Deploy Cash Clearing & Bounding Packaging Metrics:** Connect three-tier gateway processing logs (Stripe/Razorpay) with automated ledger clearing. Bind real-time variant weight/volume fields to package objects to dynamically compute IATA billable coefficients.