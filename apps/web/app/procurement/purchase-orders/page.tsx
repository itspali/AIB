import { ClipboardList } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ProcurementPurchaseOrdersPage() {
  const { orgName, approvalAlertCount, operatorProfile, tenantId } =
    await getModulePageContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ComingSoonModule
        title="Purchase Orders"
        description="Raise and track purchase orders from requisition through goods receipt."
        icon={ClipboardList}
        plannedSections={["Draft POs", "Approvals", "Receipt matching"]}
      />
    </DashboardShell>
  );
}
