import { Building2, Users } from "lucide-react";
import Link from "next/link";
import { ModuleOverview } from "@/components/layout/module-overview";
import { fetchEntityOverviewStats } from "@/lib/entities/queries";
import { CUSTOMERS_HREF, SUPPLIERS_HREF } from "@/lib/entities/entity-navigation";
import { getModulePageContext } from "@/lib/layout/module-page";

function formatCurrency(value: string): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function EntitiesOverviewPage() {
  const { supabase } = await getModulePageContext();
  const stats = await fetchEntityOverviewStats(supabase);

  return (
    <div className="canvas-scroll-endpad">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Entities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Commercial partners registry for customers, suppliers, and mutual partners.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Customers
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.customer_count}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.active_customer_count} active
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suppliers
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.supplier_count}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats.active_supplier_count} active
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Credit limit exposure
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatCurrency(stats.total_credit_limit)}
          </p>
        </div>
        <div className="surface-panel p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Accounts receivable
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatCurrency(stats.total_current_balance)}
          </p>
        </div>
      </div>

      <ModuleOverview
        title="Workspaces"
        description="Open a workspace to manage partner profiles, contacts, and commercial terms."
        cards={[
          {
            href: CUSTOMERS_HREF,
            label: "Customers",
            description: "Customer accounts, credit limits, payment terms, and contacts.",
            icon: Users,
          },
          {
            href: SUPPLIERS_HREF,
            label: "Suppliers",
            description: "Supplier profiles for purchase orders, receipts, and vendor catalog.",
            icon: Building2,
          },
        ]}
      />

      <div className="mt-6 text-sm text-muted-foreground">
        Sales and Procurement sidebars link to the same customer and supplier workspaces.{" "}
        <Link href={CUSTOMERS_HREF} className="text-primary underline-offset-4 hover:underline">
          Open customers
        </Link>
        {" · "}
        <Link href={SUPPLIERS_HREF} className="text-primary underline-offset-4 hover:underline">
          Open suppliers
        </Link>
      </div>
    </div>
  );
}
