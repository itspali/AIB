import { GitManagementTerminal } from "@/components/procurement/goods-in-transit/git-management-terminal";
import { loadGitCatalogContext } from "@/app/procurement/goods-in-transit/actions";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function GoodsInTransitPage() {
  const { orgName, approvalAlertCount, operatorProfile, tenantId } = await getModulePageContext();
  const { vouchers, sourceLocations, gitLocations, receivableOrders } =
    await loadGitCatalogContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <GitManagementTerminal
        initialVouchers={vouchers}
        sourceLocations={sourceLocations}
        gitLocations={gitLocations}
        receivableOrders={receivableOrders}
      />
    </DashboardShell>
  );
}
