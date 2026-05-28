"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { profileSettingsSchema } from "@/lib/settings/schemas";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { updateUserDutyStatus } from "@/app/account/actions";

const REVALIDATE_PATHS = [
  "/settings/profile",
  "/account",
  "/dashboard",
  "/items/categories",
];

function revalidateProfilePaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function applyProfileSecurityUpdates(raw: unknown) {
  const parsed = profileSettingsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile settings" };
  }

  const values = parsed.data;
  const { supabase, tenantId } = await requireTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { error: prefsError } = await supabase.rpc("update_user_preferences", {
    p_timezone: values.timezone,
    p_ui_density: values.ui_density,
  });

  if (prefsError) {
    if (isMissingRpcError(prefsError)) {
      return { error: formatRpcDeployError("update_user_preferences") };
    }
    return { error: prefsError.message };
  }

  const { error: profileError } = await supabase
    .from("users")
    .update({
      first_name: values.first_name.trim(),
      last_name: values.last_name.trim(),
      phone_number: values.phone_number.trim() || null,
      avatar_url: values.avatar_url.trim() || null,
    })
    .eq("id", user.id)
    .eq("tenant_id", tenantId);

  if (profileError) return { error: profileError.message };

  const wantsPasswordChange =
    values.current_password.trim() ||
    values.new_password.trim() ||
    values.confirm_password.trim();

  if (wantsPasswordChange) {
    const email = user.email;
    if (!email) return { error: "Email not available for password verification" };

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: values.current_password,
    });

    if (verifyError) {
      return { error: "Current password is incorrect" };
    }

    const { error: passwordError } = await supabase.auth.updateUser({
      password: values.new_password,
    });

    if (passwordError) return { error: passwordError.message };
  }

  revalidateProfilePaths();
  return { success: true as const };
}

export async function registerSessionTelemetry(input: {
  authSessionId: string;
  osBrowser: string;
}) {
  const { supabase } = await requireTenantId();
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || "Local development";

  const { error } = await supabase.rpc("register_user_auth_session", {
    p_auth_session_id: input.authSessionId,
    p_os_browser: input.osBrowser,
    p_ip_address: ipAddress,
    p_is_current: true,
  });

  if (error) {
    if (isMissingRpcError(error)) return { error: formatRpcDeployError("register_user_auth_session") };
    return { error: error.message };
  }

  revalidateProfilePaths();
  return { success: true as const };
}

export async function revokeOtherSessions(currentAuthSessionId: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("revoke_other_auth_sessions", {
    p_current_auth_session_id: currentAuthSessionId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("revoke_other_auth_sessions") };
    }
    return { error: error.message };
  }

  revalidateProfilePaths();
  return { success: true as const };
}

export { updateUserDutyStatus };
