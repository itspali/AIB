import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import type { UserRole } from "@/lib/user/types";

export type PurchaseOrderLocationScope =
  | { mode: "unrestricted" }
  | { mode: "single"; locationId: string }
  | { mode: "list"; locationIds: string[] };

export function purchaseOrderScopeAllowsDestination(
  scope: PurchaseOrderLocationScope,
  destinationLocationId: string
): boolean {
  if (scope.mode === "unrestricted") return true;
  if (scope.mode === "single") return scope.locationId === destinationLocationId;
  return scope.locationIds.includes(destinationLocationId);
}

export function filterProcurementLocationsByScope(
  locations: ProcurementLocationOption[],
  scope: PurchaseOrderLocationScope
): ProcurementLocationOption[] {
  if (scope.mode === "unrestricted") return locations;
  if (scope.mode === "single") {
    return locations.filter((location) => location.id === scope.locationId);
  }
  const allowed = new Set(scope.locationIds);
  return locations.filter((location) => allowed.has(location.id));
}

export function resolvePurchaseOrderLocationScope(input: {
  role: UserRole | null;
  assignedLocationId: string | null;
  delegateAllowedLocationIds: string[] | null;
}): PurchaseOrderLocationScope {
  if (input.role === "OWNER" || input.role === "ADMIN") {
    return { mode: "unrestricted" };
  }

  if (input.delegateAllowedLocationIds?.length) {
    return { mode: "list", locationIds: input.delegateAllowedLocationIds };
  }

  if (input.delegateAllowedLocationIds !== null) {
    // Active delegate without an explicit location list — tenant-wide buying.
    return { mode: "unrestricted" };
  }

  if (
    (input.role === "MANAGER" || input.role === "STAFF") &&
    input.assignedLocationId
  ) {
    return { mode: "single", locationId: input.assignedLocationId };
  }

  if (input.role === "MANAGER" || input.role === "STAFF") {
    return { mode: "list", locationIds: [] };
  }

  return { mode: "unrestricted" };
}

export function preferredPurchaseOrderDestinationId(
  locations: ProcurementLocationOption[],
  scope: PurchaseOrderLocationScope
): string | undefined {
  const scoped = filterProcurementLocationsByScope(locations, scope);
  return scoped[0]?.id;
}
