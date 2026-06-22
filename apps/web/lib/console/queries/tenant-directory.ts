import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantAccountStatus, TenantOnboardingStatus } from "../types";

export type TenantDirectoryFilters = {
  search?: string;
  status?: TenantAccountStatus;
  limit?: number;
  offset?: number;
};

export type TenantDirectoryRow = {
  id: string;
  organization_code: string;
  name: string;
  status: TenantAccountStatus;
  onboarding_status: TenantOnboardingStatus;
  owner_email: string | null;
  user_count: number;
  location_count: number;
  created_at: string;
};

export type TenantDirectoryResult = {
  rows: TenantDirectoryRow[];
  total: number;
};

type TenantRow = {
  id: string;
  organization_code: string;
  name: string;
  status: TenantAccountStatus;
  onboarding_status: TenantOnboardingStatus;
  primary_email: string;
  created_at: string;
  users: { email: string; role: string }[] | null;
};

function resolveOwnerEmail(tenant: TenantRow): string | null {
  const owner = tenant.users?.find((u) => u.role === "OWNER");
  return owner?.email ?? tenant.primary_email ?? null;
}

export async function fetchTenantDirectory(
  admin: SupabaseClient,
  filters: TenantDirectoryFilters = {}
): Promise<TenantDirectoryResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const search = filters.search?.trim();

  let tenantIdsFromSearch: string[] | null = null;
  if (search) {
    const [{ data: byTenant }, { data: byUser }] = await Promise.all([
      admin
        .from("tenants")
        .select("id")
        .or(`name.ilike.%${search}%,organization_code.ilike.%${search}%`),
      admin.from("users").select("tenant_id").ilike("email", `%${search}%`),
    ]);
    const ids = new Set<string>();
    for (const row of byTenant ?? []) ids.add(row.id as string);
    for (const row of byUser ?? []) ids.add(row.tenant_id as string);
    tenantIdsFromSearch = [...ids];
    if (tenantIdsFromSearch.length === 0) {
      return { rows: [], total: 0 };
    }
  }

  let query = admin
    .from("tenants")
    .select(
      `
      id,
      organization_code,
      name,
      status,
      onboarding_status,
      primary_email,
      created_at,
      users (email, role)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (tenantIdsFromSearch) {
    query = query.in("id", tenantIdsFromSearch);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  const tenants = (data ?? []) as TenantRow[];
  const tenantIds = tenants.map((t) => t.id);

  const [userCounts, locationCounts] = await Promise.all([
    fetchCountsByTenant(admin, "users", tenantIds),
    fetchCountsByTenant(admin, "tenant_locations", tenantIds),
  ]);

  const rows: TenantDirectoryRow[] = tenants.map((tenant) => ({
    id: tenant.id,
    organization_code: tenant.organization_code,
    name: tenant.name,
    status: tenant.status,
    onboarding_status: tenant.onboarding_status,
    owner_email: resolveOwnerEmail(tenant),
    user_count: userCounts.get(tenant.id) ?? 0,
    location_count: locationCounts.get(tenant.id) ?? 0,
    created_at: tenant.created_at,
  }));

  return { rows, total: count ?? rows.length };
}

async function fetchCountsByTenant(
  admin: SupabaseClient,
  table: string,
  tenantIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!tenantIds.length) return counts;

  const { data, error } = await admin.from(table).select("tenant_id").in("tenant_id", tenantIds);
  if (error) return counts;

  for (const row of data ?? []) {
    const tenantId = row.tenant_id as string;
    counts.set(tenantId, (counts.get(tenantId) ?? 0) + 1);
  }
  return counts;
}
