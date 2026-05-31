import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UomManagementTerminal } from "@/components/inventory/uom/uom-management-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveUomManagementAccess } from "@/lib/uom/access";
import { fetchUomRows } from "@/lib/uom/queries";

export default async function UomManagementPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [rows, access] = await Promise.all([
    fetchUomRows(supabase, tenantId),
    resolveUomManagementAccess(supabase, userId, tenantId),
  ]);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <UomManagementTerminal initialRows={rows} canManage={access.canManage} />
    </DashboardShell>
  );
}
