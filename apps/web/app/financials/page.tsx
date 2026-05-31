import { Boxes } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function FinancialsPage() {
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
        title="Financials"
        description="Maintain the chart of accounts, ledgers, and tax filings."
        icon={Boxes}
        plannedSections={["Chart of Accounts", "Ledger", "Tax Filings"]}
      />
    </DashboardShell>
  );
}
