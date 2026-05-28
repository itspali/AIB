import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildFallbackOperatorProfile } from "@/lib/user/build-fallback-profile";
import { parseDutyStatus } from "@/lib/user/duty-status";
import type { OperatorProfile, UserRole } from "@/lib/user/types";

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
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select(
      "tenant_id, first_name, last_name, role, assigned_location_id, avatar_url, metadata_json"
    )
    .eq("id", userId)
    .maybeSingle();

  if (userError || !userRow) return null;

  const effectiveTenantId = userRow.tenant_id ?? tenantId;
  const role = userRow.role as UserRole;

  const [{ data: tenant }, { data: location }] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, trade_name")
      .eq("id", effectiveTenantId)
      .maybeSingle(),
    userRow.assigned_location_id
      ? supabase
          .from("tenant_locations")
          .select("name")
          .eq("id", userRow.assigned_location_id)
          .eq("tenant_id", effectiveTenantId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const metadata =
    userRow.metadata_json && typeof userRow.metadata_json === "object"
      ? (userRow.metadata_json as Record<string, unknown>)
      : {};

  return {
    userId,
    firstName: userRow.first_name,
    lastName: userRow.last_name,
    role,
    avatarUrl: userRow.avatar_url,
    tenantDisplayName: tenant?.trade_name || tenant?.name || "Workspace",
    locationLabel: resolveLocationLabel(
      role,
      userRow.assigned_location_id,
      location?.name ?? null
    ),
    dutyStatus: parseDutyStatus(metadata.duty_status),
    tenantMembershipCount: 1,
  };
}

export async function fetchOperatorProfileForSession(
  supabase: SupabaseClient,
  tenantDisplayName = "Workspace"
): Promise<OperatorProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenantId = user.app_metadata?.tenant_id as string | undefined;

  if (tenantId) {
    const profile = await fetchOperatorProfile(supabase, user.id, tenantId);
    if (profile) return profile;
  }

  return buildFallbackOperatorProfile(user, tenantDisplayName);
}
