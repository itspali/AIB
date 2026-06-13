"use server";

import { cookies } from "next/headers";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_PATH,
} from "@/lib/auth/recovery-cookie";
import { resetPasswordSchema } from "@/lib/auth/reset-password-schema";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

export async function completePasswordReset(raw: unknown) {
  const cookieStore = await cookies();
  if (cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value !== "1") {
    return {
      error: "This reset link has expired or is invalid. Request a new one from the sign-in page.",
    };
  }

  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid password" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });

  if (error) {
    return { error: error.message };
  }

  cookieStore.set(PASSWORD_RECOVERY_COOKIE, "", {
    path: PASSWORD_RECOVERY_COOKIE_PATH,
    maxAge: 0,
  });

  const tenantId = await getTenantIdFromSession(supabase);
  const redirectTo = tenantId
    ? await resolvePostLoginRoute(supabase, tenantId)
    : "/login?password_updated=1";

  return { success: true as const, redirectTo };
}
