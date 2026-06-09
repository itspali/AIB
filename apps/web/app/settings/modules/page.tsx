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
        description="Configure how operational modules behave and how documents are presented — layouts, policies, and module-specific options."
        cards={[
          {
            href: "/settings/modules/procurement",
            label: "Procurement",
            description: "Purchase order document layout, print templates, and procurement policies.",
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
            description: "Quotations, orders, invoices — layout and commercial presentation.",
            icon: FileText,
            comingSoon: true,
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
