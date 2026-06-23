import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FolderTree,
  PackageCheck,
  ScrollText,
  Ship,
  Truck,
} from "lucide-react";
import { ModuleOverview, type ModuleOverviewCard } from "@/components/layout/module-overview";
import { ProcurementPolicySummary } from "@/components/procurement/procurement-policy-summary";
import { SUPPLIERS_HREF } from "@/lib/entities/entity-navigation";
import { supplierCategoriesHref } from "@/lib/entity-categories/navigation";
import type { EntityOverviewStats } from "@/lib/entities/types";
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
  supplierStats: Pick<EntityOverviewStats, "supplier_count" | "active_supplier_count">;
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
    icon: Truck,
  },
  {
    href: SUPPLIERS_HREF,
    label: "Suppliers",
    description: "Vendor master profiles, contacts, and purchasing terms.",
    icon: Building2,
  },
  {
    href: supplierCategoriesHref(),
    label: "Supplier Categories",
    description: "Hierarchical supplier taxonomy and inherited attribute templates.",
    icon: FolderTree,
  },
  {
    href: "/procurement/bills",
    label: "Bills",
    description: "Supplier invoices, three-way match, and accounts payable posting.",
    icon: ScrollText,
  },
];

export function ProcurementOverviewTerminal({ procurementSettings, supplierStats }: Props) {
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suppliers
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{supplierStats.supplier_count}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {supplierStats.active_supplier_count} active
          </p>
        </div>
      </div>

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
