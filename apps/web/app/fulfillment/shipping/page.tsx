import { Suspense } from "react";
import { FulfillmentShippingCatalogLoader } from "@/components/fulfillment/shipping/fulfillment-shipping-catalog-loader";
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
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading shipments…</div>}>
        <FulfillmentShippingCatalogLoader />
      </Suspense>
    </DashboardShell>
  );
}
