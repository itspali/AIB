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

  // `getClaims()` verifies the session JWT locally against the cached JWKS
  // (the project uses an asymmetric signing key), avoiding an Auth-server
  // round-trip on every request that `getUser()` would incur.
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as
    | { sub?: string; app_metadata?: { tenant_id?: string } }
    | undefined;
  const user = claims?.sub ? claims : null;

  const pathname = request.nextUrl.pathname;
  const isOnboarding = pathname.startsWith("/onboarding");
  const isLogin = pathname.startsWith("/login");
  const isSignup = pathname.startsWith("/signup");
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isPasswordReset = pathname.startsWith("/auth/reset-password");
  const isLegal = pathname.startsWith("/legal");
  const isSignupApi = pathname.startsWith("/api/signup");
  const isPublicAuth =
    isLogin || isSignup || isSignupApi || isAuthCallback || isPasswordReset || isLegal;
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
    const tenantId = user.app_metadata?.tenant_id;

    if (!tenantId) {
      if (!isSignup) {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    // Fast path: once a tenant is confirmed onboarded we stamp a cookie so the
    // common case (an onboarded user navigating normal routes) needs no DB
    // round-trip here. The onboarding-decision routes still revalidate.
    const onboardedCookie = request.cookies.get("aib-onboarded")?.value === "1";
    const needsRouteDecision =
      isOnboarding || isLogin || isSignup || isPasswordReset || !onboardedCookie;

    if (!needsRouteDecision) {
      return supabaseResponse;
    }

    const postLoginRoute = await resolvePostLoginRoute(supabase, tenantId);
    const needsOnboarding = postLoginRoute === "/onboarding";

    if (needsOnboarding) {
      supabaseResponse.cookies.delete("aib-onboarded");
    } else {
      supabaseResponse.cookies.set("aib-onboarded", "1", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
      });
    }

    if (needsOnboarding && !isOnboarding && !isPublicAuth) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
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
