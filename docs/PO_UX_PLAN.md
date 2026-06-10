# Purchase Order UX & Document Layout Plan

**Status:** Phase 1 (V1) **shipped** — Phase 2 **shipped** — Phase 3 **in progress** (discounts, tax, and line UOM shipped; approval deferred)  
**Related:** [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §3.7 + §5.4, [`DATA_STANDARDS.md`](./DATA_STANDARDS.md)

---

## Module settings IA (Phase 2 UI)

Document and module preferences live under **Administration → Module settings** (not Organization Settings).

| Route | Purpose |
|-------|---------|
| `/settings/modules` | Hub — Procurement (active), Inventory / Sales / Fulfillment (soon) |
| `/settings/modules/procurement` | Tabs: **Document layout** (V1 UI) · **Policies** (soon) |

**Scope:** Location dropdown enabled when `LOCATION_LAYOUT_OVERRIDES_ENABLED`. Code uses `DocumentLayoutScope` (`tenant` \| `location`). Runtime resolver: `resolveEffectiveDocumentLayout()` (location override → tenant default → code default).

**V1 vs V2:**

| V1 (UI) | V2 (wire) |
|---------|-----------|
| Layout editor + preview + drag reorder | Persist `document_layout_templates` (+ nullable `location_id`) **shipped** |
| Mock save (`savePurchaseOrderDocumentLayout` validates only) | PO drawer / peek consume `resolveEffectiveDocumentLayout` **shipped** |
| On-screen tab only | Print / Email tabs enabled in settings (runtime renderer = Phase 4) |

---

## Goals

1. **PO V1** — Fast, spreadsheet-style create/edit in a wide drawer with live totals, supplier intelligence, and scan-friendly line entry.
2. **Document layout engine** — Tenant-configurable columns/labels/print (phased); starts with code defaults consumed by PO UI.
3. **Cross-module reuse** — Same patterns for GRN, stock adjustments, stock transfers, Sales Order, Quotation, Invoice later.

---

## Architecture layers

| Layer | Storage | Purpose |
|-------|---------|---------|
| **Policy** | `workspace_control_registry` (`PROCUREMENT_SETTINGS`, `SALES_SETTINGS`) | Allow discounts, PO mandatory for GRN, etc. |
| **Layout** | `document_layout_templates` (per `module_key` + `view_context`) | Column visibility, labels, typography, **decimal places** (screen / PDF / email) |
| **Layout JSON** | `grid_columns_json`, `line_item_formatting` | Column defs; per-field `decimalPlaces` for numeric columns (see below) |
| **Custom field defs** | Layout JSON or future `document_custom_field_definitions` | Tenant-defined header/line fields |
| **Document values** | `purchase_orders.custom_fields`, line `custom_fields` | Runtime data per PO |

### Layout JSON shape (Phase 2 target)

`grid_columns_json` — array of column prefs (mirrors `DocumentColumnPref`):

- `id`, `label`, `defaultVisible`, `align`, `typography`
- **`decimalPlaces`** (optional, numeric columns only) — display rounding for screen / print / email independently per column

Suggested defaults (tenant-overridable):

| Field group | Column ids | Default `decimalPlaces` | Notes |
|-------------|------------|-------------------------|--------|
| Quantity | `quantity_ordered`, `quantity_received` | **3** | Matches operational qty entry; storage remains `NUMERIC(15,4)` per [`DATA_STANDARDS.md`](./DATA_STANDARDS.md) |
| Money | `unit_price`, `line_total`, `discount_amount`, totals | **2** | ISO-style display; allow 0–4 in settings |
| Percent | `discount_pct` | **2** | |
| Text / refs | `item`, `unit`, header fields | — | No decimal setting |

`line_item_formatting` — optional per-column overrides keyed by column `id` (same `decimalPlaces` + typography when not inlined in `grid_columns_json`).

Shared formatter: `formatDocumentField(value, columnPref, tenantCurrency)` consumed by PO UI, peek, and print renderer (Phase 4).

---

## Phase 1 — PO V1 UX [SHIPPED]

**Scope:** Drawer-first operational PO; no org settings UI for layout yet.

### Shipped in V1

- Tier B list module — `ListModuleShell`, column selector, sort, resize, freeze, muted row hover/selection (`list-table-chrome.ts`).
- Wide drawer layout for create/edit — responsive lines + side rail (summary + details); peek uses opaque `module-drawer-*` surfaces.
- **Line table fill height** — `useDocumentLineTableFillHeight` on md+; lines scroll inside the drawer (`fillHeight` + `scrollable={false}`); shared with GRN, stock, transfer ([`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §5.4).
- **Spreadsheet line table** via `DocumentLineEntryGrid` (item, qty, unit price ex-tax, line total, remove).
- **Unified scan + search** — GTIN/barcode then SKU per tenant `scan_identifier_policy`; Enter resolves.
- **Searchable supplier combobox** + **Create supplier…** link (`/entities/suppliers?action=new`).
- **Supplier prefill** — `payment_terms_days` from entity; **unit price** from `supplier_items` (variant → item fallback).
- **PO number preview** — `peek_document_voucher_string` RPC (no sequence consume until save); inline edit on saved drafts.
- **Totals rail** — sticky right on wide drawer, stacked on mobile (subtotal, line count; tax placeholder 0).
- **Advanced header fields** — requisition #, expected delivery, internal notes → `custom_fields`; payment terms days.
- **Layout defaults** — `lib/documents/purchase-order-layout.ts` registry (columns for future settings UI).
- **GRN cross-link** — peek **Receive** → `/procurement/goods-receipts?action=new&po=[uuid]`.
- **Trailing blank row** — `ensureTrailingEmptyLine` on PO lines; GRN/stock/transfer use `isDocumentLineItemSelected` (row added when item is picked).
- **Mutate header** — primary save in drawer header; no redundant Cancel (dirty close via X + discard confirmation).
- **RPC** — extend `save_purchase_order` with `p_payment_terms_days`, `p_custom_fields`.

### Explicitly out of V1

- Line / header **discount** columns (registry IDs reserved; policy + schema in Phase 3).
- **Line unit (UoM)** column — see Phase 2 (read-only); editable alternate-UOM lines in Phase 3+.
- Per-field **decimal places** — hard-coded formatters in V1 (`formatPoMoney` 2–4 dp); layout settings in Phase 2.
- Document layout **settings UI**.
- Print / PDF renderer.
- Full-page PO route.
- Attachments.
- PO number **manual override** (Phase 2).
- Tax line calculation (Phase 3).

### Acceptance (smoke)

1. New PO at 60vw drawer; preview PO number updates when destination changes.
2. Scan GTIN or type SKU → line resolves; qty receives focus.
3. Change supplier → payment terms + line price from supplier catalog when available.
4. Totals update live; save persists header fields; issue unchanged.

---

## Phase 2 — Document layout settings + PO polish [SHIPPED]

- **Module settings** → Procurement → **Document layout** (`/settings/modules/procurement`).
- Wire PO form/peek/print preview to `document_layout_templates` (seed defaults migration; add nullable `location_id`).
- **Per-field decimal places** — settings UI + `decimalPlaces` on numeric columns (defaults: qty **3**, money **2**).
- **Column reorder** — drag handles on header / line / totals lists; `lineColumnOrder`, `headerFieldOrder`, `totalsFieldOrder` on template JSON; `item` pinned first on lines.
- **Item unit column** — optional line column `unit` (read-only): `purchase_uom` → `base_unit_of_measure`.
- Drawer uses compact primary/nested split; peek/print use flat ordered visible columns (preview toggles both modes).
- User overrides for screen (optional localStorage).
- PO number manual override (admin-gated RPC).
- **Expand to full page** action for 15+ lines.
- Duplicate PO / copy lines.
- Omnibar scope `purchase-orders`.

### PO layout settings — field inventory (On-screen)

**Shell:** location scope (All locations) · view tabs (On-screen \| Print \| Email) · reset · save · live preview

**Header fields:** `supplier`, `destination`, `currency`, `voucher_number`, `payment_terms_days`, `requisition_number`, `expected_delivery_date`, `internal_notes`, `document_status`, `updated_at` — each: visible, label, reorder

**Line columns:** `item` (pinned), `quantity_ordered`, `unit`, `unit_price`, `line_total`, `discount_pct` / `discount_amount` — each: visible, label, align, decimal places (where numeric), reorder. Default: **Discount** column with **% | Amt** type stacked under the value (like unit under qty); enable **Disc amount** as a separate column in layout for split percent/amount columns. Discount columns require `PROCUREMENT_SETTINGS.allow_line_item_discounts` (mirrors org Accounting toggle).

**Item catalog fields (read-only, from item master):** resolved at line pick from `items` / `item_variants` / category attribute templates — not stored on PO until Issue snapshot (future). Layout ids: `variant_attr:__all__`, `variant_attr:{key}`, `item_col:{key}`, `item_cf:{key}`. Default on: all variant attributes under item cell. Settings section **Item catalog fields** — add HSN, description, base unit, tenant custom field keys, individual category attributes; same Place / Label / Flow prefs as commercial line fields.

**Peek line (registry):** `quantity_received` — decimals default 3

**Totals:** `line_count`, `subtotal_ex_tax`, `transaction_discount` (trade discount), `tax_amount`, `grand_total` — visible, label, align, decimals, reorder

**Line images:** `image_display_mode` (`INLINE_CELL` \| `SEPARATE_COLUMN` \| `HIDDEN`) — on-screen drawer and print

| **Per-column pref shape:** `id`, `label`, `defaultVisible`, `align`, `decimalPlaces`, `lineSlot` (`column` \| `item_detail`), `showLabel`, `itemDetailFlow` (`new_line` \| `inline_previous`), `catalogSource`, `catalogSourceKey`, `typography` (`fontSize`, `fontWeight`, `fontStyle`) — **Size / Wt / Ital** columns in settings UI (V2)

**Not in document layout settings:** PO **list** columns (`PO_LIST_COLUMN_IDS` — list toolbar column settings)

---

## Phase 3 — Commercial depth (procurement) [IN PROGRESS]

| Slice | Status | Notes |
|-------|--------|-------|
| Line discounts | **Shipped** | `discount_percentage` / `discount_amount` on `purchase_order_items`; `save_purchase_order` totals; `PROCUREMENT_SETTINGS.allow_line_item_discounts`; drawer + layout settings |
| Transaction trade discount | **Shipped** | Header `transaction_discount_*` on `purchase_orders`; Summary row after subtotal; proportional GST base reduction; `allow_transaction_discounts` policy + layout visibility |
| Tax mode + line tax | **Shipped** | `purchase_prices_tax_inclusive` policy; `resolve_line_tax` in save RPC; live totals from item `tax_codes` |
| Layout tax columns | **Shipped** | Totals rail `tax_amount` + `grand_total` use computed tax |
| Editable line UOM | **Shipped** | Line `uom_code` + `uom_conversion_factor`; validate against `item_uoms` on save; compact select when alternates exist |
| Approval workflow | Pending | `PENDING_APPROVAL` + `document_approvals`; schema exists, no RPC/UI yet |

**Migrations (Phase 3):** `20260616100000_purchase_order_line_discounts.sql`, `20260616200000_purchase_order_line_tax.sql`, `20260616300000_purchase_order_line_uom.sql`

---

## Phase 4 — Print / PDF / email

- `PDF_PRINT` template renderer (React-PDF or HTML print CSS).
- Bold/italic/font size from layout JSON.
- Email HTML template context.
- Print from peek / after Issue.

---

## Phase 5 — Cross-module & platform

- Clone layout engine → GRN, Sales Quotation, Sales Order, Sales Invoice (including **unit** + **decimalPlaces** per module).
- Tenant **custom field builder** in document preferences.
- Document attachments (storage + `document_attachments` table).
- Supplier portal / purchase invoice matching.

---

## File index (Phase 1 — shipped)

```
docs/PO_UX_PLAN.md
docs/DESIGN_SYSTEM.md                    # §5.4 — reusable document-module pattern
supabase/migrations/20260608160000_procurement_grn_v1_rpcs.sql
supabase/migrations/20260611140000_purchase_order_v1_ux_rpcs.sql

apps/web/lib/documents/
  types.ts
  layout-scope.ts
  layout-order.ts
  line-entry.ts
  purchase-order-layout.ts
  catalog-field-ids.ts
  catalog-line-values.ts
  resolve-effective-document-layout.ts
  use-document-line-table-fill-height.ts

apps/web/components/settings/document-layout/
  document-layout-scope-select.tsx
  document-layout-field-list.tsx
  document-layout-preview.tsx
  purchase-order-document-layout-panel.tsx

apps/web/components/settings/modules/
  procurement-module-settings-terminal.tsx

apps/web/app/settings/modules/
  page.tsx
  procurement/page.tsx
  procurement/actions.ts

apps/web/components/documents/
  document-line-entry-grid.tsx
  document-line-peek-table.tsx
  document-line-entry-cells.tsx

apps/web/lib/procurement/purchase-orders/
  custom-fields.ts
  totals.ts
  supplier-price.ts
  draft-form.ts
  list-columns.ts
  list-prefs.ts

apps/web/lib/procurement/__tests__/
  po-totals.test.ts
  purchase-order-schemas.test.ts (extended)

apps/web/components/procurement/purchase-orders/
  po-management-terminal.tsx
  po-drawer-form.tsx
  po-form-header.tsx
  po-line-entry-table.tsx
  po-line-entry-cells.tsx
  po-totals-panel.tsx
  po-details-panel.tsx
  po-peek-view.tsx
  po-supplier-combobox.tsx
  po-list-table.tsx
  po-list-toolbar.tsx

apps/web/components/procurement/goods-receipts/
  grn-management-terminal.tsx
  grn-drawer-form.tsx
  grn-line-entry-table.tsx
```

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-06-08 | Drawer-first (not full page) for V1; 60vw default for mutate surfaces. |
| 2026-06-08 | Scan + search unified; no scanner toggle in V1. |
| 2026-06-08 | Discounts deferred; layout registry includes IDs for Phase 3. |
| 2026-06-08 | Custom fields V1 = fixed keys in `custom_fields`; builder in Phase 5. |
| 2026-06-09 | Document layout Phase 2 adds per-field `decimalPlaces` (qty 3, money 2 defaults). |
| 2026-06-09 | Item **unit** column: read-only in Phase 2 (`purchase_uom` → base); editable alternate UOM on lines deferred to Phase 3+. |
| 2026-06-10 | Phase 3 started: PO line discounts + procurement discount policy; approval/tax/UOM remain in Phase 3 backlog. |
| 2026-06-09 | Phase 2 shipped: document layout settings wired to PO surfaces; full-page PO routes; location layout overrides. |
| 2026-06-09 | Cross-module drawer polish: `useDocumentLineTableFillHeight`, trailing rows, header-only save (no Cancel), drawer-width header grids for inventory forms. |
| 2026-06-09 | Document layout settings UI under `/settings/modules/procurement`; location scope + column reorder in template JSON; V2 wires DB + PO surfaces. |
