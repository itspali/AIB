import type { PurchaseOrderLocationScope } from "@/lib/procurement/location-scope";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";

export function purchaseOrderFetchOptionsForScope(
  scope: PurchaseOrderLocationScope,
  status?: PurchaseOrderStatus | null
): {
  locationId?: string;
  locationIds?: string[];
  status?: PurchaseOrderStatus | null;
} {
  const base = status ? { status } : {};
  if (scope.mode === "unrestricted") return base;
  if (scope.mode === "single") {
    return { ...base, locationId: scope.locationId };
  }
  return { ...base, locationIds: scope.locationIds };
}
