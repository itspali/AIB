import { CreditCard } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function SalesPage() {
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
        title="Sales"
        description="Capture orders across channels, manage customers, and fulfil omnichannel demand."
        icon={CreditCard}
        plannedSections={["Overview", "Orders", "Customers", "Channels"]}
      />
    </DashboardShell>
  );
}
