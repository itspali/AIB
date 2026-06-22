import { NextResponse } from "next/server";
import {
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_MAX_AGE,
  PASSWORD_RECOVERY_COOKIE_PATH,
} from "@/lib/auth/recovery-cookie";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import { resolveSafeNextPath } from "@/lib/auth/safe-next-path";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { createClient } from "@/lib/supabase/server";

const PASSWORD_RESET_PATH = "/auth/reset-password";

function redirectWithOptionalRecoveryCookie(origin: string, path: string, isPasswordRecovery: boolean) {
  const response = NextResponse.redirect(`${origin}${path}`);

  if (isPasswordRecovery) {
    response.cookies.set(PASSWORD_RECOVERY_COOKIE, "1", {
      path: PASSWORD_RECOVERY_COOKIE_PATH,
      httpOnly: true,
      sameSite: "lax",
      maxAge: PASSWORD_RECOVERY_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const isPasswordRecovery = next === PASSWORD_RESET_PATH;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (isPasswordRecovery) {
        return redirectWithOptionalRecoveryCookie(origin, PASSWORD_RESET_PATH, true);
      }

      const tenantId = await getTenantIdFromSession(supabase);
      if (tenantId) {
        const route = await resolvePostLoginRoute(supabase, tenantId);
        const safeNext = resolveSafeNextPath(next, route);
        return NextResponse.redirect(`${origin}${safeNext}`);
      }
      const safeNext = resolveSafeNextPath(next, "/signup?resume=1");
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
