import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type TenantReportingLine = {
  user_id: string;
  reports_to_user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
};

export async function fetchTenantReportingLines(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TenantReportingLine[]> {
  const { data: memberships, error } = await supabase
    .from("user_tenant_memberships")
    .select("user_id, reports_to_user_id, role, email")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("email");

  if (error || !memberships?.length) return [];

  const userIds = memberships.map((row) => row.user_id as string);
  const { data: profiles } = await supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .in("id", userIds);

  const profileById = new Map((profiles ?? []).map((user) => [user.id, user]));

  return memberships
    .map((row) => {
      const profile = profileById.get(row.user_id as string);
      if (!profile) return null;
      return {
        user_id: row.user_id as string,
        reports_to_user_id: (row.reports_to_user_id as string | null) ?? null,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email || (row.email as string),
        role: row.role as string,
      };
    })
    .filter((row): row is TenantReportingLine => row !== null);
}
