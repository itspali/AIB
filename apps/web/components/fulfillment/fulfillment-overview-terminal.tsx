import Link from "next/link";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { PackageCheck, RotateCcw, Truck, Warehouse } from "lucide-react";
import { ModuleOverview, type ModuleOverviewCard } from "@/components/layout/module-overview";
import { OverviewGlassShell } from "@/components/layout/overview-glass-shell";
import { OverviewKpiTile } from "@/components/layout/overview-primitives";
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
    <OverviewGlassShell>
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Fulfillment</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Warehouse execution — ship orders, manage returns, and connect carriers.{" "}
          <Link
            href={`${SETTINGS_ROUTES.operations}/logistics`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Module settings
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewKpiTile
          label="Ready to ship"
          value={String(stats.ready_to_ship_count)}
          subtitle="Confirmed orders awaiting dispatch"
        />
        <OverviewKpiTile
          label="In transit"
          value={String(stats.in_transit_count)}
          subtitle="Shipments not yet delivered"
        />
        <OverviewKpiTile label="Total shipments" value={String(stats.shipment_count)} />
      </div>

      <ModuleOverview
        title="Workflows"
        description="Open a fulfillment area to continue work."
        cards={WORKFLOW_CARDS}
        headingLevel={2}
      />
    </div>
    </OverviewGlassShell>
  );
}
