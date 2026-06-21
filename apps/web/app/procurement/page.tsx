import { ProcurementOverviewTerminal } from "@/components/procurement/procurement-overview-terminal";
import { fetchEntityOverviewStats } from "@/lib/entities/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProcurementSettings } from "@/lib/procurement/settings";

export default async function ProcurementPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const [procurementSettings, stats] = await Promise.all([
    fetchProcurementSettings(supabase, tenantId),
    fetchEntityOverviewStats(supabase),
  ]);

  return (
    <ProcurementOverviewTerminal
      procurementSettings={procurementSettings}
      supplierStats={{
        supplier_count: stats.supplier_count,
        active_supplier_count: stats.active_supplier_count,
      }}
    />
  );
}
