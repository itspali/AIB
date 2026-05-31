import { ClipboardList } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function SalesOrdersPage() {
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
        title="Orders"
        description="Capture and fulfil sales orders across channels and locations."
        icon={ClipboardList}
        plannedSections={["Order intake", "Allocation", "Fulfilment status"]}
      />
    </DashboardShell>
  );
}
