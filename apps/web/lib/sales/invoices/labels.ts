import {
  salesDocumentStatusBadgeVariant,
  salesDocumentStatusLabel,
  type SalesDocumentStatus,
} from "@/lib/sales/shared/document-status";
import type { SalesPaymentStatus } from "@/lib/sales/orders/types";

export function salesInvoiceStatusLabel(status: SalesDocumentStatus | string): string {
  return salesDocumentStatusLabel(status);
}

export function salesInvoiceStatusBadgeVariant(status: SalesDocumentStatus | string) {
  return salesDocumentStatusBadgeVariant(status);
}

const PAYMENT_STATUS_LABELS: Record<SalesPaymentStatus, string> = {
  UNPAID: "Unpaid",
  PARTIALLY_PAID: "Partially paid",
  FULLY_PAID: "Fully paid",
  REFUNDED: "Refunded",
};

export function salesInvoicePaymentStatusLabel(status: SalesPaymentStatus | string): string {
  return PAYMENT_STATUS_LABELS[status as SalesPaymentStatus] ?? status;
}
