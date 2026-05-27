import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";

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
  const isSignup = pathname.startsWith("/signup");
  const isSignupApi = pathname.startsWith("/api/signup");
  const isPublicAuth = isLogin || isSignup || isSignupApi;
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (isSignupApi) {
    return supabaseResponse;
  }

  if (!user && !isPublicAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    const tenantId = user.app_metadata?.tenant_id as string | undefined;

    if (!tenantId) {
      if (!isSignup) {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    const postLoginRoute = await resolvePostLoginRoute(supabase, tenantId);
    const needsOnboarding = postLoginRoute === "/onboarding";

    if (needsOnboarding && !isOnboarding && !isPublicAuth) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (!needsOnboarding && isOnboarding) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if ((isLogin || isSignup) && !isServerAction) {
      const url = request.nextUrl.clone();
      url.pathname = postLoginRoute;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
