import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProcurementOverviewTerminal } from "@/components/procurement/procurement-overview-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProcurementSettings } from "@/lib/procurement/settings";

export default async function ProcurementPage() {
  const { supabase, tenantId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const procurementSettings = await fetchProcurementSettings(supabase, tenantId);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ProcurementOverviewTerminal procurementSettings={procurementSettings} />
    </DashboardShell>
  );
}
