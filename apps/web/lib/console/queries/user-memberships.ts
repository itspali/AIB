import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type UserTenantMembership = {
  user_id: string;
  tenant_id: string;
  email: string;
  role: string;
  is_active: boolean;
};

/** Primary tenant for pipeline/metrics: prefer OWNER membership, else first row. */
export function pickPrimaryMembership(
  memberships: UserTenantMembership[]
): UserTenantMembership | undefined {
  if (!memberships.length) return undefined;
  return memberships.find((m) => m.role === "OWNER") ?? memberships[0];
}

export async function loadMembershipsByUserIds(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, UserTenantMembership[]>> {
  const map = new Map<string, UserTenantMembership[]>();
  if (!userIds.length) return map;

  const { data, error } = await admin
    .from("user_tenant_memberships")
    .select("user_id, tenant_id, email, role, is_active")
    .in("user_id", userIds);

  if (error) throw error;

  for (const row of data ?? []) {
    const membership: UserTenantMembership = {
      user_id: row.user_id as string,
      tenant_id: row.tenant_id as string,
      email: row.email as string,
      role: row.role as string,
      is_active: row.is_active as boolean,
    };
    const list = map.get(membership.user_id) ?? [];
    list.push(membership);
    map.set(membership.user_id, list);
  }

  return map;
}

export async function loadTenantIdsByUserEmailSearch(
  admin: SupabaseClient,
  search: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("user_tenant_memberships")
    .select("tenant_id")
    .ilike("email", `%${search}%`);

  if (error) throw error;
  return [...new Set((data ?? []).map((row) => row.tenant_id as string))];
}

export type TenantMemberDetail = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export async function loadTenantMembers(
  admin: SupabaseClient,
  tenantId: string
): Promise<TenantMemberDetail[]> {
  const { data, error } = await admin
    .from("user_tenant_memberships")
    .select(
      `
      user_id,
      role,
      is_active,
      email,
      created_at,
      users (
        id,
        email,
        first_name,
        last_name,
        last_login_at,
        created_at,
        is_active
      )
    `
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const user = row.users as
      | {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          last_login_at: string | null;
          created_at: string;
          is_active: boolean;
        }
      | {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          last_login_at: string | null;
          created_at: string;
          is_active: boolean;
        }[]
      | null;

    const profile = Array.isArray(user) ? user[0] : user;
    const membershipActive = row.is_active as boolean;

    return {
      id: row.user_id as string,
      email: profile?.email ?? (row.email as string),
      first_name: profile?.first_name ?? "",
      last_name: profile?.last_name ?? "",
      role: row.role as string,
      is_active: membershipActive && (profile?.is_active ?? true),
      last_login_at: profile?.last_login_at ?? null,
      created_at: (profile?.created_at ?? row.created_at) as string,
    };
  });
}
