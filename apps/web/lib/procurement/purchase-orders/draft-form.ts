import {
  emptyPurchaseOrderCustomFields,
  type PurchaseOrderCustomFields,
  parsePurchaseOrderCustomFields,
} from "@/lib/procurement/purchase-orders/custom-fields";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
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
};

export type PoDraftFormState = {
  destination_location_id: string;
  supplier_id: string;
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

export function filterSavablePoLines(lines: PoDraftLine[]): PoDraftLine[] {
  return lines.filter(isPoLineComplete);
}

export function defaultPoDraftForm(
  locations: ProcurementLocationOption[],
  suppliers: ProcurementSupplierOption[]
): PoDraftFormState {
  const supplier = suppliers[0];
  return {
    destination_location_id: locations[0]?.id ?? "",
    supplier_id: supplier?.id ?? "",
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
