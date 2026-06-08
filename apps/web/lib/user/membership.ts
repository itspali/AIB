import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/user/types";

export type TenantMembershipRow = {
  tenant_id: string;
  role: UserRole;
  assigned_location_id: string | null;
  email: string;
  is_active: boolean;
};

export async function fetchActiveTenantMembership(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<TenantMembershipRow | null> {
  const { data, error } = await supabase
    .from("user_tenant_memberships")
    .select("tenant_id, role, assigned_location_id, email, is_active")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as TenantMembershipRow;
}

export async function fetchUserTenantMembershipCount(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("user_tenant_memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) return 1;
  return count ?? 0;
}

export type WorkspaceMembershipOption = {
  tenantId: string;
  displayName: string;
  role: UserRole;
  groupId: string | null;
  groupName: string | null;
};

export async function fetchWorkspaceMembershipOptions(
  supabase: SupabaseClient,
  userId: string
): Promise<WorkspaceMembershipOption[]> {
  const { data: memberships, error } = await supabase
    .from("user_tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error || !memberships?.length) return [];

  const tenantIds = memberships.map((m) => m.tenant_id as string);
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id, name, trade_name, group_id")
    .in("id", tenantIds);

  const groupIds = [
    ...new Set((tenants ?? []).map((t) => t.group_id).filter((id): id is string => Boolean(id))),
  ];

  const groupsById = new Map<string, string>();
  if (groupIds.length) {
    const { data: groups } = await supabase
      .from("tenant_groups")
      .select("id, name, trade_name")
      .in("id", groupIds);
    for (const g of groups ?? []) {
      groupsById.set(g.id, g.trade_name || g.name);
    }
  }

  const tenantById = new Map((tenants ?? []).map((t) => [t.id as string, t]));

  return memberships.map((m) => {
    const tenant = tenantById.get(m.tenant_id as string);
    const groupId = (tenant?.group_id as string | null) ?? null;
    return {
      tenantId: m.tenant_id as string,
      displayName: tenant?.trade_name || tenant?.name || "Workspace",
      role: m.role as UserRole,
      groupId,
      groupName: groupId ? groupsById.get(groupId) ?? null : null,
    };
  });
}
