import type { PurchaseOrderStatus, PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { isPoFullyApprovedAwaitingIssue } from "@/lib/procurement/approval-settings";

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  ISSUED_ACTIVE: "Issued",
  QC_HOLD: "QC hold",
  PARTIALLY_FULFILLED: "Partially fulfilled",
  FULLY_COMPLETED: "Fully fulfilled",
  CANCELLED: "Cancelled",
};

export function purchaseOrderStatusLabel(status: PurchaseOrderStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function purchaseOrderStatusDisplayLabel(
  row: Pick<
    PurchaseOrderRow,
    "document_status" | "approval_request_status" | "approval_run_status"
  >
): string {
  if (isPoFullyApprovedAwaitingIssue(row)) {
    return "Approved — issue pending";
  }
  return purchaseOrderStatusLabel(row.document_status);
}

export function purchaseOrderStatusBadgeVariant(
  status: PurchaseOrderStatus
): "default" | "active" | "completed" | "action_required" {
  switch (status) {
    case "DRAFT":
      return "default";
    case "ISSUED_ACTIVE":
    case "PARTIALLY_FULFILLED":
      return "active";
    case "FULLY_COMPLETED":
      return "completed";
    case "PENDING_APPROVAL":
    case "QC_HOLD":
      return "action_required";
    default:
      return "default";
  }
}
