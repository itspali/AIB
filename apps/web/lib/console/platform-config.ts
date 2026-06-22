import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformConfigKey =
  | "signup_enabled"
  | "maintenance_mode"
  | "console_mfa_required"
  | "trial_expiry_action";

export async function getPlatformConfigValue<T>(
  admin: SupabaseClient,
  key: PlatformConfigKey,
  fallback: T
): Promise<T> {
  const { data } = await admin.from("platform_config").select("value").eq("key", key).maybeSingle();
  if (!data?.value) return fallback;
  return data.value as T;
}

export async function setPlatformConfigValue(
  admin: SupabaseClient,
  key: PlatformConfigKey,
  value: unknown,
  updatedBy: string | null
): Promise<void> {
  const { error } = await admin.from("platform_config").upsert({
    key,
    value,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
