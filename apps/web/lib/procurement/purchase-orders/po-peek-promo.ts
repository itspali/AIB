import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";

export function poPeekShowsPromoEntitlements(
  status: PurchaseOrderStatus | undefined
): boolean {
  return status != null && status !== "DRAFT" && status !== "CANCELLED";
}
