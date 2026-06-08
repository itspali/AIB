import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { buildFallbackOperatorProfile } from "@/lib/user/build-fallback-profile";
import { parseDutyStatus } from "@/lib/user/duty-status";
import {
  fetchActiveTenantMembership,
  fetchUserTenantMembershipCount,
  fetchWorkspaceMembershipOptions,
} from "@/lib/user/membership";
import { claimsToUserShape, readSessionClaims } from "@/lib/supabase/auth";
import type { OperatorProfile, UserRole } from "@/lib/user/types";

type ModulePageUserRow = {
  first_name: string | null;
  last_name: string | null;
  role: string;
  assigned_location_id: string | null;
  avatar_url: string | null;
  metadata_json: unknown;
};

export function buildOperatorProfileFromUserRow(
  userId: string,
  userRow: ModulePageUserRow,
  orgName: string,
  locationName: string | null,
  tenantMembershipCount = 1
): OperatorProfile {
  const role = userRow.role as UserRole;
  const metadata =
    userRow.metadata_json && typeof userRow.metadata_json === "object"
      ? (userRow.metadata_json as Record<string, unknown>)
      : {};

  return {
    userId,
    firstName: userRow.first_name ?? "",
    lastName: userRow.last_name ?? "",
    role,
    avatarUrl: userRow.avatar_url,
    tenantDisplayName: orgName,
    locationLabel: resolveLocationLabel(role, userRow.assigned_location_id, locationName),
    dutyStatus: parseDutyStatus(metadata.duty_status),
    tenantMembershipCount,
    activeTenantId: null,
    workspaceOptions: [],
  };
}

function resolveLocationLabel(
  role: UserRole,
  assignedLocationId: string | null,
  locationName: string | null
): string {
  if (role === "OWNER" || role === "ADMIN") return "All locations";
  if (assignedLocationId && locationName) return locationName;
  if (assignedLocationId) return "Assigned branch";
  return "Unassigned";
}

export async function fetchOperatorProfile(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<OperatorProfile | null> {
  const [membership, membershipCount, workspaceOptions] = await Promise.all([
    fetchActiveTenantMembership(supabase, userId, tenantId),
    fetchUserTenantMembershipCount(supabase, userId),
    fetchWorkspaceMembershipOptions(supabase, userId),
  ]);

  if (!membership) return null;

  const role = membership.role;

  const [{ data: userRow }, { data: tenant }, { data: location }] = await Promise.all([
    supabase
      .from("users")
      .select("first_name, last_name, avatar_url, metadata_json")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("tenants").select("name, trade_name").eq("id", tenantId).maybeSingle(),
    membership.assigned_location_id
      ? supabase
          .from("tenant_locations")
          .select("name")
          .eq("id", membership.assigned_location_id)
          .eq("tenant_id", tenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!userRow) return null;

  const metadata =
    userRow.metadata_json && typeof userRow.metadata_json === "object"
      ? (userRow.metadata_json as Record<string, unknown>)
      : {};

  return {
    userId,
    firstName: userRow.first_name ?? "",
    lastName: userRow.last_name ?? "",
    role,
    avatarUrl: userRow.avatar_url,
    tenantDisplayName: tenant?.trade_name || tenant?.name || "Workspace",
    locationLabel: resolveLocationLabel(
      role,
      membership.assigned_location_id,
      location?.name ?? null
    ),
    dutyStatus: parseDutyStatus(metadata.duty_status),
    tenantMembershipCount: membershipCount,
    activeTenantId: tenantId,
    workspaceOptions,
  };
}

export async function fetchOperatorProfileForSession(
  supabase: SupabaseClient,
  tenantDisplayName = "Workspace"
): Promise<OperatorProfile | null> {
  const claims = await readSessionClaims(supabase);

  if (!claims) return null;

  if (claims.tenantId) {
    const profile = await fetchOperatorProfile(supabase, claims.userId, claims.tenantId);
    if (profile) return profile;
  }

  return buildFallbackOperatorProfile(claimsToUserShape(claims) as User, tenantDisplayName);
}
