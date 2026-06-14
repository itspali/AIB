import { formatDate } from "@/lib/dashboard/format";
import type { SalesQuoteListColumnId } from "@/lib/sales/quotes/list-columns";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

export function getSalesQuoteListCellDisplayTexts(
  columnId: SalesQuoteListColumnId,
  row: SalesQuoteRow
): string[] {
  switch (columnId) {
    case "quote_number":
      return [row.quotation_number];
    case "customer":
      return [row.customer_name?.trim() || "—"];
    case "origin_location":
      return [row.origin_location_name?.trim() || "—"];
    case "status":
      return [salesQuoteStatusLabel(row.commercial_status)];
    case "valid_until":
      return [formatDate(row.valid_until)];
    case "lines":
      return [String(row.line_count)];
    case "net_amount":
      return [row.total_net_amount];
    case "created":
      return [formatDate(row.created_at)];
    case "updated":
      return [formatDate(row.updated_at)];
    default:
      return ["—"];
  }
}
