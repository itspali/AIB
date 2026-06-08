import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  GroupOrganizationRow,
  GroupOutboundInvitationRow,
  GroupSettingsSnapshot,
} from "@/lib/group/types";

export async function fetchUserPrimaryGroupId(
  supabase: SupabaseClient,
  userId: string,
  tenantGroupId: string | null,
  jwtGroupId: string | null
): Promise<string | null> {
  if (jwtGroupId) return jwtGroupId;
  if (tenantGroupId) return tenantGroupId;

  const { data } = await supabase
    .from("group_memberships")
    .select("group_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return (data?.group_id as string | undefined) ?? null;
}

export async function fetchGroupOrganizations(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupOrganizationRow[]> {
  const { data, error } = await supabase.rpc("list_group_organizations", {
    p_group_id: groupId,
  });

  if (error || !data) return [];

  return (data as GroupOrganizationRow[]).map((row) => ({
    tenant_id: row.tenant_id,
    name: row.name,
    trade_name: row.trade_name,
    membership_status: row.membership_status,
    tenant_status: row.tenant_status,
    onboarding_status: row.onboarding_status,
    member_count: Number(row.member_count ?? 0),
    joined_at: row.joined_at,
  }));
}

export async function fetchPendingGroupInvitationsForGroup(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupOutboundInvitationRow[]> {
  const { data, error } = await supabase
    .from("group_organization_invitations")
    .select(
      "id, tenant_id, message, expires_at, created_at, tenants!inner(name, trade_name)"
    )
    .eq("group_id", groupId)
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const tenant = row.tenants as { name: string; trade_name: string | null } | null;
    return {
      invitation_id: row.id as string,
      tenant_id: row.tenant_id as string,
      organization_name: tenant?.trade_name || tenant?.name || "Organization",
      message: (row.message as string | null) ?? null,
      expires_at: row.expires_at as string,
      created_at: row.created_at as string,
    };
  });
}

export async function fetchGroupSettingsSnapshot(
  supabase: SupabaseClient,
  groupId: string
): Promise<GroupSettingsSnapshot | null> {
  const [{ data: group, error: groupError }, organizations] = await Promise.all([
    supabase.from("tenant_groups").select("*").eq("id", groupId).maybeSingle(),
    fetchGroupOrganizations(supabase, groupId),
  ]);

  if (groupError || !group) return null;

  return {
    group_id: group.id,
    name: group.name,
    legal_name: group.legal_name,
    trade_name: group.trade_name,
    primary_email: group.primary_email,
    primary_phone: group.primary_phone,
    status: group.status,
    is_active: group.is_active !== false,
    organizations,
  };
}
