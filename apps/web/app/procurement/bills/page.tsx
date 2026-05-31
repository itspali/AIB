import { ScrollText } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ProcurementBillsPage() {
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
        title="Bills"
        description="Record supplier bills and match them to purchase orders and receipts."
        icon={ScrollText}
        plannedSections={["Bill capture", "Three-way match", "Payment scheduling"]}
      />
    </DashboardShell>
  );
}
