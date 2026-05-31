import { ShoppingCart } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ProcurementPage() {
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
        title="Procurement"
        description="Source goods and services, raise purchase orders, and manage supplier bills."
        icon={ShoppingCart}
        plannedSections={["Overview", "Purchase Orders", "Suppliers", "Bills"]}
      />
    </DashboardShell>
  );
}
