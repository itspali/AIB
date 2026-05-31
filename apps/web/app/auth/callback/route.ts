import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const tenantId = await getTenantIdFromSession(supabase);
      if (tenantId) {
        const route = await resolvePostLoginRoute(supabase, tenantId);
        return NextResponse.redirect(`${origin}${next ?? route}`);
      }
      return NextResponse.redirect(`${origin}${next ?? "/signup?resume=1"}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
