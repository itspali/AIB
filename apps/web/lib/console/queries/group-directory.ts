import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupAccountStatus } from "../types";

export type GroupDirectoryRow = {
  id: string;
  group_code: string;
  name: string;
  status: GroupAccountStatus;
  primary_email: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
};

export type GroupDirectoryResult = {
  rows: GroupDirectoryRow[];
  total: number;
};

export type GroupDirectoryFilters = {
  search?: string;
  status?: GroupAccountStatus;
  limit?: number;
  offset?: number;
};

type GroupRow = {
  id: string;
  group_code: string;
  name: string;
  status: GroupAccountStatus;
  primary_email: string;
  is_active: boolean;
  created_at: string;
  tenants: { count: number }[] | null;
};

export async function fetchGroupDirectory(
  admin: SupabaseClient,
  filters: GroupDirectoryFilters = {}
): Promise<GroupDirectoryResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const search = filters.search?.trim();

  let query = admin
    .from("tenant_groups")
    .select(
      `
      id,
      group_code,
      name,
      status,
      primary_email,
      is_active,
      created_at,
      tenants (count)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,group_code.ilike.%${search}%,primary_email.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const rows: GroupDirectoryRow[] = ((data ?? []) as GroupRow[]).map((group) => ({
    id: group.id,
    group_code: group.group_code,
    name: group.name,
    status: group.status,
    primary_email: group.primary_email,
    is_active: group.is_active,
    member_count: group.tenants?.[0]?.count ?? 0,
    created_at: group.created_at,
  }));

  return { rows, total: count ?? rows.length };
}
