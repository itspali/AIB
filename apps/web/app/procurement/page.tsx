import { ClipboardList, PackageCheck, ScrollText, Building2 } from "lucide-react";
import { ModuleOverview } from "@/components/layout/module-overview";

export default function ProcurementPage() {
  return (
    <ModuleOverview
      title="Procurement"
      description="Purchase inbound workflows — raise orders, receive stock, and match supplier bills."
      cards={[
        {
          href: "/procurement/purchase-orders",
          label: "Purchase Orders",
          description: "Create draft POs, issue to suppliers, and track fulfillment status.",
          icon: ClipboardList,
        },
        {
          href: "/procurement/goods-receipts",
          label: "Goods Receipts",
          description: "Post GRNs against purchase orders or receive stock directly at a location.",
          icon: PackageCheck,
        },
        {
          href: "/procurement/suppliers",
          label: "Suppliers",
          description: "Vendor master profiles, contacts, and purchasing terms.",
          icon: Building2,
          comingSoon: true,
        },
        {
          href: "/procurement/bills",
          label: "Bills",
          description: "Supplier invoices, three-way match, and accounts payable posting.",
          icon: ScrollText,
        },
      ]}
    />
  );
}
