import { formatDate } from "@/lib/dashboard/format";
import type { TransferListColumnId } from "@/lib/inventory/transfers/list-columns";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";

export function getTransferListCellDisplayTexts(
  columnId: TransferListColumnId,
  row: StockTransferRow
): string[] {
  switch (columnId) {
    case "document":
      return [row.transfer_number];
    case "from": {
      const texts = [row.source_location_name?.trim() || "—"];
      if (row.source_location_code?.trim()) texts.push(row.source_location_code.trim());
      return texts;
    }
    case "to": {
      const texts = [row.destination_location_name?.trim() || "—"];
      if (row.destination_location_code?.trim()) texts.push(row.destination_location_code.trim());
      return texts;
    }
    case "status":
      return [stockTransferStatusLabel(row.current_status)];
    case "lines":
      return [String(row.line_count)];
    case "created":
      return [formatDate(row.dispatched_at ?? row.created_at)];
    default:
      return ["—"];
  }
}
