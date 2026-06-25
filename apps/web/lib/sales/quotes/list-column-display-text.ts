import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
import type { SalesQuoteListColumnId } from "@/lib/sales/quotes/list-columns";
import {
  salesQuoteDisplayStatusLabel,
  salesQuoteStatusLabel,
} from "@/lib/sales/quotes/labels";
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
      return [salesQuoteDisplayStatusLabel(row)];
    case "sent_at":
      return [row.sent_at ? formatDate(row.sent_at) : "—"];
    case "valid_until":
      return [formatDate(row.valid_until)];
    case "converted_order":
      return [row.converted_to_order_number?.trim() || "—"];
    case "converted_invoice":
      return [row.converted_to_invoice_number?.trim() || "—"];
    case "lines":
      return [formatListQuantity(row.line_count)];
    case "net_amount":
      return [formatListCurrency(row.total_net_amount)];
    case "created":
      return [formatDate(row.created_at)];
    case "updated":
      return [formatDate(row.updated_at)];
    default:
      return ["—"];
  }
}
