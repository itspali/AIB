import { redirect } from "next/navigation";
import { AdministrativeAccessDeniedView } from "@/components/settings/administrative-access-denied-view";
import { OrganizationSettingsTerminal } from "@/components/settings/organization-settings-terminal";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { getTenantLogoSignedUrl } from "@/lib/organization/logo";
import { fetchOrganizationSettingsSnapshot } from "@/lib/organization/queries";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { createClient } from "@/lib/supabase/server";

export default async function OrganizationSettingsPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const onboardingSnapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!onboardingSnapshot) redirect("/signup");

  if (!onboardingSnapshot.isOnboardingComplete) redirect("/onboarding");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orgName = onboardingSnapshot.tenant.trade_name || onboardingSnapshot.tenant.name;

  const [access, operatorProfile, approvalAlertCount] = await Promise.all([
    resolveOrganizationSettingsAccess(supabase, user.id, tenantId),
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

  const logoPreviewUrl = await getTenantLogoSignedUrl(supabase, snapshot.logo_url);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <OrganizationSettingsTerminal
        snapshot={snapshot}
        access={access}
        tenantId={tenantId}
        logoPreviewUrl={logoPreviewUrl}
      />
    </DashboardShell>
  );
}
