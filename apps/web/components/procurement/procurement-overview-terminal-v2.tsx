import { ProcurementCommandCenter } from "@/components/procurement/revamp/procurement-command-center";
import { OverviewGlassShell } from "@/components/layout/overview-glass-shell";
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
  importsEnabled?: boolean;
};

/** Production procurement module landing (Glass V2 command center). */
export function ProcurementOverviewTerminalV2(props: Props) {
  return (
    <OverviewGlassShell>
      <ProcurementCommandCenter {...props} />
    </OverviewGlassShell>
  );
}
