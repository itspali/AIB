import { AdministrativeAccessDeniedView } from "@/components/settings/administrative-access-denied-view";
import { AccessSettingsTerminal } from "@/components/settings/access/access-settings-terminal";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationSettingsSnapshot } from "@/lib/organization/queries";
import { fetchTenantReportingLines } from "@/lib/organization/reporting-lines";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function AccessSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
  if (!access.granted) {
    return <AdministrativeAccessDeniedView />;
  }

  const snapshot = await fetchOrganizationSettingsSnapshot(supabase, tenantId);
  if (!snapshot) {
    return <p className="text-sm text-muted-foreground">Unable to load access settings.</p>;
  }

  const reportingLines = await fetchTenantReportingLines(supabase, tenantId);

  return (
    <AccessSettingsTerminal
      snapshot={snapshot}
      access={access}
      reportingLines={reportingLines}
    />
  );
}
