import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { tenantHasLocations } from "@/lib/auth/post-login-route";
import { createClient } from "@/lib/supabase/server";
import { claimsToUserShape, getSessionClaims } from "@/lib/supabase/auth";
import { buildOperatorProfileFromUserRow } from "@/lib/user/queries";
import { buildFallbackOperatorProfile } from "@/lib/user/build-fallback-profile";
import type { OperatorProfile } from "@/lib/user/types";
import type { UserRole } from "@/lib/user/types";

export type ModulePageContext = {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  orgName: string;
  operatorProfile: OperatorProfile | null;
  operatorRole: UserRole;
  approvalAlertCount: number;
};

/**
 * Shared gate for authenticated module pages: one auth read, light tenant check,
 * and shell data in parallel (avoids fetchOnboardingSnapshot on every navigation).
 */
export async function loadModulePageContext(): Promise<ModulePageContext> {
  const supabase = await createClient();
  const claims = await getSessionClaims();

  if (!claims) redirect("/signup");

  const tenantId = claims.tenantId;
  if (!tenantId) redirect("/signup");

  const [{ data: tenant, error: tenantError }, hasLocations, { data: userRow }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("name, trade_name, onboarding_status")
        .eq("id", tenantId)
        .single(),
      tenantHasLocations(supabase, tenantId),
      supabase
        .from("users")
        .select(
          "first_name, last_name, role, assigned_location_id, avatar_url, metadata_json"
        )
        .eq("id", claims.userId)
        .maybeSingle(),
    ]);

  if (tenantError || !tenant) redirect("/signup");

  if (!hasLocations) redirect("/onboarding");

  const orgName = tenant.trade_name || tenant.name;

  let resolvedProfile: OperatorProfile;
  if (userRow) {
    let locationName: string | null = null;
    if (userRow.assigned_location_id) {
      const { data: location } = await supabase
        .from("tenant_locations")
        .select("name")
        .eq("id", userRow.assigned_location_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      locationName = location?.name ?? null;
    }
    resolvedProfile = buildOperatorProfileFromUserRow(
      claims.userId,
      userRow,
      orgName,
      locationName
    );
  } else {
    resolvedProfile = buildFallbackOperatorProfile(
      claimsToUserShape(claims) as User,
      orgName
    );
  }

  return {
    supabase,
    tenantId,
    userId: claims.userId,
    orgName,
    operatorProfile: resolvedProfile,
    operatorRole: resolvedProfile.role,
    // Fetched client-side in DashboardShell to avoid four count queries on every SSR.
    approvalAlertCount: 0,
  };
}

/** Per-request dedupe when layout and page both need module context. */
export const getModulePageContext = cache(loadModulePageContext);
