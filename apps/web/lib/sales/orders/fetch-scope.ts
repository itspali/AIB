import type { SalesOrderLocationScope } from "@/lib/sales/access";
import type { SalesOrderStatus } from "@/lib/sales/orders/types";

export function salesOrderFetchOptionsForScope(
  scope: SalesOrderLocationScope,
  status?: SalesOrderStatus | null
): {
  locationId?: string;
  locationIds?: string[];
  status?: SalesOrderStatus | null;
} {
  const base = status ? { status } : {};
  if (scope.mode === "unrestricted") return base;
  if (scope.mode === "single") {
    return { ...base, locationId: scope.locationId };
  }
  return { ...base, locationIds: scope.locationIds };
}
