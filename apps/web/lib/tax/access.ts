import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/user/types";

const TAX_SETTINGS_DELEGATE_KEY = "allow_tax_settings_modification";

export type TaxSettingsAccess = {
  granted: boolean;
  role: UserRole | null;
  isOwner: boolean;
  isDelegate: boolean;
};

/**
 * Tax-settings edit gate. OWNER edits by default; any other role (incl.
 * ADMIN) edits only when explicitly delegated via workspace_control_registry
 * — mirrors resolveOrganizationSettingsAccess.
 */
export async function resolveTaxSettingsAccess(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<TaxSettingsAccess> {
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
    return { granted: true, role, isOwner: true, isDelegate: false };
  }

  const { data: delegateRow } = await supabase
    .from("workspace_control_registry")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("registry_key", TAX_SETTINGS_DELEGATE_KEY)
    .eq("target_reference_id", userId)
    .maybeSingle();

  const isDelegate = Boolean(delegateRow);

  return { granted: isDelegate, role, isOwner: false, isDelegate };
}
