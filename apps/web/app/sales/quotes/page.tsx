import { FileText } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function SalesQuotesPage() {
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
        title="Quotes"
        description="Create and track sales quotations before they convert to orders."
        icon={FileText}
        plannedSections={["Draft quotes", "Approvals", "Conversion to orders"]}
      />
    </DashboardShell>
  );
}
