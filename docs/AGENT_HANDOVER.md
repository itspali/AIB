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
- `supabase/migrations/20260527123000_create_master_product_and_inventory_catalog.sql` -> Contains the single transaction migration wrapping the master product engines, decoupled pricing tiers, storefront configurations, multi-state branch compliance structures, and the append-only inventory ledger.

## 3. Active System Tables Definition (Do Not Re-create)
The cloud database currently possesses exactly thirteen operational entity models, matching dependencies perfectly:
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
- `inventory_ledger` -> Strict append-only tracking database engine with native triggers entirely prohibiting row updates or deletions.

## 4. Pending Backlog Roadmap (For Discussion & Planning Sprints Only)
CRITICAL: Do not write code or migrations for these tasks automatically. The user will initiate a planning chat to refine these points. Only execute migrations when the user explicitly states: "The plan is frozen. Please execute."

### Task Sequence 4: Core Procurement, Purchase Vouchers, & Automatic Stock Costing Engines [CURRENT MILESTONE]
- **Build Deterministic Voucher Sequences (`document_sequences` table):** Establish an isolated, atomic row-locking number generation mechanism scoped per tenant. This must support automated gapless alphanumeric voucher syntax (e.g., combining custom location codes, text prefixes, and padded incremental integers) for document generations to prevent double-save assignment bugs across concurrent transactions.
- **Build Core Procurement Transaction Layers:** Structure the unified dual-layer (Header/Line Item) relational matrices representing sequential supply chain procurement stages:
  - `purchase_orders` & `purchase_order_items` -> Capturing contractual procurement records, delivery dates, and decoupled vendor unit prices.
  - `goods_receipts` & `goods_receipt_items` (GRN) -> Establishing the explicit data entry vector to feed incoming quantities and landing asset parameters.
  - `purchase_invoices` & `purchase_invoice_items` -> Recording corporate financial liabilities and triggering localized accounts payable matrices.
- **Implement Automatic Stock Costing Engines:** Inject computational triggers tracking real-time material receipt lines. The system must capture auxiliary landing overheads (freight charges, local handling loading costs, import custom duties) and mathematically distribute them alongside raw item pricing into a true Landed Cost coefficient. This must dynamically write to `inventory_ledger.cost_at_transaction` to feed downstream inventory valuation engines (FIFO / Moving Weighted Average).
- **Incorporate Regional Invoice Compliance:** Ensure that line transactions automatically compute multi-state taxation rules (e.g., Intra-state CGST+SGST vs. Inter-state IGST) by executing contextual address evaluation handshakes matching the vendor's profile with the specific issuing branch's `tenant_locations.location_tax_identifier` data array.

## 5. Automation Commands & Git Operations
Whenever the user requests you to add, commit, and push changes to the repository, use the following chained terminal block. You may modify the string inside the `-m` flag to accurately reflect the development milestones completed:

```powershell
git add .; git commit -m "feat: deploy milestone 3 master product catalog, multi-brand themes, and append-only inventory ledger schemas"; git push origin develop