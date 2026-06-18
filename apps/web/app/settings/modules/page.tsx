import { ShoppingCart, Package, FileText, Truck } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ModuleOverview } from "@/components/layout/module-overview";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ModuleSettingsPage() {
  const { orgName, approvalAlertCount, operatorProfile, tenantId } =
    await getModulePageContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ModuleOverview
        title="Module settings"
        description="Configure how operational modules behave — policies, approvals, and module-specific options."
        cards={[
          {
            href: "/settings/modules/procurement",
            label: "Procurement",
            description: "Purchase order policies, approvals, and financial account defaults.",
            icon: ShoppingCart,
          },
          {
            href: "/settings/modules/inventory",
            label: "Inventory",
            description: "Stock adjustments, transfers, and inventory document layouts.",
            icon: Package,
            comingSoon: true,
          },
          {
            href: "/settings/modules/sales",
            label: "Sales",
            description: "Quotation, order, and invoice policies and approval rules.",
            icon: FileText,
          },
          {
            href: "/settings/modules/logistics",
            label: "Fulfillment",
            description: "Shipment documents and fulfillment presentation.",
            icon: Truck,
            comingSoon: true,
          },
        ]}
      />
    </DashboardShell>
  );
}
