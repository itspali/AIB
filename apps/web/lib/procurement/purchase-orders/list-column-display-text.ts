import { formatDate } from "@/lib/dashboard/format";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import type { PurchaseOrderListColumnId } from "@/lib/procurement/purchase-orders/list-columns";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

export function getPurchaseOrderListCellDisplayTexts(
  columnId: PurchaseOrderListColumnId,
  row: PurchaseOrderRow
): string[] {
  switch (columnId) {
    case "po_number":
      return [row.voucher_number];
    case "supplier":
      return [row.supplier_name?.trim() || "—"];
    case "destination": {
      const texts = [row.destination_location_name?.trim() || "—"];
      if (row.destination_location_code?.trim()) {
        texts.push(row.destination_location_code.trim());
      }
      return texts;
    }
    case "status":
      return [purchaseOrderStatusLabel(row.document_status)];
    case "lines":
      return [String(row.line_count)];
    case "net_amount":
      return [row.total_net_amount];
    case "created":
      return [formatDate(row.created_at)];
    case "created_by":
      return [row.created_by_name?.trim() || "—"];
    case "updated":
      return [formatDate(row.updated_at)];
    default:
      return ["—"];
  }
}
