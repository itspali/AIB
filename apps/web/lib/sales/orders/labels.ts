import type { SalesOrderStatus } from "@/lib/sales/orders/types";

const STATUS_LABELS: Record<SalesOrderStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  CREDIT_HOLD: "Credit hold",
  APPROVED_ACTIVE: "Confirmed",
  PARTIALLY_SHIPPED: "Partially shipped",
  FULLY_COMPLETED: "Fully completed",
  CANCELLED: "Cancelled",
};

export function salesOrderStatusLabel(status: SalesOrderStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export function salesOrderStatusBadgeVariant(
  status: SalesOrderStatus
): "default" | "active" | "completed" | "action_required" {
  switch (status) {
    case "DRAFT":
      return "default";
    case "APPROVED_ACTIVE":
    case "PARTIALLY_SHIPPED":
      return "active";
    case "FULLY_COMPLETED":
      return "completed";
    case "PENDING_APPROVAL":
    case "CREDIT_HOLD":
      return "action_required";
    default:
      return "default";
  }
}
