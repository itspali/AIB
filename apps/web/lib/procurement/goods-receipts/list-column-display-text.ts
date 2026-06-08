import { formatDate } from "@/lib/dashboard/format";
import type { GoodsReceiptListColumnId } from "@/lib/procurement/goods-receipts/list-columns";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";

export function getGoodsReceiptListCellDisplayTexts(
  columnId: GoodsReceiptListColumnId,
  row: GoodsReceiptRow
): string[] {
  switch (columnId) {
    case "grn_number":
      return [row.voucher_number];
    case "location": {
      const texts = [row.destination_location_name?.trim() || "—"];
      if (row.destination_location_code?.trim()) {
        texts.push(row.destination_location_code.trim());
      }
      return texts;
    }
    case "purchase_order":
      return [row.purchase_order_number?.trim() || "—"];
    case "lines":
      return [String(row.line_count)];
    case "received":
      return [formatDate(row.received_at)];
    default:
      return ["—"];
  }
}
