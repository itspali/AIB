import { formatDate } from "@/lib/dashboard/format";
import type { QcQueueListColumnId } from "@/lib/procurement/quality-inspection/list-columns";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";

export function getQcQueueListCellDisplayTexts(
  columnId: QcQueueListColumnId,
  row: QcInspectionQueueRow
): string[] {
  switch (columnId) {
    case "item":
      return [row.item_name, row.variant_sku];
    case "grn_number":
      return [row.grn_number];
    case "purchase_order":
      return [row.purchase_order_number?.trim() || "—"];
    case "location": {
      const texts = [row.destination_location_name?.trim() || "—"];
      if (row.destination_location_code?.trim()) {
        texts.push(row.destination_location_code.trim());
      }
      return texts;
    }
    case "on_hold":
      return [row.quantity_on_hold];
    case "received":
      return [formatDate(row.received_at)];
    default:
      return ["—"];
  }
}
