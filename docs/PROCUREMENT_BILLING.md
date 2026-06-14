# Procurement Billing — Three-Way Match & AP Posting

**Read this first** when working on vendor bills (`/procurement/bills`), `save_purchase_invoice`, quantity invoicing, or accounts-payable GL posting.

**Related docs:** [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md) (GRN / landed cost), [`PROCUREMENT_APPROVAL_DESIGN.md`](./PROCUREMENT_APPROVAL_DESIGN.md) (PO approval — separate from billing), [`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md), [`DATA_STANDARDS.md`](./DATA_STANDARDS.md).

**Last updated:** 2026-06-14

---

## 1. Document flow (V1)

```
Purchase Order (ISSUED_ACTIVE)
        │
        ▼
Goods Receipt (post_goods_receipt) ──► inventory_ledger + MWAC
        │
        ▼
Vendor Bill (save_purchase_invoice) ──► three-way match + optional AP GL
```

Bills are recorded against a supplier, optionally linked to a PO and one or more GRNs via `purchase_invoice_receipts`. Posting steps are persisted in `document_posting_runs` (`document_type = 'BILL'`).

**UI:** `/procurement/bills` — Tier B list module + line-entry drawer (shared `DocumentLineEntryGrid` pattern).

**Key migrations:**
- `20260618150000_gst_purchase_invoices_and_gl.sql` — initial bill RPC + input tax trigger
- `20260622110000_procurement_billing_three_way_gl.sql` — qty validation, `quantity_invoiced`, deferred payables, PPV hold, void RPC

---

## 2. Three-way match

Matching compares **PO rate**, **GRN accepted quantity**, and **invoice line qty/rate** when GRNs are linked.

| Dimension | Source | Rule |
|-----------|--------|------|
| **Quantity** | GRN accepted qty per PO line | `quantity_billed + quantity_invoiced` must not exceed accepted receipt qty across linked GRNs |
| **Price** | PO `unit_price_contractual` vs bill `unit_price_billed` | Variance % compared to procurement tolerance |
| **Outcome** | `purchase_invoices.match_status` | `MATCHED`, `VARIANCE` (within tolerance), or `PPV_HOLD` (over tolerance) |

### GRN accepted quantity helper

`private.grn_accepted_quantity_for_po_item(tenant, po_item_id, grn_ids)` sums, per linked GRN line:

- `quantity_accepted` when &gt; 0 (QC partial accept path)
- otherwise `quantity_received`

Promotional lines are excluded from the match denominator.

### Posting steps (bill)

| Step id | When |
|---------|------|
| `bill_invoice_recorded` | Always on save |
| `bill_grn_linked` | When `p_goods_receipt_ids` provided |
| `bill_three_way_match` | `success` if MATCHED or VARIANCE; `failure` if PPV_HOLD |
| `bill_on_hold` | PPV_HOLD only |
| `bill_payables_posted` | See §4 |

**Client helpers:** `apps/web/lib/procurement/bills/three-way-match.ts` — variance % and quantity overage for drawer validation.

**Tolerance:** read from `PROCUREMENT_SETTINGS` workspace control (`price_variance_tolerance_pct`).

---

## 3. `quantity_invoiced` on PO lines

Column: `purchase_order_items.quantity_invoiced` (`NUMERIC(15,4)`, default 0).

| Event | Effect |
|-------|--------|
| **Bill save (create/update lines)** | Increments by summed `quantity_billed` per PO line on the invoice |
| **Bill void** | Decrements by voided line quantities (`GREATEST(..., 0)` guard) |
| **Validation gate** | Before insert: billed qty + existing `quantity_invoiced` ≤ GRN accepted qty |

This prevents invoicing more than was physically accepted, even across multiple partial bills.

**Error (RPC):** `quantity billed % exceeds accepted receipt quantity % for purchase order line`

---

## 4. AP posting gates (`bill_payables_posted`)

Payables GL is posted by `private.post_purchase_invoice_payables(invoice_id)` — debits/credits `2100-AP` and input tax accounts as applicable.

### Gates (all must pass)

| Gate | Skip / block reason |
|------|---------------------|
| Invoice not `CANCELLED` | `cancelled` |
| `match_status <> PPV_HOLD` | `PPV_HOLD` — payables deferred until `apply_purchase_price_variance` |
| Not already posted | `already_posted` (`payables_posted_at` or prior success step) |
| Liability or tax &gt; 0 | `zero_liability` |
| COA accounts exist | RPC raises if GL account missing (e.g. `2100-AP`) |

On success: sets `purchase_invoices.payables_posted_at`, appends `bill_payables_posted` step with GL voucher reference.

`save_purchase_invoice` invokes payables inline when match is not on hold; an `AFTER INSERT` trigger on `purchase_invoices` also delegates to the same function for idempotent catch-up.

### PPV hold path

When price variance exceeds tolerance:

1. `match_status = PPV_HOLD`
2. `bill_three_way_match` → `failure`
3. `bill_payables_posted` → `skipped` (`PPV hold`)
4. Operator resolves via `apply_purchase_price_variance` → expense GL + deferred payables

---

## 5. GRN landed cost (feeds bill cost basis)

Landed charges are captured at receipt, not on the bill:

- **Table:** `goods_receipt_landed_charges`
- **RPC param:** `p_landed_charges` JSON array on `post_goods_receipt`
- **Allocation:** `BY_QUANTITY`, `BY_VALUE`, or `BY_WEIGHT` (tenant/location default from procurement settings)
- **Posting step:** `grn_landed_charges_allocated` — `success` when charges &gt; 0, else `skipped`
- **Inventory effect:** allocated charge per unit increases MWAC via receipt line `raw_unit_cost` / landed allocation in `post_goods_receipt`

Bills match **quantities** against GRN accepted qty; **unit cost** for PPV compares bill rate to PO contractual rate (GRN landed cost affects inventory, not the qty gate).

---

## 6. Smoke & regression

```bash
# Core PO → GRN → Bill flow (requires dev server + .env.local)
npm run smoke:procurement --prefix apps/web

# Extended: landed charges, qty mismatch failure, bill_payables_posted assertion
SMOKE_EXTENDED=1 npm run smoke:procurement --prefix apps/web
```

Extended mode seeds `2100-AP` (+ inventory asset) so payables GL can post.

---

## 7. Quick file index

```
apps/web/
  app/procurement/bills/           # page, actions
  components/procurement/bills/    # list + drawer UI
  lib/procurement/bills/           # schemas, queries, three-way-match.ts
  scripts/smoke-procurement.mjs    # integration smoke

supabase/migrations/
  20260622110000_procurement_billing_three_way_gl.sql
  20260618150000_gst_purchase_invoices_and_gl.sql
  20260620200000_procurement_promo_engine.sql   # landed charges on GRN
```
