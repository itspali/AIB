import Link from "next/link";
import { PackageCheck, RotateCcw, Truck, Warehouse } from "lucide-react";
import { ModuleOverview, type ModuleOverviewCard } from "@/components/layout/module-overview";
import {
  FULFILLMENT_SHIPPING_HREF,
} from "@/lib/fulfillment/shipping/navigation";
import type { FulfillmentOverviewStats } from "@/lib/fulfillment/overview-queries";

type Props = {
  stats: FulfillmentOverviewStats;
};

const WORKFLOW_CARDS: ModuleOverviewCard[] = [
  {
    href: FULFILLMENT_SHIPPING_HREF,
    label: "Shipments",
    description: "Post outbound shipments against confirmed sales orders and track delivery.",
    icon: Truck,
  },
  {
    href: "/fulfillment/pick-pack",
    label: "Pick & pack",
    description: "Wave picking and packing queues shared across sales channels.",
    icon: Warehouse,
    comingSoon: true,
  },
  {
    href: "/fulfillment/returns",
    label: "Returns & RMA",
    description: "Customer return authorizations, receiving, and restock workflows.",
    icon: RotateCcw,
    comingSoon: true,
  },
  {
    href: "/fulfillment/carriers",
    label: "Carriers & labels",
    description: "Rate shopping, label printing, and carrier account management.",
    icon: PackageCheck,
    comingSoon: true,
  },
  {
    href: "/fulfillment/integrations",
    label: "3PL integrations",
    description: "Connect external fulfillment partners and sync shipment status.",
    icon: Truck,
    comingSoon: true,
  },
];

export function FulfillmentOverviewTerminal({ stats }: Props) {
  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fulfillment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Warehouse execution — ship orders, manage returns, and connect carriers.{" "}
          <Link
            href="/settings/modules/logistics"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Module settings
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Ready to ship
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.ready_to_ship_count}</p>
          <p className="mt-1 text-xs text-muted-foreground">Confirmed orders awaiting dispatch</p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            In transit
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.in_transit_count}</p>
          <p className="mt-1 text-xs text-muted-foreground">Shipments not yet delivered</p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total shipments
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.shipment_count}</p>
        </div>
      </div>

      <ModuleOverview
        title="Workflows"
        description="Open a fulfillment area to continue work."
        cards={WORKFLOW_CARDS}
        headingLevel={2}
      />
    </div>
  );
}
