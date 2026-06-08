import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupMembershipRole, GroupSettingsAccess } from "@/lib/group/types";

export async function resolveGroupSettingsAccess(
  supabase: SupabaseClient,
  userId: string,
  groupId: string
): Promise<GroupSettingsAccess> {
  const { data: membership } = await supabase
    .from("group_memberships")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  const role = (membership?.role as GroupMembershipRole | undefined) ?? null;
  const isOwner = role === "GROUP_OWNER";
  const isAdmin = role === "GROUP_ADMIN" || isOwner;

  return {
    granted: isAdmin,
    role,
    isOwner,
    isAdmin,
  };
}
