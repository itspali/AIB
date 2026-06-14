# Inventory Operations — Agent Handover & Roadmap

**Read this first** when working on stock, transfers, opening balances, inventory overview, or inbound procurement that touches on-hand quantities.

**Related docs:** [`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md) (global rules), [`DATA_STANDARDS.md`](./DATA_STANDARDS.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §9 (list-module pattern), [`NAVIGATION.md`](./NAVIGATION.md) (IA), [`PROCUREMENT_BILLING.md`](./PROCUREMENT_BILLING.md) (bills / three-way match).

**Last updated:** 2026-06-14 (GRN QC/reject/landed cost; procurement bills cross-link).

---

## 1. What is done (shipped)

### Inventory module routes (`module-nav.tsx`)

| Route | Status | Purpose |
|-------|--------|---------|
| `/inventory` | **Built** | Overview — KPIs, below-reorder actions, recent transfers & adjustments |
| `/inventory/stock` | **Built** | On-hand balances + posted adjustments |
| `/inventory/transfers` | **Built** | Draft → dispatch → receive workflow |
| `/inventory/items`, `/inventory/categories` | **Built** | Catalog aliases (same as `/items`, `/items/categories`) |
| `/settings/locations` | **Built** | Location topology + per-location document numbering & sequence counters |

**Items catalog** lives under the separate **Items** primary module (`/items`, `/items/categories`), not under Inventory children.

### Stock (`/inventory/stock`)

- **Balances** from `item_valuations` (location × variant, MWAC on-hand).
- **Adjustments** via `post_stock_adjustment` RPC → `inventory_ledger` → MWAC trigger.
- **Kinds:** `OPENING`, `CORRECTION`, `WRITE_OFF`.
- **Drawer URL:** `?id=`, `?action=new`, `?variant=`, `?loc=` (balance row → Adjust prefill).
- **Key paths:**
  - UI: `apps/web/components/inventory/stock/`
  - Lib: `apps/web/lib/inventory/stock/`
  - Actions: `apps/web/app/inventory/stock/actions.ts`
  - Migration: `supabase/migrations/20260607190000_stock_adjustments.sql`

### Opening stock (product editor — Reach)

- Variant×location grid in product editor; posts grouped opening adjustments per location on save.
- Uses same `post_stock_adjustment` with `kind: OPENING`.
- **Key paths:**
  - `apps/web/lib/products/opening-stock.ts`
  - `apps/web/components/products/variant-opening-stock-matrix.tsx`
  - `apps/web/app/items/actions.ts` — `postItemOpeningStock`, `getItemOpeningStockOnHand`

### Transfers (`/inventory/transfers`)

- **Statuses used in V1:** `DRAFT` → `DISPATCHED_IN_TRANSIT` → `FULLY_COMPLETED` | `RECEIPT_DISCREPANCY` (+ `CANCELLED` for drafts).
- **RPCs** (`supabase/migrations/20260608120000_stock_transfer_rpcs.sql`):
  - `save_stock_transfer`
  - `dispatch_stock_transfer`
  - `receive_stock_transfer`
  - `cancel_stock_transfer`
- **Ledger:** `stock_transfers_status_transition` trigger on status update (source → in-transit → destination / scrap / loss).
- **Drawer:** create / edit draft / peek dispatch / receive with accepted+damaged+lost split.
- **Overhead:** freight, loading, unloading on draft (allocated on receipt).
- **Drawer URL prefill:** `?action=new&variant=&dest=&src=`
- **Key paths:**
  - UI: `apps/web/components/inventory/transfers/`
  - Lib: `apps/web/lib/inventory/transfers/`
  - Actions: `apps/web/app/inventory/transfers/actions.ts`

### Inventory overview (`/inventory`) — Tier 1

- Metrics: valuation, below reorder, **in transit**, stocked balances.
- **In transit** metric card links to `/inventory/transfers?status=DISPATCHED_IN_TRANSIT` (filtered transfers list).
- **Below reorder** table (≤12 rows): **Adjust** → stock drawer; **Transfer** → transfers drawer (suggests surplus source location when another site holds the same SKU).
- Recent transfers + recent adjustments with deep links.
- **Key paths:**
  - `apps/web/components/inventory/inventory-overview-terminal.tsx`
  - `apps/web/components/inventory/inventory-below-reorder-section.tsx`
  - `apps/web/lib/inventory/overview/`
  - `apps/web/lib/inventory/overview/reorder-links.ts`

### List-module UI parity (Stock / Transfers / PO / GRN)

- **Tier B** list modules share `ListModuleShell`, `ListModulePageTitleHeader`, column selector, sort, resize, freeze, and unified row hover/selection chrome from `lib/layout/list-table-chrome.ts` (see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §9).
- **Document line-entry drawers** (PO, GRN, stock adjustments, transfers) use `DocumentLineEntryGrid`, drawer-width-aware headers, and responsive line layout — see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §5.4 and [`PO_UX_PLAN.md`](./PO_UX_PLAN.md) for procurement specifics.
- **Stock** balances/adjustments and **Transfers** filter via omnibar when scope is `stock` or `transfers` (`lib/search/scopes.ts`).
- **Transfers** list reads `?status=` once on mount for drill-down from overview (does not reset when drawer `?id=` opens).
- **PO → GRN:** peek **Receive** opens `/procurement/goods-receipts?action=new&po=[uuid]`.
- **Key paths:**
  - `apps/web/lib/inventory/stock/use-filtered-stock.ts`
  - `apps/web/lib/inventory/transfers/use-filtered-transfers.ts`
  - `apps/web/lib/inventory/transfers/navigation.ts` — `TRANSFER_STATUS_FILTER_PARAM`, `transfersHrefWithStatusFilter()`
  - `apps/web/lib/procurement/navigation.ts` — `PROCUREMENT_PO_HREF`, `PROCUREMENT_GRN_HREF`, `GRN_DRAWER_PO_PARAM`
  - `apps/web/lib/search/executor/client-scopes.ts` — `filterStockBalancesByAst`, `filterStockAdjustmentsByAst`, `filterTransfersByAst`
  - `apps/web/components/documents/` — shared line-entry grid + peek table
  - `apps/web/lib/documents/use-document-line-table-fill-height.ts` — md+ line table fills drawer height

### GRN QC, reject lines, and landed cost (2026-06-14)

Receipt posting (`post_goods_receipt`) supports partial accept/reject, QC routing, and freight/landed charge allocation.

| Feature | Behavior |
|---------|----------|
| **QC policy** | Layered `qc_receipt_policy` on category/item (`INHERIT` / `REQUIRED` / `EXEMPT`); org flag `is_qc_required_before_stocking` in procurement settings |
| **Accept / reject qty** | Line fields `quantity_accepted`, `quantity_rejected`; only accepted qty posts to stock and counts toward PO `quantity_received` |
| **Reject disposition** | `reject_disposition` enum: `RTV`, `SCRAP`, `DAMAGE`, `SHRINK` + optional `reject_reason` |
| **QC override** | Per-line `route_to_qc` override when policy allows |
| **Landed charges** | `p_landed_charges` JSON → `goods_receipt_landed_charges`; allocation `BY_QUANTITY` / `BY_VALUE` / `BY_WEIGHT`; posting step `grn_landed_charges_allocated` |
| **Billing link** | Bill three-way match uses **accepted** GRN qty per PO line — see [`PROCUREMENT_BILLING.md`](./PROCUREMENT_BILLING.md) |

**Migrations:**
- `20260612180000_grn_accept_reject_lines.sql` — accept/reject on receipt lines
- `20260612260000_grn_exception_workflow_qc_policy.sql` — QC policy resolution + exception workflow
- `20260622100000_reconcile_post_goods_receipt_qc_exception.sql` — reject disposition + reconcile with promo/QC
- `20260620200000_procurement_promo_engine.sql` — landed charges table + allocation in `post_goods_receipt`

**UI:** GRN drawer — landed cost panel (`GrnLandedCostPanel`), accept/reject columns when QC enabled; `apps/web/lib/procurement/goods-receipts/landed-cost-allocation.ts` mirrors server allocation preview.

### Document drawer UX (Stock / Transfers / GRN parity — 2026-06-09)

Shared with PO where noted in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §5.4:

| Change | Modules | Implementation |
|--------|---------|----------------|
| **Line table fill height** | PO, GRN, stock adjustment, transfer draft | `useDocumentLineTableFillHeight()` → `fillHeight` on `DocumentLineEntryGrid`; drawer `scrollable={false}` on md+ mutate |
| **Trailing blank row** | All line-entry drawers | `ensureTrailingEmptyLine` (PO); `isDocumentLineItemSelected` + item pick adds row without qty (GRN, stock, transfer) |
| **No duplicate SKU** | GRN, stock, transfer | SKU only as combobox secondary text — removed extra `{variant_sku}` row under `StockVariantSkuField` |
| **Header actions only** | GRN, stock, transfer create/edit | Primary save/post in drawer header; no redundant **Cancel** — dirty close via **X** + `useDiscardChangesConfirmation`. Transfer keeps **Cancel transfer** as a lifecycle RPC, not navigation. |
| **Stock adjustment header** | Stock create/edit | `StockAdjustmentMutateForm`: Location + Kind + Reason; at **40vw peek** → 2 cols + Reason full width; at **60/80vw** → 3 cols one row; Notes below lines table |

**Key paths:**
- `apps/web/components/inventory/stock/stock-drawer-form.tsx` — `StockAdjustmentMutateForm`
- `apps/web/components/inventory/transfers/transfer-drawer-form.tsx`
- `apps/web/components/procurement/goods-receipts/grn-drawer-form.tsx`
- `apps/web/lib/documents/line-entry.ts` — `isDocumentLineItemSelected`

### Document numbering (per location)

- Stock-holding locations need prefixes for `STOCK_ADJUSTMENT` and `STOCK_TRANSFER` (among others).
- **UI:** Locations settings → Document Numbering + live sequence counters; admins can set **next value** on save.
- **Migrations:**
  - `20260608130000_location_document_sequence_counters.sql`
  - `20260608150000_default_location_document_naming_prefixes.sql`
  - `20260607190000_stock_adjustments.sql` — `reconcile_document_sequence` for adjustments & transfers
- **Errors:** friendly copy + link to `/settings/locations` via `lib/inventory/stock/rpc-errors.ts` and `lib/inventory/transfers/rpc-errors.ts`.

### Tests (`apps/web/lib/inventory/__tests__/`)

- `overview-snapshot.test.ts`, `transfer-schemas.test.ts`, `receipt-validation.test.ts`
- `valuation-engine.test.ts`, `stock-rpc-errors.test.ts`, `stock-list-sort.test.ts`, `stock-variant-eligibility.test.ts`
- `transfers-navigation.test.ts` — in-transit drill-down URL helper
- Omnibar client filters: `lib/search/__tests__/client-scopes.test.ts`, `lib/search/__tests__/module-route-scope.test.ts`
- Vitest include glob: `lib/inventory/__tests__/**/*.test.ts`

---

## 2. V1 rules (do not break without explicit plan)

| Rule | Detail |
|------|--------|
| **Tracking** | Only `tracking_mode = NONE` (quantity-tracked) for adjustments & transfers. LOT/SERIAL blocked with user-facing error. |
| **Valuation** | Stock postings require **MWAC** at location (or item). FIFO org/location/item default blocks postings until switched. See `lib/inventory/stock/valuation-engine.ts`. |
| **Opening stock** | Only non-sellable style anchors excluded; cell locks after on-hand > 0 at location. |
| **Adjustments** | One document per **location**; many variant lines. Number from location's `STOCK_ADJUSTMENT` sequence. |
| **Transfers** | Number from **source** location's `STOCK_TRANSFER` sequence. |
| **PostgREST embeds** | Use explicit FK hints + aliases when joining `tenant_locations` twice or `stock_transfer_items`. See `lib/inventory/transfers/queries.ts`. |

---

## 3. UI pattern (mirror for new list modules)

All inventory and procurement list modules follow the **Tier B** pattern in [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §3.7 + §9:

1. `app/.../page.tsx` → Suspense → `*-catalog-loader.tsx` (RSC fetch).
2. `*-management-terminal.tsx` — client list + `useModuleDrawerUrl` + `ListModuleShell`.
3. `*-drawer-form.tsx` — create / peek / edit surfaces (`RightDrawer`, URL-driven).
4. `lib/.../queries.ts` — Supabase reads; `actions.ts` — RPC writes + `revalidatePath`.
5. Drawer `id` is client-only (`history.pushState`); omit from RSC `searchParams` on page.

**Multi-line documents** (PO, GRN, stock adjustments, transfers, future Sales orders/invoices) additionally follow §5.4 — `DocumentLineEntryGrid`, `useDocumentLineTableFillHeight`, column registry in `lib/documents/` where applicable, drawer-width-aware header grids (`useRightDrawerLayout` / `isNarrowRightDrawer`).

---

## 4. Explicitly deferred (not built)

| Area | Notes |
|------|--------|
| Transfer `PENDING_APPROVAL` workflow | Schema exists; no UI/RPC path |
| `stock_transfer_incidents` UI | Toll, freight incidents |
| `transfer_discrepancy_claims` UI | Receipt discrepancy follow-up |
| `can_manage_stock` permissions | All authenticated tenant users |
| Opening post idempotency | `source_system` / `source_document_id` on adjustments — RPC supports, product save doesn't use yet |
| FIFO cost layers | Backend stub; postings blocked client-side |
| LOT / SERIAL traceability | Future posting model |
| Live Supabase RPC integration tests | Unit tests only |

---

## 5. Updated plan (priority order)

### Tier 2 — Procurement inbound [IMPLEMENTED — Sequence 21]

- **Routes:** `/procurement/purchase-orders`, `/procurement/goods-receipts`, `/procurement/bills` — Tier B list modules with line-entry drawers (§5.4).
- **Migrations:** `20260608160000_procurement_grn_v1_rpcs.sql`, `20260611140000_purchase_order_v1_ux_rpcs.sql`, `20260622110000_procurement_billing_three_way_gl.sql`, `20260622120000_procurement_po_approval.sql`
- **UX plan:** [`PO_UX_PLAN.md`](./PO_UX_PLAN.md) — Phase 2 **shipped**; Phase 3 **shipped** (discounts, tax, line UOM, PO approval).
- **Billing:** [`PROCUREMENT_BILLING.md`](./PROCUREMENT_BILLING.md) — three-way match, `quantity_invoiced`, AP posting gates.
- **Shipped (Phase 2):** omnibar `purchase-orders`, duplicate/copy, full-page routes, per-location layout overrides (`20260615100000_document_layout_location_scope.sql`).
- **Defer:** supplier portal UI polish — unless scope expands.

### Tier 2b — Remaining inventory polish

| Slice | Status | Notes |
|-------|--------|-------|
| In-transit metric → filtered transfers list | **Done** | `transfersHrefWithStatusFilter("DISPATCHED_IN_TRANSIT")` |
| Omnibar stock + transfer search | **Done** | Scopes `stock`, `transfers` in `lib/search/scopes.ts` |
| Transfer approval workflow | Deferred | Schema exists; no UI/RPC path |
| Incidents / discrepancy claims UI | Deferred | `stock_transfer_incidents`, `transfer_discrepancy_claims` |

### Tier 3 — Outbound & platform

- Sales orders → shipments → stock out
- Permissions hardening
- FIFO layers implementation

---

## 6. What to execute next (for a new chat)

**Default recommendation:** confirm scope with the user — net-new domains (Sales UI, Financials, RBAC) or remaining inventory deferred items (transfer approval, incidents UI, permissions hardening).

### Recently shipped (2026-06-14)

1. **Procurement bills UI** — `/procurement/bills` list + drawer; GRN link panel; match status badges.
2. **Three-way match + AP posting** — `save_purchase_invoice` qty gate, `quantity_invoiced`, `bill_payables_posted` (`20260622110000_*`).
3. **PO approval workflow** — submit/approve/reject RPCs + `document_approval_requests` (`20260622120000_*`).
4. **GRN QC/reject reconcile** — accept/reject qty, reject disposition, landed charges posting step (`20260622100000_*`).

### Recently shipped (2026-06-10)

1. **PO Phase 2 complete** — omnibar `purchase-orders`, duplicate/copy, full-page routes, per-location layout overrides, Print/Email layout tabs in settings.
2. **PO Phase 3 started** — line discounts; line tax via `resolve_line_tax` + live totals rail; editable line UOM with `item_uoms` validation on save.

### Previously shipped (2026-06-09 polish)

1. **PO V1 UX** — spreadsheet line entry, supplier intelligence, totals rail, voucher preview ([`PO_UX_PLAN.md`](./PO_UX_PLAN.md)).
2. **GRN V1** — receive against PO or standalone; shared `DocumentLineEntryGrid`.
3. **List-module chrome parity** — Stock, Transfers, PO, GRN share `list-table-chrome.ts` hover/selection band + column hooks.
4. **Document drawer UX** — line tables fill drawer height on md+ (`useDocumentLineTableFillHeight`); auto trailing blank rows; no duplicate SKU under item fields; GRN/Stock/Transfer save via header only (no redundant Cancel); stock adjustment header uses drawer-width grid (Location/Kind/Reason).

### Previously shipped (2026-06-08)

1. Category loading skeleton — single full-width panel (`category-catalog-page-skeleton.tsx`).
2. Overview **In transit** → `/inventory/transfers?status=DISPATCHED_IN_TRANSIT`.
3. Omnibar scopes **`stock`** and **`transfers`** with client-side AST/text filtering.

### Optional next inventory slices

- Transfer `PENDING_APPROVAL` workflow UI
- `stock_transfer_incidents` / `transfer_discrepancy_claims` follow-up screens
- `can_manage_stock` permission hardening

### Before any schema change

- Read [`SUPABASE_CI_MIGRATION_ERRORS.md`](./SUPABASE_CI_MIGRATION_ERRORS.md).
- Ship SQL via Git → `develop`; **no local `supabase db push`** ([`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md) §2).

