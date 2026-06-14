export type SalesDocumentStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "CREDIT_HOLD"
  | "APPROVED_ACTIVE"
  | "PARTIALLY_SHIPPED"
  | "FULLY_COMPLETED"
  | "CANCELLED";

const STATUS_LABELS: Record<SalesDocumentStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  CREDIT_HOLD: "Credit hold",
  APPROVED_ACTIVE: "Approved",
  PARTIALLY_SHIPPED: "Partially shipped",
  FULLY_COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function salesDocumentStatusLabel(status: SalesDocumentStatus | string): string {
  return STATUS_LABELS[status as SalesDocumentStatus] ?? status;
}

export function salesDocumentStatusBadgeVariant(
  status: SalesDocumentStatus | string
): "default" | "active" | "completed" | "action_required" {
  switch (status) {
    case "DRAFT":
      return "default";
    case "APPROVED_ACTIVE":
    case "PARTIALLY_SHIPPED":
    case "FULLY_COMPLETED":
      return status === "FULLY_COMPLETED" ? "completed" : "active";
    case "PENDING_APPROVAL":
    case "CREDIT_HOLD":
      return "action_required";
    default:
      return "default";
  }
}

export const EDITABLE_SALES_DOCUMENT_STATUSES: readonly SalesDocumentStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
];

export function canEditSalesDocument(status: string): boolean {
  return EDITABLE_SALES_DOCUMENT_STATUSES.includes(status as SalesDocumentStatus);
}
