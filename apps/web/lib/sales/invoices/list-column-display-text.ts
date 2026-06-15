import { formatDate } from "@/lib/dashboard/format";
import type { SalesInvoiceListColumnId } from "@/lib/sales/invoices/list-columns";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";

export function getSalesInvoiceListCellDisplayTexts(
  columnId: SalesInvoiceListColumnId,
  row: SalesInvoiceRow
): string[] {
  switch (columnId) {
    case "invoice_number":
      return [row.invoice_number];
    case "customer":
      return [row.customer_name?.trim() || "—"];
    case "origin_location":
      return [row.origin_location_name?.trim() || "—"];
    case "status":
      return [salesInvoiceStatusLabel(row.commercial_status)];
    case "payment_status":
      return [salesInvoicePaymentStatusLabel(row.invoice_payment_status)];
    case "source_order":
      return [row.source_order_number?.trim() || "—"];
    case "source_quote":
      return [row.source_quotation_number?.trim() || "—"];
    case "net_amount":
      return [row.total_net_amount];
    case "paid_amount":
      return [row.total_paid_amount];
    case "created":
      return [formatDate(row.created_at)];
    case "updated":
      return [formatDate(row.updated_at)];
    default:
      return ["—"];
  }
}
