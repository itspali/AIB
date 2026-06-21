import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims, getSessionTenantId } from "@/lib/supabase/auth";
import { fetchThemePolicyForSession } from "@/lib/theme/queries";
import type { ResolvedThemePolicy } from "@/lib/theme/governance";

export type AppShellBootstrap = {
  tenantId: string | null;
  userId: string | null;
  themeCookie: string | undefined;
  themePolicy: ResolvedThemePolicy | null;
  tenant: {
    name: string;
    trade_name: string | null;
    onboarding_status: string;
  } | null;
  locationCount: number;
  onboardingComplete: boolean;
  hasWorkspaceAccess: boolean;
};

async function loadAppShellBootstrap(): Promise<AppShellBootstrap> {
  const [tenantId, themeCookie, claims] = await Promise.all([
    getSessionTenantId(),
    cookies().then((store) => store.get("aib-theme")?.value),
    getSessionClaims(),
  ]);

  if (!tenantId) {
    return {
      tenantId: null,
      userId: claims?.userId ?? null,
      themeCookie,
      themePolicy: null,
      tenant: null,
      locationCount: 0,
      onboardingComplete: false,
      hasWorkspaceAccess: false,
    };
  }

  const supabase = await createClient();
  const [{ data: tenant }, { count: locationCount }, themePolicy] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, trade_name, onboarding_status")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("tenant_locations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    claims?.userId
      ? fetchThemePolicyForSession(supabase, tenantId, claims.userId)
      : Promise.resolve(null),
  ]);

  const resolvedLocationCount = locationCount ?? 0;

  return {
    tenantId,
    userId: claims?.userId ?? null,
    themeCookie,
    themePolicy,
    tenant: tenant ?? null,
    locationCount: resolvedLocationCount,
    onboardingComplete: tenant?.onboarding_status === "GO_LIVE_READY",
    hasWorkspaceAccess: resolvedLocationCount > 0,
  };
}

/** Per-request dedupe for root layout, module layouts, and settings shell. */
export const getAppShellBootstrap = cache(loadAppShellBootstrap);
