# Purchase Order UX & Document Layout Plan

**Status:** Phase 1 (V1) in progress  
**Related:** [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §3.7, [`DATA_STANDARDS.md`](./DATA_STANDARDS.md)

---

## Goals

1. **PO V1** — Fast, spreadsheet-style create/edit in a wide drawer with live totals, supplier intelligence, and scan-friendly line entry.
2. **Document layout engine** — Tenant-configurable columns/labels/print (phased); starts with code defaults consumed by PO UI.
3. **Cross-module reuse** — Same patterns for GRN, Sales Order, Quotation, Invoice later.

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

## Phase 1 — PO V1 UX [IN PROGRESS]

**Scope:** Drawer-first operational PO; no org settings UI for layout yet.

### Shipped / shipping in V1

- Wide drawer default (**60vw**) for create/edit; peek stays user width.
- **Spreadsheet line table** (item, qty, unit price ex-tax, line total, remove).
- **Unified scan + search** — GTIN/barcode then SKU per tenant `scan_identifier_policy`; Enter resolves.
- **Searchable supplier combobox** + **Create supplier…** link (`/entities/suppliers?action=new`).
- **Supplier prefill** — `payment_terms_days` from entity; **unit price** from `supplier_items` (variant → item fallback).
- **PO number preview** — `peek_document_voucher_string` RPC (no sequence consume until save).
- **Totals rail** — sticky right on `lg+`, footer on mobile (subtotal, line count; tax placeholder 0).
- **Advanced header fields** — requisition #, expected delivery, internal notes → `custom_fields`; payment terms days.
- **Layout defaults** — `lib/documents/purchase-order-layout.ts` registry (columns for future settings UI).
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

## Phase 2 — Document layout settings + PO polish

- Organization Settings → **Document layouts** (PO tab: On-screen | Print).
- Wire PO form/peek/print preview to `document_layout_templates` (seed defaults migration).
- **Per-field decimal places** — settings UI + `decimalPlaces` on each numeric column in `grid_columns_json` / `line_item_formatting`; wire PO line table, totals rail, and peek to shared formatter (defaults: qty **3**, money **2**).
- **Item unit column** — optional line column `unit` (read-only): display `items.purchase_uom` when set, else `base_unit_of_measure`; shown beside qty in screen grid, peek, and print when enabled in layout (hidden by default in seed template).
- User overrides for screen (optional localStorage).
- PO number manual override (admin-gated RPC).
- **Expand to full page** action for 15+ lines.
- Duplicate PO / copy lines.
- Omnibar scope `purchase-orders`.

---

## Phase 3 — Commercial depth (procurement)

- Line `discount_percentage` / `discount_amount` on `purchase_order_items` + RPC totals.
- `PROCUREMENT_SETTINGS.allow_line_item_discounts` (mirror sales gatekeeper).
- Tax mode (ex-tax / inc-tax) + line tax from `tax_rate_registry` / item HSN.
- Layout prefs for discount & tax columns.
- **Editable line UOM** (optional) — when item has `alternate_uoms`, allow ordering in a non-base UOM with conversion to base for inventory; requires line `uom_code` + factor on `purchase_order_items` and RPC validation. Read-only unit display ships in Phase 2.
- Issue confirmation / approval workflow (`PENDING_APPROVAL`).

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

## File index (Phase 1)

```
docs/PO_UX_PLAN.md
supabase/migrations/20260611140000_purchase_order_v1_ux_rpcs.sql

apps/web/lib/documents/
  types.ts
  purchase-order-layout.ts

apps/web/lib/procurement/purchase-orders/
  custom-fields.ts
  totals.ts
  supplier-price.ts
  draft-form.ts

apps/web/lib/procurement/__tests__/
  po-totals.test.ts
  purchase-order-schemas.test.ts (extended)

apps/web/components/procurement/purchase-orders/
  po-drawer-form.tsx (shell)
  po-form-header.tsx
  po-line-entry-table.tsx
  po-totals-panel.tsx
  po-peek-view.tsx
  po-supplier-combobox.tsx
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
