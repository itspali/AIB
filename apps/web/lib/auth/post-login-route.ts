import type { SupabaseClient } from "@supabase/supabase-js";

export type PostLoginRoute = "/onboarding" | "/dashboard";

export async function tenantHasLocations(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { count } = await supabase
    .from("tenant_locations")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  return (count ?? 0) > 0;
}

/** True only for brand-new tenants that must finish step 1 before using the workspace. */
export async function requiresOnboardingWizard(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  return !(await tenantHasLocations(supabase, tenantId));
}

export async function resolvePostLoginRoute(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PostLoginRoute> {
  if (await requiresOnboardingWizard(supabase, tenantId)) {
    return "/onboarding";
  }

  return "/dashboard";
}
