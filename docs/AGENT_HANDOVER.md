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
- `supabase/migrations/20260527134500_create_procurement_and_control_registry.sql` -> Houses core procurement transactional layers, multi-channel view layout templates, atomic serialization sequences, and custom functional logic compliance gates.

## 3. Active System Tables Definition (Do Not Re-create)
The cloud database currently possesses exactly twenty-two operational entity models, matching dependencies perfectly:
- `tenants` -> Primary corporate identities and root corporate tax definitions.
- `tenant_locations` -> Physical space branch networks (HQ, warehouses, counters), modified with location_tax_identifier (e.g., State GSTINs) and tax_registered_name columns.
- `users` -> Corporate workforce registry bound via custom private department, role, and workspace parameters.
- `entities` -> Business partners profile center ('CUSTOMER', 'SUPPLIER', 'MUTUAL_PARTNER') with active credit tracking and progressive form-hiding logic based on tax treatments.
- `entity_contacts` -> Subsidiary human index with direct phone/mobile/whatsapp parameters and single-primary contact index validation.
- `item_categories` -> Template trees handling relational parameters and dynamic user-attribute templates.
- `items` -> Parent product masters controlling operational trade gates (is_purchasable, is_salable) and variant tracking definitions.
- `item_variants` -> Physical child SKUs with multi-tenant custom layout protections and distinct volumetric attributes.
- `item_uoms` -> Decoupled packaging conversion coefficient grids with strict positive multiplier controls.
- `supplier_items` -> Multi-vendor item procurement catalogues enforcing preferred-source partial indexes.
- `price_books` & `price_book_entries` -> Multi-tier volume discount frameworks and currency matrices.
- `storefront_channels` & `storefront_items` -> Multi-brand retail engines hosting distinct domain routes, visual theme configurations, and custom product display parameters.
- `item_media` & `tags` -> Hierarchical asset and faceting tag directories.
- `workspace_control_registry` -> Centralized preference engine capturing configuration scopes (Tenant, Store, Module, Layout) along with custom transaction series strings and workflow gates (`is_po_mandatory_for_grn`, `is_qc_required_before_stocking`).
- `document_layout_templates` -> Cross-channel view design matrix handling explicit presentation rules for `SCREEN_GRID`, `PDF_PRINT`, and `EMAIL_HTML` contexts.
- `document_sequences` -> Transaction-isolated series counter utilizing explicit row-locking block mechanics.
- `purchase_orders` & `purchase_order_items` -> Contractual purchasing records, custom pricing layers, and fulfillment metrics.
- `goods_receipts` & `goods_receipt_items` -> Asynchronous material receiving logs that trigger automated landed-cost costing distributions.
- `purchase_order_grn_mappings` -> Retroactive junction matrix allowing operators to link standalone receipts to purchasing contracts after execution.
- `purchase_invoices` & `purchase_invoice_items` -> Corporate financial liabilities and regional tax bookkeeping records.
- `inventory_ledger` -> Strict append-only tracking database engine with native triggers entirely prohibiting row updates or deletions.

## 4. Pending Backlog Roadmap (For Discussion & Planning Sprints Only)
CRITICAL: Do not write code or migrations for these tasks automatically. The user will initiate a planning chat to refine these points. Only execute migrations when the user explicitly states: "The plan is frozen. Please execute."

### Task Sequence 5: Inventory Valuation, Multi-Warehouse Transfers, & Auto-Rebalancing [CURRENT MILESTONE]
- **Build Inter-Warehouse Stock Transfers Module:** Structure header-and-line data matrices (`stock_transfers` / `stock_transfer_items`) to track the explicit physical movement of assets between separate `tenant_locations`. The system must split movements into distinct transaction stages: `DISPATCHED_IN_TRANSIT` (deducting available stock from the source warehouse and shifting it to an in-transit buffer account) and `ARRIVED_RECEIVED` (landing the items into the destination warehouse node and completing the transaction chain).
- **Implement Real-time Moving Weighted Average Costing Engine (MWAC):** Create database-level triggers to dynamically compute an item's current unit valuation whenever an inbound transaction occurs. It must automatically adjust values based on the formula:
  $$\text{New Average Cost} = \frac{(\text{Current Stock Qty} \times \text{Current Avg Cost}) + (\text{Inbound Qty} \times \text{Inbound Landed Cost})}{\text{Current Stock Qty} + \text{Inbound Qty}}$$
  This cost value must be tracked in a specialized `item_valuations` profile table per location and used to dynamically stamp downstream material costs.
- **Build Automated Rebalancing & Low-Stock Alert Engine:** Establish data structures allowing managers to set explicit inventory buffer thresholds (`min_stock_level`, `max_stock_level`, `reorder_point_qty`) per item variant per warehouse node. Implement background database triggers or optimized view mirrors that automatically flag deficit items, trigger low-stock alerts, and format automated reorder recommendation sheets based on preferred supplier listings.
- **Enforce Warehouse Lockout Preferences under Control Centre:** Expand the `workspace_control_registry` configuration parameters to allow admins to declare whether negative stock balances are legally permitted under physical modules (`allow_negative_inventory`). If set to `FALSE`, the database layer must explicitly intercept and block any sales, dispatches, or transfer rows that would drive current stock below `0.0000`.

## 5. Automation Commands & Git Operations
Whenever the user requests you to add, commit, and push changes to the repository, use the following chained terminal block. You may modify the string inside the `-m` flag to accurately reflect the development milestones completed:

```powershell
git add .; git commit -m "feat: deploy milestone 4 procurement engine tables, atomic sequence lockers, and dynamic layout templates"; git push origin develop