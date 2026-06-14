import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/user/types";

export type WorkspaceOwnerResolution = {
  isOwner: boolean;
  role: UserRole | null;
};

/** Matches `private.user_is_po_super_approver` sources on the app layer. */
export async function resolveIsWorkspaceOwner(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<WorkspaceOwnerResolution> {
  const [{ data: membership }, { data: tenant }] = await Promise.all([
    supabase
      .from("user_tenant_memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.from("tenants").select("created_by_user_id").eq("id", tenantId).maybeSingle(),
  ]);

  const membershipRole = (membership?.role as UserRole | undefined) ?? null;
  const isOwner = membershipRole === "OWNER" || tenant?.created_by_user_id === userId;

  return {
    isOwner,
    role: membershipRole,
  };
}
