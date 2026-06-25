import type { AllocatableImportPurchaseOrderOption, ImportShipmentLineDraft } from "@/lib/procurement/shipments/types";
import type { ProcurementSupplierOption } from "@/lib/procurement/shared/types";

export type ImportShipmentPoPrefill = {
  supplierId: string;
  stagingLocationId: string | null;
  ultimateDestinationLocationId: string | null;
  incotermsCode: string;
  selectedPoId: string;
  lines: ImportShipmentLineDraft[];
};

export function buildShipmentLinesFromPo(
  order: AllocatableImportPurchaseOrderOption
): ImportShipmentLineDraft[] {
  return order.lines.map((line) => ({
    purchase_order_id: order.id,
    po_item_id: line.id,
    variant_id: line.variant_id,
    quantity_shipped: line.open_quantity,
    label: `${line.item_name} · ${line.variant_sku}`,
    purchase_order_number: order.voucher_number,
  }));
}

export function resolveShipmentPrefillFromPo(
  order: AllocatableImportPurchaseOrderOption,
  suppliers: ProcurementSupplierOption[]
): ImportShipmentPoPrefill {
  const supplier = suppliers.find((row) => row.id === order.supplier_id);
  const staging =
    order.receipt_location_id?.trim() ||
    order.destination_location_id?.trim() ||
    null;
  const ultimate =
    order.ultimate_destination_location_id?.trim() ||
    order.destination_location_id?.trim() ||
    null;

  return {
    supplierId: order.supplier_id,
    stagingLocationId: staging,
    ultimateDestinationLocationId: ultimate,
    incotermsCode: supplier?.incoterms_code?.trim().toUpperCase() ?? "",
    selectedPoId: order.id,
    lines: buildShipmentLinesFromPo(order),
  };
}
