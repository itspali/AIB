import type { SupabaseClient } from "@supabase/supabase-js";
import {
  purchaseOrderScopeAllowsDestination,
  resolvePurchaseOrderLocationScope,
  type PurchaseOrderLocationScope,
} from "@/lib/procurement/location-scope";
import { resolveIsWorkspaceOwner } from "@/lib/procurement/workspace-owner";
import type { UserRole } from "@/lib/user/types";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";

const PO_EDIT_DELEGATE_KEY = "allow_purchase_order_modification";

export type PurchaseOrderEditAccess = {
  granted: boolean;
  role: UserRole | null;
  isOwner: boolean;
  isDelegate: boolean;
  canGrantDelegates: boolean;
  locationScope: PurchaseOrderLocationScope;
};

export type PurchaseOrderAccessContext = PurchaseOrderEditAccess;

/** Issued POs editable only before any goods receipt activity. */
export const ISSUED_PO_EDITABLE_STATUSES: readonly PurchaseOrderStatus[] = ["ISSUED_ACTIVE"];

function parseDelegateAllowedLocationIds(metadata: unknown): string[] | null {
  if (metadata == null || typeof metadata !== "object") return null;
  const raw = (metadata as { allowed_location_ids?: unknown }).allowed_location_ids;
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const ids = raw.filter((value): value is string => typeof value === "string" && value.length > 0);
  return ids;
}

export async function resolvePurchaseOrderEditAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<PurchaseOrderEditAccess> {
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
    .eq("registry_key", PO_EDIT_DELEGATE_KEY)
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

export function canAccessPurchaseOrderDestination(
  destinationLocationId: string,
  access: Pick<PurchaseOrderEditAccess, "locationScope">
): boolean {
  return purchaseOrderScopeAllowsDestination(access.locationScope, destinationLocationId);
}

export function canEditPurchaseOrderDocument(
  status: PurchaseOrderStatus,
  options: { allowEditIssued: boolean; hasEditPermission: boolean }
): boolean {
  if (!options.hasEditPermission) return false;
  if (status === "DRAFT") return true;
  if (
    options.allowEditIssued &&
    ISSUED_PO_EDITABLE_STATUSES.includes(status)
  ) {
    return true;
  }
  return false;
}
