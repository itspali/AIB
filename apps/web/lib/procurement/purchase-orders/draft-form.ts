import { emptyPoLineCatalogContext, type PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  emptyPurchaseOrderCustomFields,
  type PurchaseOrderCustomFields,
  parsePurchaseOrderCustomFields,
} from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderLineRow, PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type { PoLineEntryAnchor } from "@/lib/procurement/purchase-orders/line-entry-anchor";
import {
  inferPoLineDiscountTypeFromSaved,
  type PoLineDiscountType,
} from "@/lib/procurement/purchase-orders/po-line-discount";
import {
  emptyPoHeaderCharges,
  normalizePoHeaderChargesFromStorage,
  type PoHeaderChargesFields,
} from "@/lib/procurement/purchase-orders/po-header-charges";
import { mapPurchaseOrderTransactionDiscount } from "@/lib/procurement/purchase-orders/po-transaction-discount";
import { computeImpliedMrpMarkdownPct, resolvePeekLineMrpTaxContext } from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import { mapSavedPoLineTaxComponents } from "@/lib/procurement/purchase-orders/po-line-saved-tax";
import type { PoLineWritebackSnapshot } from "@/lib/procurement/purchase-orders/po-line-writeback-snapshot";
import type { ProcurementLocationOption, ProcurementSupplierOption } from "@/lib/procurement/shared/types";

export type PoDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  quantity_ordered: string;
  unit_price_contractual: string;
  discount_percentage: string;
  discount_amount: string;
  /** Discount entry mode (% rate vs fixed amount). Defaults to percent. */
  discount_type?: PoLineDiscountType;
  /** Selected order UOM; defaults from item purchase/base UOM after catalog load. */
  uom_code?: string;
  skuError: string | null;
  /** Read-only item/variant catalog snapshot for layout-driven detail fields. */
  catalog_context?: PoLineCatalogContext | null;
  /** Trade markdown % off item MRP (tier 1 — derives offer unit price). */
  mrp_markdown_percentage?: string;
  /** PO-entered reference MRP when catalog MRP is blank. */
  mrp_reference?: string | null;
  /** Baseline catalog values for optional master-data write-back after save. */
  writeback_snapshot?: PoLineWritebackSnapshot;
  is_promotional?: boolean;
  linked_parent_line_key?: string | null;
  linked_parent_line_id?: string | null;
  promo_group_id?: string | null;
  promotional_category?: string | null;
};

export type PoDraftFormState = {
  destination_location_id: string;
  supplier_id: string;
  currency_code: string;
  payment_terms_days: string;
  /** When true, line unit prices are entered and stored as tax-inclusive. */
  prices_tax_inclusive: boolean;
  custom_fields: PurchaseOrderCustomFields;
  header_charges: PoHeaderChargesFields;
  lines: PoDraftLine[];
  /** Import staging location (port / agent). Empty = use destination. */
  receipt_location_id: string;
  /** Planned main warehouse after staging/GIT. Empty = use destination. */
  ultimate_destination_location_id: string;
  /** COMMERCIAL | FINAL | empty = tenant default. */
  po_fulfillment_stage_override: "" | "COMMERCIAL" | "FINAL";
};

export function createEmptyPoLine(key?: string): PoDraftLine {
  return {
    key: key ?? crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    quantity_ordered: "1",
    unit_price_contractual: "0",
    discount_percentage: "0",
    discount_amount: "0",
    discount_type: "percent",
    skuError: null,
  };
}

export function isPoLineComplete(line: PoDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_ordered) > 0;
}

export function isPoLineBlank(line: PoDraftLine): boolean {
  return !line.variant_id && !line.sku.trim();
}

/** Entry row with typed search text but no variant selected yet. */
export function isPoLineInProgressEntry(line: PoDraftLine): boolean {
  return !line.variant_id && Boolean(line.sku.trim());
}

