import type { SupabaseClient } from "@supabase/supabase-js";
import {
  purchaseOrderScopeAllowsDestination,
  resolvePurchaseOrderLocationScope,
  type PurchaseOrderLocationScope,
} from "@/lib/procurement/location-scope";
import { resolveIsWorkspaceOwner } from "@/lib/procurement/workspace-owner";
import type { UserRole } from "@/lib/user/types";
import type { SalesOrderRow, SalesOrderStatus } from "@/lib/sales/orders/types";

const SO_EDIT_DELEGATE_KEY = "allow_sales_order_modification";

export type SalesOrderLocationScope = PurchaseOrderLocationScope;

export type SalesOrderEditAccess = {
  granted: boolean;
  role: UserRole | null;
  isOwner: boolean;
  isDelegate: boolean;
  canGrantDelegates: boolean;
  locationScope: SalesOrderLocationScope;
};

export type SalesOrderAccessContext = SalesOrderEditAccess;

/** Confirmed SOs editable only before any shipment activity. */
export const CONFIRMED_SO_EDITABLE_STATUSES: readonly SalesOrderStatus[] = ["APPROVED_ACTIVE"];

export function salesOrderHasShippedQuantity(
  order: Pick<SalesOrderRow, "lines">
): boolean {
  return (order.lines ?? []).some((line) => Number(line.quantity_shipped) > 0);
}

export function canAmendConfirmedSalesOrder(
  order: Pick<SalesOrderRow, "commercial_status" | "lines">,
  hasEditPermission: boolean
): boolean {
  return (
    hasEditPermission &&
    order.commercial_status === "APPROVED_ACTIVE" &&
    !salesOrderHasShippedQuantity(order)
  );
}

export function canCancelConfirmedSalesOrder(
  order: Pick<SalesOrderRow, "commercial_status" | "lines">,
  hasEditPermission: boolean
): boolean {
  return canAmendConfirmedSalesOrder(order, hasEditPermission);
}

export function canShipSalesOrder(
  order: Pick<SalesOrderRow, "commercial_status" | "lines">
): boolean {
  if (
    order.commercial_status !== "APPROVED_ACTIVE" &&
    order.commercial_status !== "PARTIALLY_SHIPPED"
  ) {
    return false;
  }
  return (order.lines ?? []).some((line) => Number(line.open_quantity) > 0);
}

function parseDelegateAllowedLocationIds(metadata: unknown): string[] | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const raw = (metadata as { allowed_location_ids?: unknown }).allowed_location_ids;
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  return ids;
}

export async function resolveSalesOrderEditAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<SalesOrderEditAccess> {
  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("role, assigned_location_id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  const [{ isOwner }, assignedLocationId] = await Promise.all([
    resolveIsWorkspaceOwner(supabase, userId, tenantId),
    Promise.resolve((membership?.assigned_location_id as string | null) ?? null),
  ]);

  const role = (membership?.role as UserRole | undefined) ?? null;
  const isAdmin = role === "ADMIN";

  if (isOwner) {
    return {
      granted: true,
      role,
      isOwner: true,
      isDelegate: false,
      canGrantDelegates: true,
      locationScope: { mode: "unrestricted" },
    };
  }

  if (isAdmin) {
    return {
      granted: true,
      role,
      isOwner: false,
      isDelegate: false,
      canGrantDelegates: false,
      locationScope: { mode: "unrestricted" },
    };
  }

  const { data: delegateRow } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", SO_EDIT_DELEGATE_KEY)
    .eq("target_reference_id", userId)
    .maybeSingle();

  const isDelegate = Boolean(delegateRow);
  const delegateAllowedLocationIds = isDelegate
    ? parseDelegateAllowedLocationIds(delegateRow?.configuration_metadata)
    : null;

  const locationScope = resolvePurchaseOrderLocationScope({
    role,
    assignedLocationId,
    delegateAllowedLocationIds: isDelegate ? delegateAllowedLocationIds ?? [] : null,
  });

  return {
    granted: isDelegate,
    role,
    isOwner: false,
    isDelegate,
    canGrantDelegates: false,
    locationScope,
  };
}

export function canAccessSalesOrderShippingLocation(
  shippingLocationId: string,
  access: Pick<SalesOrderEditAccess, "locationScope">
): boolean {
  return purchaseOrderScopeAllowsDestination(access.locationScope, shippingLocationId);
}

export function canEditSalesOrderDocument(
  status: SalesOrderStatus,
  options: { allowEditConfirmed: boolean; hasEditPermission: boolean }
): boolean {
  if (!options.hasEditPermission) return false;
  if (status === "DRAFT") return true;
  if (
    options.allowEditConfirmed &&
    CONFIRMED_SO_EDITABLE_STATUSES.includes(status)
  ) {
    return true;
  }
  return false;
}
