import { Truck } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function FulfillmentShippingPage() {
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
        title="Fulfillment & Shipping"
        description="Pick, pack, and ship customer orders to delivery partners."
        icon={Truck}
        plannedSections={["Shipments", "Packing slips", "Carrier tracking"]}
      />
    </DashboardShell>
  );
}
