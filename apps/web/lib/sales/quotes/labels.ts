import {
  salesDocumentStatusBadgeVariant,
  type SalesDocumentStatus,
} from "@/lib/sales/shared/document-status";

export function salesQuoteDisplayStatusLabel(quote: {
  commercial_status: SalesDocumentStatus | string;
  sent_at?: string | null;
  valid_until?: string;
}): string {
  if (quote.sent_at) return "Sent";
  if (quote.commercial_status === "APPROVED_ACTIVE") return "Confirmed";
  if (quote.commercial_status === "PENDING_APPROVAL") return "Pending approval";
  if (quote.commercial_status === "DRAFT") return "Draft";
  if (quote.commercial_status === "FULLY_COMPLETED") return "Completed";
  if (quote.commercial_status === "CANCELLED") return "Cancelled";
  if (
    quote.valid_until &&
    quote.commercial_status !== "FULLY_COMPLETED" &&
    quote.commercial_status !== "CANCELLED" &&
    new Date(quote.valid_until).getTime() < Date.now()
  ) {
    return "Expired";
  }
  return quote.commercial_status.replaceAll("_", " ").toLowerCase();
}

export function salesQuoteStatusLabel(status: SalesDocumentStatus | string): string {
  if (status === "APPROVED_ACTIVE") return "Confirmed";
  if (status === "PENDING_APPROVAL") return "Pending approval";
  if (status === "DRAFT") return "Draft";
  if (status === "FULLY_COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return status.replaceAll("_", " ").toLowerCase();
}

export function salesQuoteStatusBadgeVariant(
  quote: {
    commercial_status: SalesDocumentStatus | string;
    sent_at?: string | null;
  }
): "default" | "active" | "completed" | "action_required" {
  if (quote.sent_at) return "completed";
  switch (quote.commercial_status) {
    case "DRAFT":
      return "default";
    case "APPROVED_ACTIVE":
      return "active";
    case "FULLY_COMPLETED":
      return "completed";
    case "PENDING_APPROVAL":
      return "action_required";
    default:
      return "default";
  }
}
