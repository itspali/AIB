import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_TENANT_THEME_SETTINGS,
  parseLocationThemeOverride,
  parseTenantThemeSettings,
  readLocationThemeFromMeta,
  resolveThemePolicy,
  THEME_SETTINGS_REGISTRY_KEY,
  type ResolvedThemePolicy,
} from "@/lib/theme/governance";

export async function fetchTenantThemeSettings(
  supabase: SupabaseClient,
  tenantId: string
) {
  const { data } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", THEME_SETTINGS_REGISTRY_KEY)
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  return parseTenantThemeSettings(data?.configuration_metadata ?? null);
}

export async function fetchThemePolicyForSession(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string
): Promise<ResolvedThemePolicy> {
  const [{ data: userRow }, tenantSettings] = await Promise.all([
    supabase
      .from("users")
      .select("assigned_location_id")
      .eq("id", userId)
      .eq("tenant_id", tenantId)
      .maybeSingle(),
    fetchTenantThemeSettings(supabase, tenantId),
  ]);

  let locationOverride = null;
  if (userRow?.assigned_location_id && tenantSettings.allow_location_theme_override) {
    const { data: locationRow } = await supabase
      .from("tenant_locations")
      .select("location_meta")
      .eq("id", userRow.assigned_location_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const locationMeta =
      locationRow?.location_meta && typeof locationRow.location_meta === "object"
        ? (locationRow.location_meta as Record<string, unknown>)
        : null;
    locationOverride = readLocationThemeFromMeta(locationMeta);
  }

  return resolveThemePolicy({
    tenantSettings: tenantSettings ?? DEFAULT_TENANT_THEME_SETTINGS,
    locationOverride,
  });
}

export function parseLocationThemeFromMeta(raw: unknown) {
  return parseLocationThemeOverride(raw);
}
