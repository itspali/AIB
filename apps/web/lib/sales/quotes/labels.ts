import {
  salesDocumentStatusBadgeVariant,
  salesDocumentStatusLabel,
  type SalesDocumentStatus,
} from "@/lib/sales/shared/document-status";

export function salesQuoteStatusLabel(status: SalesDocumentStatus | string): string {
  return salesDocumentStatusLabel(status);
}

export function salesQuoteStatusBadgeVariant(status: SalesDocumentStatus | string) {
  return salesDocumentStatusBadgeVariant(status);
}
