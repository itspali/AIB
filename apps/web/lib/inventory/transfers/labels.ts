import type { StockTransferStatus } from "@/lib/inventory/transfers/types";

const STATUS_LABELS: Record<StockTransferStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  DISPATCHED_IN_TRANSIT: "In transit",
  RECEIPT_DISCREPANCY: "Receipt discrepancy",
  FULLY_COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function stockTransferStatusLabel(status: StockTransferStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export const ACTIVE_TRANSFER_STATUSES: StockTransferStatus[] = [
  "DRAFT",
  "DISPATCHED_IN_TRANSIT",
  "RECEIPT_DISCREPANCY",
  "FULLY_COMPLETED",
];
