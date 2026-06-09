import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/user/types";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";

const PO_EDIT_DELEGATE_KEY = "allow_purchase_order_modification";

export type PurchaseOrderEditAccess = {
  granted: boolean;
  role: UserRole | null;
  isOwner: boolean;
  isDelegate: boolean;
  canGrantDelegates: boolean;
};

/** Issued POs editable only before any goods receipt activity. */
export const ISSUED_PO_EDITABLE_STATUSES: readonly PurchaseOrderStatus[] = ["ISSUED_ACTIVE"];

export async function resolvePurchaseOrderEditAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<PurchaseOrderEditAccess> {
  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  const role = (membership?.role as UserRole | undefined) ?? null;
  const isOwner = role === "OWNER";

  if (isOwner) {
    return {
      granted: true,
      role,
      isOwner: true,
      isDelegate: false,
      canGrantDelegates: true,
    };
  }

  const { data: delegateRow } = await supabase
    .from("workspace_control_registry")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("registry_key", PO_EDIT_DELEGATE_KEY)
    .eq("target_reference_id", userId)
    .maybeSingle();

  const isDelegate = Boolean(delegateRow);

  return {
    granted: isDelegate,
    role,
    isOwner: false,
    isDelegate,
    canGrantDelegates: false,
  };
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
