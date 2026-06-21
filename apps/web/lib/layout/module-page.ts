import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { claimsToUserShape, getSessionClaims } from "@/lib/supabase/auth";
import { getAppShellBootstrap } from "@/lib/layout/app-shell-bootstrap";
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
  const [supabase, claims, bootstrap] = await Promise.all([
    createClient(),
    getSessionClaims(),
    getAppShellBootstrap(),
  ]);

  if (!claims) redirect("/signup");

  const tenantId = claims.tenantId;
  if (!tenantId) redirect("/signup");

  if (!bootstrap.tenant) redirect("/signup");
  if (!bootstrap.hasWorkspaceAccess) redirect("/onboarding");

  const tenant = bootstrap.tenant;
  const operatorProfile = await fetchOperatorProfile(supabase, claims.userId, tenantId);

  const orgName = tenant.trade_name || tenant.name;

  const resolvedProfile =
    operatorProfile ??
    buildFallbackOperatorProfile(claimsToUserShape(claims) as User, orgName);

  const operatorRole = resolvedProfile.role;

  return {
    supabase,
    tenantId,
    userId: claims.userId,
    orgName,
    operatorProfile: resolvedProfile,
    operatorRole,
    // Fetched client-side in DashboardShell to avoid four count queries on every SSR.
    approvalAlertCount: 0,
  };
}

/** Per-request dedupe when layout and page both need module context. */
export const getModulePageContext = cache(loadModulePageContext);
