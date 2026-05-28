import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/user/types";

const DELEGATE_REGISTRY_KEY = "allow_organization_settings_modification";

export type OrganizationSettingsAccess = {
  granted: boolean;
  role: UserRole | null;
  isOwner: boolean;
  isDelegate: boolean;
  canGrantDelegates: boolean;
};

export async function resolveOrganizationSettingsAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<OrganizationSettingsAccess> {
  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  const role = (userRow?.role as UserRole | undefined) ?? null;
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
    .eq("registry_key", DELEGATE_REGISTRY_KEY)
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
