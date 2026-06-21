import { OrgSettingsReviewTracker } from "@/components/dashboard/org-settings-review-tracker";
import { AdministrativeAccessDeniedView } from "@/components/settings/administrative-access-denied-view";
import { OrganizationSettingsTerminalLazy } from "@/components/settings/organization-settings-terminal-lazy";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { getTenantLogoSignedUrl } from "@/lib/organization/logo";
import { fetchPendingGroupInvitationsForTenant } from "@/lib/group/invitations";
import { fetchOrganizationSettingsSnapshot } from "@/lib/organization/queries";
import { fetchTenantReportingLines } from "@/lib/organization/reporting-lines";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function OrganizationSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.granted) {
    return <AdministrativeAccessDeniedView />;
  }

  const snapshot = await fetchOrganizationSettingsSnapshot(supabase, tenantId);
  if (!snapshot) {
    return (
      <p className="text-sm text-muted-foreground">Unable to load organization settings.</p>
    );
  }

  const [logoPreviewUrl, groupInvitations, reportingLines] = await Promise.all([
    getTenantLogoSignedUrl(supabase, snapshot.logo_url),
    access.isOwner && !snapshot.parent_group_name
      ? fetchPendingGroupInvitationsForTenant(supabase)
      : Promise.resolve([]),
    fetchTenantReportingLines(supabase, tenantId),
  ]);

  return (
    <>
      <OrgSettingsReviewTracker />
      <OrganizationSettingsTerminalLazy
        snapshot={snapshot}
        access={access}
        tenantId={tenantId}
        logoPreviewUrl={logoPreviewUrl}
        groupInvitations={groupInvitations}
        reportingLines={reportingLines}
      />
    </>
  );
}
