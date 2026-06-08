import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupInvitationRow } from "@/lib/group/types";
import { isMissingRpcError } from "@/lib/supabase/rpc-error";

export async function fetchPendingGroupInvitationsForTenant(
  supabase: SupabaseClient
): Promise<GroupInvitationRow[]> {
  const { data, error } = await supabase.rpc("list_pending_group_invitations_for_tenant");

  if (error) {
    if (isMissingRpcError(error)) return [];
    return [];
  }

  if (!data) return [];

  return (data as GroupInvitationRow[]).map((row) => ({
    invitation_id: row.invitation_id,
    group_id: row.group_id,
    group_name: row.group_name,
    message: row.message,
    invited_by_name: row.invited_by_name,
    expires_at: row.expires_at,
    created_at: row.created_at,
  }));
}