/** Keeps a trailing empty row for spreadsheet-style entry. */
export function ensureTrailingPoLine(lines: PoDraftLine[]): PoDraftLine[] {
  const last = lines.at(-1);
  if (!last || isPoLineComplete(last)) {
    return [...lines, createEmptyPoLine()];
  }
  return lines;
}

/** Keeps a leading empty row for top-anchored spreadsheet entry. */
export function ensureLeadingPoLine(lines: PoDraftLine[]): PoDraftLine[] {
  const first = lines[0];
  if (!first || isPoLineComplete(first)) {
    return [createEmptyPoLine(), ...lines];
  }
  return lines;
}

export function ensureEntryPoLine(
  lines: PoDraftLine[],
  anchor: PoLineEntryAnchor = "bottom"
): PoDraftLine[] {
  return anchor === "top" ? ensureLeadingPoLine(lines) : ensureTrailingPoLine(lines);
}

export function resolvePoEntryLineKey(
  lines: PoDraftLine[],
  anchor: PoLineEntryAnchor = "bottom"
): string | null {
  if (!lines.length) return null;
  return anchor === "top" ? lines[0]!.key : lines.at(-1)!.key;
}

export function isPoEntryLineKey(
  lineKey: string,
  lines: PoDraftLine[],
  anchor: PoLineEntryAnchor = "bottom"
): boolean {
  return resolvePoEntryLineKey(lines, anchor) === lineKey;
}

/** Move the blank entry row to the configured edge; drop extra blank rows. */
export function normalizePoLinesForAnchor(
  lines: PoDraftLine[],
  anchor: PoLineEntryAnchor
): PoDraftLine[] {
  const dataLines = lines.filter((line) => !isPoLineBlank(line));
  if (!dataLines.length) return [createEmptyPoLine()];
  return ensureEntryPoLine(dataLines, anchor);
}

export function poLinesNeedAnchorNormalization(
  lines: PoDraftLine[],
  anchor: PoLineEntryAnchor
): boolean {
  const blankLines = lines.filter(isPoLineBlank);
  const inProgressLines = lines.filter(isPoLineInProgressEntry);

  // Item search typing keeps the entry row at the anchor without a separate blank row.
  if (blankLines.length === 0 && inProgressLines.length === 1) {
    const entryLine = inProgressLines[0]!;
    const atAnchor =
      anchor === "top"
        ? lines[0]?.key === entryLine.key
        : lines.at(-1)?.key === entryLine.key;
    if (atAnchor) return false;
  }

  if (blankLines.length !== 1) return true;
  const blankKey = blankLines[0]!.key;
  if (anchor === "top") return lines[0]?.key !== blankKey;
  return lines.at(-1)?.key !== blankKey;
}

export function filterSavablePoLines(lines: PoDraftLine[]): PoDraftLine[] {
  return lines.filter(isPoLineComplete);
}

export type PoLineDropPosition = "before" | "after";

/** Move a filled line relative to the drop target; keeps the blank entry row on its anchor edge. */
export function movePoDraftLine(
  lines: PoDraftLine[],
  fromKey: string,
  toKey: string,
  anchor: PoLineEntryAnchor = "bottom",
  position: PoLineDropPosition = "before"
): PoDraftLine[] {
  if (fromKey === toKey) return lines;

  const fromIndex = lines.findIndex((line) => line.key === fromKey);
  const toIndex = lines.findIndex((line) => line.key === toKey);
  if (fromIndex < 0 || toIndex < 0) return lines;

  const fromLine = lines[fromIndex]!;
  const toLine = lines[toIndex]!;
  if (isPoLineBlank(fromLine) || isPoLineBlank(toLine)) return lines;

  const next = [...lines];
  next.splice(fromIndex, 1);
  let insertIndex = next.findIndex((line) => line.key === toKey);
  if (insertIndex < 0) return lines;
  if (position === "after") insertIndex += 1;
  next.splice(insertIndex, 0, fromLine);

  return ensureEntryPoLine(next, anchor);
}

