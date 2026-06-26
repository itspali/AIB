import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import Link from "next/link";
import { ModuleOverview } from "@/components/layout/module-overview";
import { ProcurementPolicySummary } from "@/components/procurement/procurement-policy-summary";
import type { EntityOverviewStats } from "@/lib/entities/types";
import { resolveProcurementOverviewCards } from "@/lib/procurement/overview-cards";
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
  importsEnabled?: boolean;
};

export function ProcurementOverviewTerminal({
  procurementSettings,
  supplierStats,
  importsEnabled = false,
}: Props) {
  const cards = resolveProcurementOverviewCards(importsEnabled);

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Procurement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase inbound workflows — raise orders, receive stock, and match supplier bills.{" "}
          <Link
            href={SETTINGS_ROUTES.operationsProcurement}
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
        cards={cards}
        headingLevel={2}
      />
    </div>
  );
}
