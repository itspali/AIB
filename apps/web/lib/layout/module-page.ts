import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { createClient } from "@/lib/supabase/server";
import { fetchOperatorProfile } from "@/lib/user/queries";
import { buildFallbackOperatorProfile } from "@/lib/user/build-fallback-profile";
import type { OperatorProfile } from "@/lib/user/types";
import type { UserRole } from "@/lib/user/types";

export type ModulePageContext = {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  orgName: string;
  operatorProfile: OperatorProfile | null;
  operatorRole: UserRole;
  approvalAlertCount: number;
};

/**
 * Shared gate for authenticated module pages: one auth read, light tenant check,
 * and shell data in parallel (avoids fetchOnboardingSnapshot on every navigation).
 */
export async function loadModulePageContext(): Promise<ModulePageContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signup");

  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) redirect("/signup");

  const [{ data: tenant, error: tenantError }, approvalAlertCount, operatorProfile] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("name, trade_name, onboarding_status")
        .eq("id", tenantId)
        .single(),
      fetchApprovalAlertCount(supabase, tenantId),
      fetchOperatorProfile(supabase, user.id, tenantId),
    ]);

  if (tenantError || !tenant) redirect("/signup");

  if (tenant.onboarding_status !== "GO_LIVE_READY") redirect("/onboarding");

  const orgName = tenant.trade_name || tenant.name;
  const resolvedProfile =
    operatorProfile ?? buildFallbackOperatorProfile(user, orgName);

  return {
    supabase,
    tenantId,
    userId: user.id,
    orgName,
    operatorProfile: resolvedProfile,
    operatorRole: resolvedProfile.role,
    approvalAlertCount,
  };
}

/** Per-request dedupe when layout and page both need module context. */
export const getModulePageContext = cache(loadModulePageContext);