export function supplierDefaultCurrency(
  suppliers: ProcurementSupplierOption[],
  supplierId: string,
  workspaceDefaultCurrency: string
): string {
  const supplier = suppliers.find((row) => row.id === supplierId);
  const override = supplier?.base_currency_override?.trim();
  return override || workspaceDefaultCurrency;
}

export function defaultPoDraftForm(
  locations: ProcurementLocationOption[],
  suppliers: ProcurementSupplierOption[],
  defaultCurrency = "USD",
  preferredDestinationLocationId?: string | null,
  entryLineKey?: string,
  defaultPricesTaxInclusive = false
): PoDraftFormState {
  const supplier = suppliers[0];
  const destinationLocationId =
    preferredDestinationLocationId &&
    locations.some((location) => location.id === preferredDestinationLocationId)
      ? preferredDestinationLocationId
      : (locations[0]?.id ?? "");
  return {
    destination_location_id: destinationLocationId,
    supplier_id: supplier?.id ?? "",
    currency_code: supplier
      ? supplierDefaultCurrency(suppliers, supplier.id, defaultCurrency)
      : defaultCurrency,
    payment_terms_days: supplier ? String(supplier.payment_terms_days) : "0",
    prices_tax_inclusive: defaultPricesTaxInclusive,
    custom_fields: emptyPurchaseOrderCustomFields(),
    header_charges: emptyPoHeaderCharges(),
    lines: [createEmptyPoLine(entryLineKey)],
    receipt_location_id: "",
    ultimate_destination_location_id: "",
    po_fulfillment_stage_override: "",
  };
}

export function supplierPaymentTerms(suppliers: ProcurementSupplierOption[], supplierId: string): string {
  const supplier = suppliers.find((row) => row.id === supplierId);
  return supplier ? String(supplier.payment_terms_days) : "0";
}

function inferMrpMarkdownFromSavedLine(
  line: {
    unit_price_contractual: string;
    mrp?: string | null;
    tax_rate_percentage?: string;
  },
  pricesTaxInclusive = false
): string {
  const mrp = Number((line.mrp ?? "").trim());
  const unit = Number((line.unit_price_contractual ?? "").trim());
  if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(unit)) return "0";
  return computeImpliedMrpMarkdownPct(mrp, Math.max(unit, 0), {
    ...resolvePeekLineMrpTaxContext(
      { tax_rate_percentage: line.tax_rate_percentage ?? "0" },
      pricesTaxInclusive
    ),
  });
}

function lineCatalogSnapshot(line: {
  tax_rate_percentage?: string;
  base_unit_of_measure?: string | null;
  uom_code?: string;
  mrp?: string | null;
}): PoLineCatalogContext {
  const rate = Number(line.tax_rate_percentage ?? 0);
  return {
    ...emptyPoLineCatalogContext(),
    base_unit_of_measure: line.base_unit_of_measure?.trim() || null,
    mrp: line.mrp?.trim() || null,
    tax_rate: Number.isFinite(rate) ? rate : 0,
    tax_is_variable: false,
    // Partial snapshot — full catalog (MRP, HSN, etc.) still hydrates from item master.
    catalog_snapshot_source: "optimistic",
  };
}

export function mapPurchaseOrderHeaderCharges(order: PurchaseOrderRow): PoHeaderChargesFields {
  return normalizePoHeaderChargesFromStorage({
    ...mapPurchaseOrderTransactionDiscount(order),
    shipping_amount: order.shipping_amount ?? "0",
    shipping_tax_rate_pct: order.shipping_tax_rate_pct ?? "0",
    shipping_tax_amount: order.shipping_tax_amount ?? "0",
    shipping_tax_type: order.shipping_tax_type === "amount" ? "amount" : "percent",
    round_off_amount: order.round_off_amount ?? "0",
    additional_charges_amount: order.additional_charges_amount ?? "0",
  });
}

