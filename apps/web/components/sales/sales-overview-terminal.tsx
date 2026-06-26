import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import Link from "next/link";
import {
  ClipboardList,
  CreditCard,
  FileText,
  FolderTree,
  Receipt,
  Truck,
  Users,
} from "lucide-react";
import { ModuleOverview, type ModuleOverviewCard } from "@/components/layout/module-overview";
import { OverviewGlassShell } from "@/components/layout/overview-glass-shell";
import { OverviewKpiTile } from "@/components/layout/overview-primitives";
import { CUSTOMERS_HREF } from "@/lib/entities/entity-navigation";
import { customerCategoriesHref } from "@/lib/entity-categories/navigation";
import { FULFILLMENT_SHIPPING_HREF } from "@/lib/fulfillment/shipping/navigation";
import type { EntityOverviewStats } from "@/lib/entities/types";

type Props = {
  stats: Pick<
    EntityOverviewStats,
    "customer_count" | "active_customer_count" | "total_credit_limit" | "total_current_balance"
  >;
};

function formatCurrency(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CARDS: ModuleOverviewCard[] = [
  {
    href: CUSTOMERS_HREF,
    label: "Customers",
    description: "Customer accounts, credit limits, payment terms, and contacts.",
    icon: Users,
  },
  {
    href: customerCategoriesHref(),
    label: "Customer Categories",
    description: "Hierarchical customer taxonomy and inherited attribute templates.",
    icon: FolderTree,
  },
  {
    href: "/sales/quotes",
    label: "Quotes",
    description: "Create quotations and convert accepted quotes to sales orders.",
    icon: FileText,
  },
  {
    href: "/sales/orders",
    label: "Orders",
    description: "Manage sales orders from confirmation through fulfillment.",
    icon: ClipboardList,
  },
  {
    href: FULFILLMENT_SHIPPING_HREF,
    label: "Shipments",
    description: "Post outbound shipments and track delivery in the Fulfillment module.",
    icon: Truck,
  },
  {
    href: "/sales/invoices",
    label: "Invoices",
    description: "Issue sales invoices and track billing status.",
    icon: Receipt,
  },
  {
    href: "/sales/payments",
    label: "Payments",
    description: "Record customer receipts against open invoices.",
    icon: CreditCard,
  },
];

export function SalesOverviewTerminal({ stats }: Props) {
  return (
    <OverviewGlassShell>
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customer relationships, quotes, orders, and receivables.{" "}
          <Link
            href={SETTINGS_ROUTES.operationsSales}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Module settings
          </Link>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <OverviewKpiTile
          label="Customers"
          value={String(stats.customer_count)}
          subtitle={`${stats.active_customer_count} active`}
        />
        <OverviewKpiTile
          label="Credit limit exposure"
          value={formatCurrency(stats.total_credit_limit)}
        />
        <OverviewKpiTile
          label="Accounts receivable"
          value={formatCurrency(stats.total_current_balance)}
        />
      </div>

      <ModuleOverview
        title="Workflows"
        description="Open a sales area to continue work."
        cards={CARDS}
        headingLevel={2}
      />
    </div>
    </OverviewGlassShell>
  );
}
