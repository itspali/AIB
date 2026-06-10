# GST Compliance

This document describes how AIB applies Indian GST rules across master data, procurement, and sales.

## Supply context resolver

`private.gst_resolve_supply_context` (mirrored in `apps/web/lib/tax/gst-supply-context.ts`) derives:

- **supply_nature** — `INTRASTATE`, `INTERSTATE`, `IMPORT_GOODS`, `IMPORT_SERVICES`, `EXPORT`
- **tax_mechanism** — `FORWARD`, `REVERSE_CHARGE`, `IMPORT_IGST`, `ZERO_RATED`, `COMPOSITION`
- **tax_treatment_applied** — `CGST_SGST`, `IGST`, `ZERO_RATED`, or `COMPOSITION`

Inputs: tenant country, party `tax_treatment`, party country/state, destination state, document side (`PURCHASE` | `SALE`).

## Import of goods (end-to-end)

1. **Supplier** — set `tax_treatment = OVERSEAS_EXPORT` with non-IN `billing_country_code`.
2. **Purchase order** — zero vendor GST (`IMPORT_IGST` mechanism); HSN retained on items for customs.
3. **Goods receipt** — capture BoE number/date, port, assessable value, customs duty, import IGST; landed cost capitalizes charges.
4. **Bill** — `save_purchase_invoice` snapshots supplier treatment; posts input IGST to GL (`1380-INPUT-IGST` / `2120-IMPORT-IGST-PAYABLE`).
5. **Inventory GL** — import IGST capitalized on GRN insert when supply nature is `IMPORT_GOODS`.

## Import of services (RCM)

Overseas service suppliers resolve to `IMPORT_SERVICES` + `REVERSE_CHARGE`. PO lines have zero vendor GST; bills compute GST under RCM and post to `2115-RCM-LIABILITY`.

## Sales

`sales_invoices_apply_gst_context` replaces state-only nexus. Overseas/SEZ/deemed-export customers zero-rate output tax; composition customers use composition mechanism.

## GSTR hooks

Views: `gstr1_outward_supplies`, `gstr2_inward_supplies`, `gstr3b_summary`. Export via `fetch_gstr_export` RPC and `/settings/tax/gstr` UI.

## E-invoice readiness

`sales_invoices` stores IRN fields and `einvoice_status`. `validate_sales_invoice_einvoice` checks HSN and export shipping bill; `generate_einvoice_irn` is a stub until NIC API credentials are configured. Enable per tenant with `tenants.einvoice_enabled`.

## Tax code presets (India)

| Code | Use |
|------|-----|
| `IMPORT-ZERO` | Foreign commercial invoice (PO) |
| `IMPORT-IGST` | Assessable value at customs |
| `RCM-STD` | Import of services under reverse charge |
| `ZERO-EXPORT` | Zero-rated export sales |
