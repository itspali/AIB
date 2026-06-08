import { redirect } from "next/navigation";
import { OrgSettingsReviewTracker } from "@/components/dashboard/org-settings-review-tracker";
import { AdministrativeAccessDeniedView } from "@/components/settings/administrative-access-denied-view";
import { OrganizationSettingsTerminal } from "@/components/settings/organization-settings-terminal";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { getTenantLogoSignedUrl } from "@/lib/organization/logo";
import { fetchPendingGroupInvitationsForTenant } from "@/lib/group/invitations";
import { fetchOrganizationSettingsSnapshot } from "@/lib/organization/queries";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOnboardingSnapshot, hasWorkspaceAccess } from "@/lib/onboarding/status";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { getSessionClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function OrganizationSettingsPage() {
  const [supabase, claims] = await Promise.all([createClient(), getSessionClaims()]);

  if (!claims?.tenantId) redirect("/signup");
  const tenantId = claims.tenantId;

  const onboardingSnapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!onboardingSnapshot) redirect("/signup");

  if (!hasWorkspaceAccess(onboardingSnapshot)) redirect("/onboarding");

  const orgName = onboardingSnapshot.tenant.trade_name || onboardingSnapshot.tenant.name;

  const [access, operatorProfile, approvalAlertCount] = await Promise.all([
    resolveOrganizationSettingsAccess(supabase, claims.userId, tenantId),
    fetchOperatorProfileForSession(supabase, orgName),
    fetchApprovalAlertCount(supabase, tenantId),
  ]);

  if (!access.granted) {
    return (
      <DashboardShell
        orgName={orgName}
        approvalAlertCount={approvalAlertCount}
        operatorProfile={operatorProfile}
        tenantId={tenantId}
      >
        <AdministrativeAccessDeniedView />
      </DashboardShell>
    );
  }

  const snapshot = await fetchOrganizationSettingsSnapshot(supabase, tenantId);

  if (!snapshot) {
    return (
      <DashboardShell
        orgName={orgName}
        approvalAlertCount={approvalAlertCount}
        operatorProfile={operatorProfile}
        tenantId={tenantId}
      >
        <p className="text-sm text-muted-foreground">Unable to load organization settings.</p>
      </DashboardShell>
    );
  }

  const [logoPreviewUrl, groupInvitations] = await Promise.all([
    getTenantLogoSignedUrl(supabase, snapshot.logo_url),
    access.isOwner && !snapshot.parent_group_name
      ? fetchPendingGroupInvitationsForTenant(supabase)
      : Promise.resolve([]),
  ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <OrgSettingsReviewTracker />
      <OrganizationSettingsTerminal
        snapshot={snapshot}
        access={access}
        tenantId={tenantId}
        logoPreviewUrl={logoPreviewUrl}
        groupInvitations={groupInvitations}
      />
    </DashboardShell>
  );
}
