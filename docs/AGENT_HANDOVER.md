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
- `supabase/migrations/20260527150000_create_sales_outbound_and_omnichannel_integrations.sql` -> Houses the progressive outbound trade engine, omnichannel conditional return engines, multi-vector state monitors, payment clearing paths, and the bounding-box packaging matrix.

## 3. Active System Tables Definition (Do Not Re-create)
The cloud database currently possesses exactly forty operational entity models, matching dependencies perfectly:
- `tenants` -> Primary corporate identities and root corporate tax definitions.
- `tenant_locations` -> Physical space branch networks, modified with regional tax identifiers and registered trade names.
- `users` -> Corporate workforce registry bound via custom private roles and department settings.
- `entities` -> Business partners profile center ('CUSTOMER', 'SUPPLIER', 'MUTUAL_PARTNER') with active credit tracking layers.
- `entity_contacts` -> Subsidiary human index ensuring single-primary contact index validation per account.
- `item_categories` -> Template trees handling relational parameters and schema-less item dynamic variable arrays.
- `items` & `item_variants` -> Structural parent-child master catalog splitting global parameters from individual physical child SKUs. Enforces explicit unboxed bounding dimensions (`length_cm`, `width_cm`, `height_cm`, `dead_weight_kg`) and contextual `is_returnable` flags.
- `item_uoms` -> Decoupled packaging conversion coefficient grids with strict positive multiplier controls.
- `supplier_items` -> Multi-vendor procurement catalogues enforcing preferred-source partial indexes.
- `price_books` & `price_book_entries` -> Multi-tier volume discount frameworks and currency matrices.
- `storefront_channels` & `storefront_items` -> Multi-brand commerce engines hosting visual style configurations, store-facing text overrides, linked custom return policies (`return_policy_id`), and automated channel tracking maps (`channel_lifecycle_presets`).
- `item_media` & `tags` -> Hierarchical asset and faceting tag directories.
- `workspace_control_registry` -> Centralized preference engine controlling feature gates (`is_po_mandatory_for_grn`, `is_qc_required_before_stocking`, `allow_negative_inventory`, `allow_line_item_discounts`).
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
- `sales_quotations` & `sales_quotation_items` -> Customer soft commercial estimates containing an explicit `valid_until` constraint check.
- `sales_orders` & `sales_order_items` -> The definitive sales agreements tracking concurrent Commercial, Logistical, and Financial status vectors with progressive ancestry tracking links (`source_quotation_id`).
- `sales_invoices` & `sales_invoice_items` -> The formal tax invoice registry tracking automated shipping-state regional nexus taxation matrices, line markdown gates, and global fulfillment counters.
- `sales_shipments`, `sales_shipment_packages` & `sales_shipment_items` -> Multi-package fulfillment dispatch framework tracking explicit box dimensions, scaled dead weights, and automated IATA volumetric and billable weight selection criteria while automatically computing real-time ledger-based COGS adjustments.
- `payment_gateway_vouchers` -> Decoupled three-tier cash clearing sub-ledger isolating gross, processing fee, and net reconciled revenue for Stripe/Razorpay automated webhooks.
- `customer_payments` & `payment_applications` -> Financial double-entry allocation matrices managing multi-invoice part-payments, customer balance liquification, and credit note distributions.
- `sales_credit_notes` & `sales_returns` / `sales_return_items` -> Audit-ready structural reversal ledgers checking dynamic multi-conditional channel return windows, discount caps, and promo code restrictions before moving units to available or scrap quarantine nodes.
- `document_approvals` -> Centralized hierarchical sign-off audit log preventing transaction downstream velocity until managerial authorization constraints are matched.
- `inventory_ledger` -> Strict append-only tracking database engine with native triggers entirely prohibiting row updates or deletions.

## 4. Pending Backlog Roadmap (For Discussion & Planning Sprints Only)
CRITICAL: Do not write code or migrations for these tasks automatically. The user will initiate a planning chat to refine these points. Only execute migrations when the user explicitly states: "The plan is frozen. Please execute."

### Task Sequence 8: Multi-Currency Exchange Volatility, Financial Accounting Ledgers, & Double-Entry Journal Triggers [NEXT MILESTONE]
- **Structure the Unified Chart of Accounts (COA):** Build a multi-tenant chart of accounts repository (`accounts`, `account_classes`) managing asset, liability, equity, revenue, and operational expense structures.
- **Implement Multi-Currency Volatility Matrices:** Create dynamic transaction logs tracking fluctuating currency pairs, baseline tenant currency hedges, and trigger-calculated exchange conversion deviations.
- **Deploy the Double-Entry General Ledger Engine:** Formulate transaction-isolated ledger maps (`general_ledger_entries`) driven by triggers on purchase invoices, sales dispatches, transport incidents, and payment vouchers to execute gapless debit-credit alignment.
- **Automate Dynamic Realized/Unrealized Gain & Loss Accounts:** Embed financial math routines calculating exchange rate deltas between order booking points, invoice timestamps, and payment applications to automatically write forex variances to specialized loss ledger channels.
### Task Sequence 6 & 7 Extension: Consumable Packaging & Material Depletion Matrices
- **Structure Consumable Rule Registries:** Build out the `packaging_consumable_rules` schema linking container dimensional formats (BOX_MEDIUM, PALLET) directly to structural packaging variants.
- **Automate Outbound Packaging Trigger Ledger:** Implement an AFTER INSERT trigger on `sales_shipment_packages` that automatically fires outbound reductions for packing materials inside `inventory_ledger` at the origin warehouse node.
- **Establish Return Recovery Loop Gates:** Implement an inbound ledger adjustment function attached to `sales_returns` that inspects item reusability flags, automatically restoring qualified plastic inserts or pallet units back to AVAILABLE stock blocks while generating write-off logs for unrecoverable cardboard items.