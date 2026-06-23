import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { claimsToUserShape, getSessionClaims } from "@/lib/supabase/auth";
import { getAppShellBootstrap } from "@/lib/layout/app-shell-bootstrap";
import { fetchActiveTenantMembership } from "@/lib/user/membership";
import { buildFallbackOperatorProfile } from "@/lib/user/build-fallback-profile";
import type { OperatorProfile } from "@/lib/user/types";
import type { UserRole } from "@/lib/user/types";

import { resolveEffectiveTenant } from "@/lib/supabase/effective-tenant";
import type { ImpersonationPayload } from "@/lib/console/impersonation-cookie";
import { fetchWorkspaceDeletionStatus, type WorkspaceDeletionStatus } from "@/lib/organization/deletion";

export type ImpersonationBannerContext = {
  tenantName: string;
  organizationCode: string | null;
  mode: "READ_ONLY" | "WRITE";
};

export type ModulePageContext = {
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
  orgName: string;
  operatorProfile: OperatorProfile | null;
  operatorRole: UserRole;
  approvalAlertCount: number;
  impersonation: ImpersonationBannerContext | null;
  workspaceDeletion: WorkspaceDeletionStatus | null;
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

  const { tenantId, impersonation: impersonationPayload } = await resolveEffectiveTenant(
    claims.tenantId
  );
  if (!tenantId) redirect("/signup");

  if (!bootstrap.tenant) redirect("/signup");
  if (!bootstrap.hasWorkspaceAccess) redirect("/onboarding");

  const tenant = bootstrap.tenant;
  const orgName = tenant.trade_name || tenant.name;

  const [membership, workspaceDeletion] = await Promise.all([
    impersonationPayload
      ? Promise.resolve(null)
      : fetchActiveTenantMembership(supabase, claims.userId, tenantId),
    fetchWorkspaceDeletionStatus(supabase).catch(() => null),
  ]);

  const resolvedProfile = buildFallbackOperatorProfile(
    claimsToUserShape(claims) as User,
    orgName
  );
  if (membership) {
    resolvedProfile.role = membership.role;
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      resolvedProfile.locationLabel = membership.assigned_location_id
        ? "Assigned branch"
        : "Unassigned";
    }
  }

  const operatorRole = resolvedProfile.role;

  let impersonation: ImpersonationBannerContext | null = null;
  if (impersonationPayload) {
    impersonation = {
      tenantName: orgName,
      organizationCode: tenant.organization_code,
      mode: impersonationPayload.mode,
    };
  }

  return {
    supabase,
    tenantId,
    userId: claims.userId,
    orgName,
    operatorProfile: resolvedProfile,
    operatorRole,
    // Fetched client-side in DashboardShell to avoid four count queries on every SSR.
    approvalAlertCount: 0,
    impersonation,
    workspaceDeletion,
  };
}

/** Per-request dedupe when layout and page both need module context. */
export const getModulePageContext = cache(loadModulePageContext);
