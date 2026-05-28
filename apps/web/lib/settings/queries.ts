import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTimezone } from "@/lib/settings/timezone-options";
import type { AuthSessionRow, ProfileSettingsSnapshot, UiDensity } from "@/lib/settings/types";

function parseUiDensity(raw: unknown): UiDensity {
  return raw === "DENSE" ? "DENSE" : "STANDARD";
}

function parseTimezone(raw: unknown): string {
  return typeof raw === "string" && raw.trim() ? raw.trim() : defaultTimezone();
}

export async function fetchProfileSettingsSnapshot(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<ProfileSettingsSnapshot | null> {
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("first_name, last_name, email, phone_number, avatar_url, metadata_json")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !userRow) return null;

  const metadata =
    userRow.metadata_json && typeof userRow.metadata_json === "object"
      ? (userRow.metadata_json as Record<string, unknown>)
      : {};

  const { data: sessions, error: sessionsError } = await supabase
    .from("user_auth_sessions")
    .select("id, os_browser, ip_address, last_activity_at, is_current")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .order("last_activity_at", { ascending: false });

  if (sessionsError) {
    return {
      userId,
      email: userRow.email,
      first_name: userRow.first_name,
      last_name: userRow.last_name,
      phone_number: userRow.phone_number ?? "",
      avatar_url: userRow.avatar_url,
      timezone: parseTimezone(metadata.timezone),
      ui_density: parseUiDensity(metadata.ui_density),
      sessions: [],
      mfaEnabled: false,
    };
  }

  return {
    userId,
    email: userRow.email,
    first_name: userRow.first_name,
    last_name: userRow.last_name,
    phone_number: userRow.phone_number ?? "",
    avatar_url: userRow.avatar_url,
    timezone: parseTimezone(metadata.timezone),
    ui_density: parseUiDensity(metadata.ui_density),
    sessions: (sessions ?? []) as AuthSessionRow[],
    mfaEnabled: false,
  };
}
