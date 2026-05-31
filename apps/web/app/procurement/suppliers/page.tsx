import { Building2 } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ProcurementSuppliersPage() {
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
        title="Suppliers"
        description="Maintain supplier profiles, contacts, and purchasing terms."
        icon={Building2}
        plannedSections={["Vendor master", "Contacts", "Payment terms"]}
      />
    </DashboardShell>
  );
}