function lineCatalogSnapshotFromSavedLine(line: PurchaseOrderLineRow): PoLineCatalogContext {
  const rate = Number(line.tax_rate_percentage ?? 0);
  const taxComponents = mapSavedPoLineTaxComponents(line.tax_components);
  return {
    ...lineCatalogSnapshot({
      tax_rate_percentage: line.tax_rate_percentage,
      base_unit_of_measure: line.base_unit_of_measure,
      uom_code: line.uom_code,
      mrp: line.mrp,
    }),
    tax_rate: Number.isFinite(rate) ? rate : 0,
    tax_components: taxComponents,
  };
}

/** Map a persisted PO line into draft form shape (promo linkage uses saved line ids as keys). */
export function mapSavedPoLineToDraftLine(
  line: PurchaseOrderLineRow,
  key: string = line.id,
  options?: { pricesTaxInclusive?: boolean }
): PoDraftLine {
  const parentLineId = line.linked_parent_line_id?.trim() || null;
  const pricesTaxInclusive = options?.pricesTaxInclusive ?? false;
  return {
    key,
    sku: line.variant_sku,
    variant_id: line.variant_id,
    item_id: line.item_id,
    item_name: line.item_name,
    variant_sku: line.variant_sku,
    quantity_ordered: line.quantity_ordered,
    unit_price_contractual: line.unit_price_contractual,
    mrp_markdown_percentage: inferMrpMarkdownFromSavedLine(line, pricesTaxInclusive),
    discount_percentage: line.discount_percentage ?? "0",
    discount_amount: line.discount_amount ?? "0",
    discount_type: inferPoLineDiscountTypeFromSaved(line),
    uom_code: line.uom_code,
    catalog_context: lineCatalogSnapshotFromSavedLine(line),
    skuError: null,
    is_promotional: line.is_promotional,
    linked_parent_line_key: parentLineId,
    linked_parent_line_id: parentLineId,
    promo_group_id: line.promo_group_id ?? null,
    promotional_category: line.promotional_category ?? null,
  };
}

export function mapPurchaseOrderToDraft(order: PurchaseOrderRow): PoDraftFormState {
  return {
    destination_location_id: order.destination_location_id,
    supplier_id: order.supplier_id,
    currency_code: order.currency_code,
    payment_terms_days: String(order.payment_terms_days ?? 0),
    prices_tax_inclusive: order.prices_tax_inclusive,
    custom_fields: parsePurchaseOrderCustomFields(order.custom_fields),
    header_charges: mapPurchaseOrderHeaderCharges(order),
    receipt_location_id: order.receipt_location_id ?? "",
    ultimate_destination_location_id: order.ultimate_destination_location_id ?? "",
    po_fulfillment_stage_override: order.po_fulfillment_stage_override ?? "",
    lines:
      order.lines?.length
        ? ensureTrailingPoLine(
            order.lines.map((line) =>
              mapSavedPoLineToDraftLine(line, line.id, {
                pricesTaxInclusive: order.prices_tax_inclusive,
              })
            )
          )
        : [createEmptyPoLine()],
  };
}

/** Seed a new draft from an existing PO (duplicate flow). */
export function copyPoDraftFromOrder(order: PurchaseOrderRow): PoDraftFormState {
  const draft = mapPurchaseOrderToDraft(order);
  const sourceLines = (order.lines ?? []).filter((line) => Boolean(line.variant_id));
  const idToKey = new Map<string, string>();

  const remappedLines = sourceLines.map((line) => {
    const key = crypto.randomUUID();
    idToKey.set(line.id, key);
    return mapSavedPoLineToDraftLine(line, key, {
      pricesTaxInclusive: order.prices_tax_inclusive,
    });
  });

  const linesWithPromoLinks = remappedLines.map((line) => {
    const parentId = line.linked_parent_line_id ?? line.linked_parent_line_key;
    if (!parentId) {
      return { ...line, linked_parent_line_id: null };
    }
    const parentKey = idToKey.get(parentId) ?? null;
    return {
      ...line,
      linked_parent_line_key: parentKey,
      linked_parent_line_id: null,
    };
  });

  return {
    ...draft,
    custom_fields: {
      ...draft.custom_fields,
      requisition_number: "",
    },
    lines: ensureTrailingPoLine(linesWithPromoLinks),
  };
}
