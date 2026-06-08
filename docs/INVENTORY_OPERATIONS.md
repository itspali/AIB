# Inventory Operations — Agent Handover & Roadmap

**Read this first** when working on stock, transfers, opening balances, inventory overview, or inbound procurement that touches on-hand quantities.

**Related docs:** [`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md) (global rules), [`DATA_STANDARDS.md`](./DATA_STANDARDS.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §9 (list-module pattern), [`NAVIGATION.md`](./NAVIGATION.md) (IA).

**Last updated:** 2026-06-08 (post Stock V1, Transfers V1, Overview Tier 1 polish, omnibar scopes).

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

- **Tier B** list modules share `ListModuleShell`, `ListModulePageTitleHeader`, column selector, sort, resize, freeze, and unified row hover/selection chrome (see [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §9).
- **Stock** balances/adjustments and **Transfers** filter via omnibar when scope is `stock` or `transfers` (`lib/search/scopes.ts`).
- **Transfers** list reads `?status=` once on mount for drill-down from overview (does not reset when drawer `?id=` opens).
- **Key paths:**
  - `apps/web/lib/inventory/stock/use-filtered-stock.ts`
  - `apps/web/lib/inventory/transfers/use-filtered-transfers.ts`
  - `apps/web/lib/inventory/transfers/navigation.ts` — `TRANSFER_STATUS_FILTER_PARAM`, `transfersHrefWithStatusFilter()`
  - `apps/web/lib/search/executor/client-scopes.ts` — `filterStockBalancesByAst`, `filterStockAdjustmentsByAst`, `filterTransfersByAst`

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

All inventory list modules follow **Items Master / Stock** pattern:

1. `app/.../page.tsx` → Suspense → `*-catalog-loader.tsx` (RSC fetch).
2. `*-management-terminal.tsx` — client list + `useModuleDrawerUrl`.
3. `*-drawer-form.tsx` — create / peek / edit surfaces.
4. `lib/.../queries.ts` — Supabase reads; `actions.ts` — RPC writes + `revalidatePath`.
5. Drawer `id` is client-only (`history.pushState`); omit from RSC `searchParams` on page.

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

- **Routes:** `/procurement/purchase-orders`, `/procurement/goods-receipts` — Tier B list modules.
- **Migration:** `20260608160000_procurement_grn_v1_rpcs.sql`
- **Defer:** full PO approval workflow, supplier portal, purchase invoices — unless scope expands.

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

### Recently shipped (2026-06-08 polish)

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
```

---

## 8. Smoke test checklist (regression)

1. Location has MWAC + `STOCK_ADJUSTMENT` / `STOCK_TRANSFER` prefixes.
2. Post a **correction** adjustment at one location — balance updates.
3. Product save with **opening stock** on a second location — one doc per location.
4. **Transfer:** draft → dispatch → receive — destination balance increases; in-transit clears.
5. Overview shows in-transit count; **In transit** card opens filtered transfers list; below-reorder **Adjust** / **Transfer** links work.
6. On `/inventory/stock` and `/inventory/transfers`, omnibar auto-selects module scope; text search filters the visible list.
