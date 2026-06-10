import {
  emptyPurchaseOrderCustomFields,
  type PurchaseOrderCustomFields,
  parsePurchaseOrderCustomFields,
} from "@/lib/procurement/purchase-orders/custom-fields";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import type { PoLineEntryAnchor } from "@/lib/procurement/purchase-orders/line-entry-anchor";
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
  skuError: string | null;
  /** Read-only item/variant catalog snapshot for layout-driven detail fields. */
  catalog_context?: PoLineCatalogContext | null;
};

export type PoDraftFormState = {
  destination_location_id: string;
  supplier_id: string;
  currency_code: string;
  payment_terms_days: string;
  custom_fields: PurchaseOrderCustomFields;
  lines: PoDraftLine[];
};

export function createEmptyPoLine(): PoDraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    quantity_ordered: "1",
    unit_price_contractual: "0",
    skuError: null,
  };
}

export function isPoLineComplete(line: PoDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_ordered) > 0;
}

export function isPoLineBlank(line: PoDraftLine): boolean {
  return !line.variant_id && !line.sku.trim();
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
  if (blankLines.length !== 1) return true;
  const blankKey = blankLines[0]!.key;
  if (anchor === "top") return lines[0]?.key !== blankKey;
  return lines.at(-1)?.key !== blankKey;
}

export function filterSavablePoLines(lines: PoDraftLine[]): PoDraftLine[] {
  return lines.filter(isPoLineComplete);
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
  preferredDestinationLocationId?: string | null
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
    custom_fields: emptyPurchaseOrderCustomFields(),
    lines: [createEmptyPoLine()],
  };
}

export function supplierPaymentTerms(suppliers: ProcurementSupplierOption[], supplierId: string): string {
  const supplier = suppliers.find((row) => row.id === supplierId);
  return supplier ? String(supplier.payment_terms_days) : "0";
}

export function mapPurchaseOrderToDraft(order: PurchaseOrderRow): PoDraftFormState {
  return {
    destination_location_id: order.destination_location_id,
    supplier_id: order.supplier_id,
    currency_code: order.currency_code,
    payment_terms_days: String(order.payment_terms_days ?? 0),
    custom_fields: parsePurchaseOrderCustomFields(order.custom_fields),
    lines:
      order.lines?.length
        ? ensureTrailingPoLine(
            order.lines.map((line) => ({
              key: line.id,
              sku: line.variant_sku,
              variant_id: line.variant_id,
              item_id: line.item_id,
              item_name: line.item_name,
              variant_sku: line.variant_sku,
              quantity_ordered: line.quantity_ordered,
              unit_price_contractual: line.unit_price_contractual,
              skuError: null,
            }))
          )
        : [createEmptyPoLine()],
  };
}

/** Seed a new draft from an existing PO (duplicate flow). */
export function copyPoDraftFromOrder(order: PurchaseOrderRow): PoDraftFormState {
  const draft = mapPurchaseOrderToDraft(order);
  return {
    ...draft,
    custom_fields: {
      ...draft.custom_fields,
      requisition_number: "",
    },
    lines: ensureTrailingPoLine(
      (order.lines ?? [])
        .filter((line) => Boolean(line.variant_id))
        .map((line) => ({
          key: crypto.randomUUID(),
          sku: line.variant_sku,
          variant_id: line.variant_id,
          item_id: line.item_id,
          item_name: line.item_name,
          variant_sku: line.variant_sku,
          quantity_ordered: line.quantity_ordered,
          unit_price_contractual: line.unit_price_contractual,
          skuError: null,
        }))
    ),
  };
}