---

## 7. Quick file index

```
apps/web/
  app/inventory/
    page.tsx              # Overview loader
    stock/                # Stock module
    transfers/            # Transfers module
  app/procurement/
    purchase-orders/      # PO module
    goods-receipts/       # GRN module
    bills/                # Vendor bills module
  components/documents/   # Shared line-entry grid + peek table
  lib/documents/          # Column registries, line-entry helpers, use-document-line-table-fill-height.ts
  lib/procurement/        # PO + GRN + bills queries, schemas, list prefs
  lib/inventory/
    stock/                # Balances, adjustments, valuation-engine
    transfers/            # Transfers queries, schemas, receipt-validation
    overview/             # Overview snapshot + reorder deep links
    __tests__/            # Unit tests

supabase/migrations/
  20260527143000_create_inventory_transfers_and_valuation.sql
  20260603000000_location_valuation_calculation_rule.sql
  20260607190000_stock_adjustments.sql
  20260608120000_stock_transfer_rpcs.sql
  20260608130000_location_document_sequence_counters.sql
  20260608150000_default_location_document_naming_prefixes.sql
  20260608160000_procurement_grn_v1_rpcs.sql
  20260611140000_purchase_order_v1_ux_rpcs.sql
  20260612180000_grn_accept_reject_lines.sql
  20260612260000_grn_exception_workflow_qc_policy.sql
  20260620200000_procurement_promo_engine.sql
  20260622100000_reconcile_post_goods_receipt_qc_exception.sql
  20260622110000_procurement_billing_three_way_gl.sql
  20260622120000_procurement_po_approval.sql
```

---

## 8. Smoke test checklist (regression)

1. Location has MWAC + `STOCK_ADJUSTMENT` / `STOCK_TRANSFER` prefixes.
2. Post a **correction** adjustment at one location — balance updates.
3. Product save with **opening stock** on a second location — one doc per location.
4. **Transfer:** draft → dispatch → receive — destination balance increases; in-transit clears.
5. Overview shows in-transit count; **In transit** card opens filtered transfers list; below-reorder **Adjust** / **Transfer** links work.
6. On `/inventory/stock` and `/inventory/transfers`, omnibar auto-selects module scope; text search filters the visible list.
7. Stock adjustment create at **40vw**: Location + Kind on one row, Reason on next row; at **60vw+** all three on one row; line table scrolls inside drawer on md+.
8. GRN / stock / transfer line entry: picking an item appends a trailing blank row; no duplicate SKU text under the item field.
9. **Extended procurement smoke** (`SMOKE_EXTENDED=1`): landed charges step, bill qty mismatch rejection, `bill_payables_posted` — see [`PROCUREMENT_BILLING.md`](./PROCUREMENT_BILLING.md) §6.
