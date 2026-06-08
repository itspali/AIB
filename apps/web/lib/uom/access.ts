import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/user/types";

export type UomManagementAccess = {
  granted: boolean;
  canManage: boolean;
  role: UserRole | null;
};

/**
 * Units-of-measure edit gate. Everyone in the tenant can view the catalog;
 * OWNER and ADMIN may create / edit / delete entries. Mirrors the DB-side
 * private.can_manage_uom_settings() guard.
 */
export async function resolveUomManagementAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<UomManagementAccess> {
  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  const role = (membership?.role as UserRole | undefined) ?? null;
  const canManage = role === "OWNER" || role === "ADMIN";

  return { granted: true, canManage, role };
}
