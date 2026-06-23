import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims, getSessionTenantId } from "@/lib/supabase/auth";
import type { ResolvedThemePolicy } from "@/lib/theme/governance";
import {
  parseBusinessModel,
  type BusinessModel,
} from "@/lib/onboarding/business-model";
import { isFinanceSetupComplete } from "@/lib/onboarding/finance-setup-gate";

export type AppShellBootstrap = {
  tenantId: string | null;
  userId: string | null;
  themeCookie: string | undefined;
  themePolicy: ResolvedThemePolicy | null;
  tenant: {
    name: string;
    trade_name: string | null;
    organization_code: string | null;
    onboarding_status: string;
    metadata_json: Record<string, unknown> | null;
  } | null;
  businessModel: BusinessModel;
  locationCount: number;
  onboardingComplete: boolean;
  financeSetupComplete: boolean;
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
      businessModel: "B2B",
      locationCount: 0,
      onboardingComplete: false,
      financeSetupComplete: false,
      hasWorkspaceAccess: false,
    };
  }

  const supabase = await createClient();
  const [{ data: tenant }, { count: locationCount }] = await Promise.all([
    supabase
      .from("tenants")
      .select("name, trade_name, organization_code, onboarding_status, metadata_json")
      .eq("id", tenantId)
      .single(),
    supabase
      .from("tenant_locations")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const resolvedLocationCount = locationCount ?? 0;
  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const businessModel = parseBusinessModel(metadata.business_model);
  const financeSetupComplete = isFinanceSetupComplete(tenant?.onboarding_status);

  return {
    tenantId,
    userId: claims?.userId ?? null,
    themeCookie,
    themePolicy: null,
    tenant: tenant
      ? {
          name: tenant.name,
          trade_name: tenant.trade_name,
          organization_code: tenant.organization_code ?? null,
          onboarding_status: tenant.onboarding_status,
          metadata_json: metadata,
        }
      : null,
    businessModel,
    locationCount: resolvedLocationCount,
    onboardingComplete: financeSetupComplete,
    financeSetupComplete,
    hasWorkspaceAccess: resolvedLocationCount > 0,
  };
}

/** Per-request dedupe for root layout, module layouts, and settings shell. */
export const getAppShellBootstrap = cache(loadAppShellBootstrap);
