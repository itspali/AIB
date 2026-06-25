import { ShoppingCart, Package, FileText, Truck } from "lucide-react";
import { ModuleOverview } from "@/components/layout/module-overview";
import { OverviewGlassShell } from "@/components/layout/overview-glass-shell";

export default function ModuleSettingsPage() {
  return (
    <OverviewGlassShell>
    <div className="canvas-scroll-endpad">
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
    </div>
    </OverviewGlassShell>
  );
}
