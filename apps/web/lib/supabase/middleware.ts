import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isOnboarding = pathname.startsWith("/onboarding");
  const isLogin = pathname.startsWith("/login");

  if (!user && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const tenantId = user.app_metadata?.tenant_id as string | undefined;

    if (tenantId) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("onboarding_status")
        .eq("id", tenantId)
        .single();

      const isComplete = tenant?.onboarding_status === "GO_LIVE_READY";

      if (!isComplete && !isOnboarding && !isLogin) {
        const url = request.nextUrl.clone();
        url.pathname = "/onboarding";
        return NextResponse.redirect(url);
      }
    }

    if (isLogin) {
      const url = request.nextUrl.clone();
      url.pathname = tenantId ? "/onboarding" : "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
