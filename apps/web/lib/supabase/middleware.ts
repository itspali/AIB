import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import {
  IMPERSONATION_COOKIE_NAME,
  verifyImpersonationPayload,
} from "@/lib/console/impersonation-middleware";

/** Short-lived cache to skip a tenants-table read on every client navigation. */
const TENANT_ACTIVE_COOKIE = "aib-tenant-active";
const TENANT_ACTIVE_MAX_AGE_SEC = 120;

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

  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims as
    | { sub?: string; aal?: string; app_metadata?: { tenant_id?: string } }
    | undefined;
  const user = claims?.sub ? claims : null;

  const pathname = request.nextUrl.pathname;
  const isConsole = pathname.startsWith("/console");
  const isConsoleUnauthorized = pathname.startsWith("/console/unauthorized");
  const isMfaChallenge = pathname.startsWith("/login/mfa-challenge");
  const isMfaEnroll = pathname.startsWith("/login/mfa-enroll");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isLogin = pathname.startsWith("/login");
  const isLoginLanding = pathname === "/login" || pathname === "/login/";
  const isSignup = pathname.startsWith("/signup");
  const isSignupLanding = pathname === "/signup" || pathname === "/signup/";
  const isAuthCallback = pathname.startsWith("/auth/callback");
  const isPasswordReset = pathname.startsWith("/auth/reset-password");
  const isLegal = pathname.startsWith("/legal");
  const isSuspended = pathname.startsWith("/suspended");
  const isMaintenance = pathname.startsWith("/maintenance");
  const isSignupApi = pathname.startsWith("/api/signup");
  const isPublicAuth =
    isLogin ||
    isSignup ||
    isSignupApi ||
    isAuthCallback ||
    isPasswordReset ||
    isLegal ||
    isMfaChallenge ||
    isMfaEnroll;
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (isSignupApi) {
    return supabaseResponse;
  }

  // Server Actions expect the RSC action protocol. Redirects and plain-text
  // responses break the client with "An unexpected response was received from
  // the server." Auth, onboarding, and impersonation guards run in actions.
  if (isServerAction) {
    return supabaseResponse;
  }

  if (!user && !isPublicAuth && !isConsoleUnauthorized) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (isConsole) url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const impersonationRaw = user
    ? request.cookies.get(IMPERSONATION_COOKIE_NAME)?.value
    : undefined;
  const impersonationPeek = user ? await verifyImpersonationPayload(impersonationRaw) : null;

  // Patch JWT tenant_id in middleware so request cookies update before RSC runs.
  // Server Components cannot reliably persist auth cookie writes (read-only context).
  if (user && impersonationPeek && !isConsole) {
    const jwtTenant = user.app_metadata?.tenant_id;
    if (jwtTenant !== impersonationPeek.tenantId) {
      await supabase.rpc("console_apply_impersonation_jwt", {
        p_session_id: impersonationPeek.sessionId,
      });
      await supabase.auth.refreshSession();
    }
  }

  if (user && isConsole && !isConsoleUnauthorized) {
    return supabaseResponse;
  }

  if (user && !isPublicAuth && !isConsole && !isSuspended && !isMaintenance) {
    const maintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === "true";
    if (maintenanceMode) {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.redirect(url);
    }
  }

  if (user) {
    let tenantId = user.app_metadata?.tenant_id;

    if (impersonationPeek && !isConsole) {
      tenantId = impersonationPeek.tenantId;
    }

    if (!tenantId) {
      const operatorConsolePath =
        isConsole || isConsoleUnauthorized || isMfaChallenge || isMfaEnroll || isLogin || isSignup;
      if (!operatorConsolePath) {
        const url = request.nextUrl.clone();
        url.pathname = "/signup";
        return NextResponse.redirect(url);
      }
      return supabaseResponse;
    }

    if (!isConsole && !isPublicAuth && !isSuspended && !isMaintenance) {
      const tenantActiveCached =
        request.cookies.get(TENANT_ACTIVE_COOKIE)?.value === tenantId;

      if (!tenantActiveCached) {
        const { data: tenant } = await supabase
          .from("tenants")
          .select("is_active, status")
          .eq("id", tenantId)
          .maybeSingle();

        if (tenant && (!tenant.is_active || tenant.status === "SUSPENDED")) {
          const url = request.nextUrl.clone();
          url.pathname = "/suspended";
          const redirect = NextResponse.redirect(url);
          redirect.cookies.delete(TENANT_ACTIVE_COOKIE);
          return redirect;
        }

        if (tenant) {
          supabaseResponse.cookies.set(TENANT_ACTIVE_COOKIE, tenantId, {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            maxAge: TENANT_ACTIVE_MAX_AGE_SEC,
          });
        }
      }
    }

    const onboardedCookie = request.cookies.get("aib-onboarded")?.value === "1";
    const needsRouteDecision =
      isOnboarding ||
      isLoginLanding ||
      isSignupLanding ||
      isPasswordReset ||
      (!onboardedCookie && !isConsole);

    if (!needsRouteDecision || isConsole) {
      return supabaseResponse;
    }

    // Console MFA routes must render — never bounce authenticated users via ?next=.
    if (isMfaChallenge || isMfaEnroll) {
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

    if (needsOnboarding && !isOnboarding && !isPublicAuth && !isConsole) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if ((isLoginLanding || isSignupLanding) && !isServerAction) {
      const next = request.nextUrl.searchParams.get("next");
      const url = request.nextUrl.clone();
      if (next && next.startsWith("/") && !next.startsWith("//")) {
        url.pathname = next.split("?")[0] ?? next;
      } else {
        url.pathname = postLoginRoute;
      }
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
