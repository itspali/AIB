import Link from "next/link";
import { ClipboardList, PackageCheck, ScrollText, Building2, Ship } from "lucide-react";
import { ModuleOverview, type ModuleOverviewCard } from "@/components/layout/module-overview";
import { ProcurementPolicySummary } from "@/components/procurement/procurement-policy-summary";
import type { ProcurementSettings } from "@/lib/procurement/settings";

type Props = {
  procurementSettings: Pick<
    ProcurementSettings,
    | "is_po_mandatory_for_grn"
    | "is_qc_required_before_stocking"
    | "allow_zero_cost_receipts"
    | "po_mrp_trade_terms_enabled"
    | "landed_cost_allocation_method"
    | "matching_tolerance_percentage"
    | "po_auto_round_off_enabled"
  >;
};

const CARDS: ModuleOverviewCard[] = [
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
    href: "/procurement/goods-in-transit",
    label: "Goods in Transit",
    description: "Move stock to GIT holding nodes and clear them when import receipts land.",
    icon: Ship,
  },
  {
    href: "/procurement/subcontract",
    label: "Subcontracting",
    description: "Vendor job work locations and BOM backflush for finished goods receipts.",
    icon: Building2,
  },
  {
    href: "/entities/suppliers",
    label: "Suppliers",
    description: "Vendor master profiles, contacts, and purchasing terms.",
    icon: Building2,
  },
  {
    href: "/procurement/bills",
    label: "Bills",
    description: "Supplier invoices, three-way match, and accounts payable posting.",
    icon: ScrollText,
  },
];

export function ProcurementOverviewTerminal({ procurementSettings }: Props) {
  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase inbound workflows — raise orders, receive stock, and match supplier bills.{" "}
          <Link
            href="/settings/modules/procurement"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Module settings
          </Link>
        </p>
      </header>

      <ProcurementPolicySummary settings={procurementSettings} />

      <ModuleOverview
        title="Workflows"
        description="Open a procurement area to continue work."
        cards={CARDS}
        headingLevel={2}
      />
    </div>
  );
}
