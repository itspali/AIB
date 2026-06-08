import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import type { UserRole } from "@/lib/user/types";

export type LocationManagementAccess = {
  granted: boolean;
  canManage: boolean;
  role: UserRole | null;
};

export async function resolveLocationManagementAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<LocationManagementAccess> {
  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  const role = (membership?.role as UserRole | undefined) ?? null;

  if (role === "OWNER" || role === "ADMIN") {
    return { granted: true, canManage: true, role };
  }

  const orgAccess = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);

  return {
    granted: true,
    canManage: orgAccess.granted,
    role,
  };
}
