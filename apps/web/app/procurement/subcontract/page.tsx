import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SubcontractManagementTerminal } from "@/components/procurement/subcontract/subcontract-management-terminal";
import { loadSubcontractAdminContext } from "@/app/procurement/subcontract/actions";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function SubcontractPage() {
  const { orgName, approvalAlertCount, operatorProfile, tenantId } = await getModulePageContext();
  const initialContext = await loadSubcontractAdminContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <SubcontractManagementTerminal initialContext={initialContext} />
    </DashboardShell>
  );
}
