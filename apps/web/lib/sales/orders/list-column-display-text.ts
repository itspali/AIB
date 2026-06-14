import { formatDate } from "@/lib/dashboard/format";
import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import type { SalesOrderListColumnId } from "@/lib/sales/orders/list-columns";
import type { SalesOrderRow } from "@/lib/sales/orders/types";

export function getSalesOrderListCellDisplayTexts(
  columnId: SalesOrderListColumnId,
  row: SalesOrderRow
): string[] {
  switch (columnId) {
    case "so_number":
      return [row.voucher_number];
    case "customer":
      return [row.customer_name?.trim() || "—"];
    case "shipping_location": {
      const texts = [row.shipping_location_name?.trim() || "—"];
      if (row.shipping_location_code?.trim()) {
        texts.push(row.shipping_location_code.trim());
      }
      return texts;
    }
    case "status":
      return [salesOrderStatusLabel(row.commercial_status)];
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
