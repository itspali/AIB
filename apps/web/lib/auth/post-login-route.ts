import type { SupabaseClient } from "@supabase/supabase-js";

export type PostLoginRoute = "/onboarding" | "/dashboard";

export async function resolvePostLoginRoute(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PostLoginRoute> {
  const [{ count: locationCount }, { data: tenant }] = await Promise.all([
    supabase
      .from("tenant_locations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase.from("tenants").select("onboarding_status").eq("id", tenantId).single(),
  ]);

  if ((locationCount ?? 0) === 0) {
    return "/onboarding";
  }

  if (tenant?.onboarding_status !== "GO_LIVE_READY") {
    return "/onboarding";
  }

  return "/dashboard";
}
