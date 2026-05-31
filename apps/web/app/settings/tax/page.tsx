import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TaxSettingsTerminal } from "@/components/settings/tax-settings-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveTaxSettingsAccess } from "@/lib/tax/access";
import { fetchTaxCodeRows } from "@/lib/tax/queries";

export default async function TaxSettingsPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [rows, access] = await Promise.all([
    fetchTaxCodeRows(supabase, tenantId),
    resolveTaxSettingsAccess(supabase, userId, tenantId),
  ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <TaxSettingsTerminal initialRows={rows} canEdit={access.granted} />
    </DashboardShell>
  );
}
