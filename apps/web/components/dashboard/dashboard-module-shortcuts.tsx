import Link from "next/link";
import {
  ClipboardCheck,
  Package,
  Settings2,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  ArrowLeftRight,
} from "lucide-react";
import { OverviewSectionShell, OverviewShortcutCard } from "@/components/layout/overview-primitives";
import { CUSTOMERS_HREF } from "@/lib/entities/entity-navigation";
import { PROCUREMENT_PO_HREF } from "@/lib/procurement/navigation";
import { SALES_ORDERS_HREF } from "@/lib/sales/navigation";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";

const SHORTCUTS = [
  {
    href: "/items",
    label: "Items",
    description: "Product master catalog",
    icon: Package,
  },
  {
    href: "/inventory/stock",
    label: "Stock",
    description: "Balances and adjustments",
    icon: Warehouse,
  },
  {
    href: PROCUREMENT_PO_HREF,
    label: "Purchase orders",
    description: "Procurement documents",
    icon: Truck,
  },
  {
    href: SALES_ORDERS_HREF,
    label: "Sales orders",
    description: "Commercial order pipeline",
    icon: ShoppingCart,
  },
  {
    href: CUSTOMERS_HREF,
    label: "Customers",
    description: "Customer registry",
    icon: Users,
  },
  {
    href: "/approvals",
    label: "Approvals",
    description: "Documents awaiting your action",
    icon: ClipboardCheck,
  },
  {
    href: "/inventory/transfers",
    label: "Transfers",
    description: "Move stock between locations",
    icon: ArrowLeftRight,
  },
  {
    href: SETTINGS_ROUTES.hub,
    label: "Administration",
    description: "Workspace governance and catalogs",
    icon: Settings2,
  },
] as const;

export function DashboardModuleShortcuts() {
  return (
    <OverviewSectionShell
      title="Modules"
      description="Jump into high-frequency workflows."
      className="mb-8"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SHORTCUTS.map((shortcut) => (
          <OverviewShortcutCard key={shortcut.href} {...shortcut} />
        ))}
      </div>
    </OverviewSectionShell>
  );
}
