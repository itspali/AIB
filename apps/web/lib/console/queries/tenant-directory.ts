import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantAccountStatus, TenantOnboardingStatus } from "../types";
import { loadTenantIdsByUserEmailSearch, loadTenantMembers } from "./user-memberships";

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
};

export async function fetchTenantDirectory(
  admin: SupabaseClient,
  filters: TenantDirectoryFilters = {}
): Promise<TenantDirectoryResult> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const search = filters.search?.trim();

  let tenantIdsFromSearch: string[] | null = null;
  if (search) {
    const [{ data: byTenant }, tenantIdsByEmail] = await Promise.all([
      admin
        .from("tenants")
        .select("id")
        .or(`name.ilike.%${search}%,organization_code.ilike.%${search}%`),
      loadTenantIdsByUserEmailSearch(admin, search),
    ]);
    const ids = new Set<string>();
    for (const row of byTenant ?? []) ids.add(row.id as string);
    for (const tenantId of tenantIdsByEmail) ids.add(tenantId);
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
      created_at
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

  const [userCounts, locationCounts, ownerEmails] = await Promise.all([
    fetchMembershipCountsByTenant(admin, tenantIds),
    fetchCountsByTenant(admin, "tenant_locations", tenantIds),
    fetchOwnerEmailsByTenant(admin, tenantIds),
  ]);

  const rows: TenantDirectoryRow[] = tenants.map((tenant) => ({
    id: tenant.id,
    organization_code: tenant.organization_code,
    name: tenant.name,
    status: tenant.status,
    onboarding_status: tenant.onboarding_status,
    owner_email: ownerEmails.get(tenant.id) ?? tenant.primary_email ?? null,
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

async function fetchMembershipCountsByTenant(
  admin: SupabaseClient,
  tenantIds: string[]
): Promise<Map<string, number>> {
  return fetchCountsByTenant(admin, "user_tenant_memberships", tenantIds);
}

async function fetchOwnerEmailsByTenant(
  admin: SupabaseClient,
  tenantIds: string[]
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  if (!tenantIds.length) return owners;

  const { data, error } = await admin
    .from("user_tenant_memberships")
    .select("tenant_id, email, role")
    .in("tenant_id", tenantIds)
    .eq("role", "OWNER");

  if (error) return owners;

  for (const row of data ?? []) {
    const tenantId = row.tenant_id as string;
    if (!owners.has(tenantId)) {
      owners.set(tenantId, row.email as string);
    }
  }

  return owners;
}
