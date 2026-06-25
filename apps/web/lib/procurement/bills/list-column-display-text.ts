import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency } from "@/lib/list-columns/format-list-value";
import type { PurchaseBillListColumnId } from "@/lib/procurement/bills/list-columns";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";

export function getPurchaseBillListCellDisplayTexts(
  columnId: PurchaseBillListColumnId,
  row: PurchaseBillRow
): string[] {
  switch (columnId) {
    case "bill_number":
      return [row.system_voucher_number];
    case "invoice_number":
      return [row.invoice_number_vendor?.trim() || "—"];
    case "supplier":
      return [row.supplier_name?.trim() || "—"];
    case "purchase_order":
      return [row.purchase_order_number?.trim() || "—"];
    case "match_status":
      return [billMatchStatusLabel(row.match_status)];
    case "liability":
      return [formatListCurrency(row.total_liability_amount)];
    case "paid":
      return [row.is_paid ? "Paid" : "Unpaid"];
    case "created":
      return [formatDate(row.created_at)];
    default:
      return ["—"];
  }
}
