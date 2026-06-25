import { ProcurementOverviewTerminalV2 } from "@/components/procurement/procurement-overview-terminal-v2";
import { fetchEntityOverviewStats } from "@/lib/entities/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProcurementSettings } from "@/lib/procurement/settings";
import { fetchImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { isImportLogisticsEnabled } from "@/lib/procurement/import-logistics-capability";

export default async function ProcurementPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const [procurementSettings, stats, importLogisticsSettings] = await Promise.all([
    fetchProcurementSettings(supabase, tenantId),
    fetchEntityOverviewStats(supabase),
    fetchImportLogisticsSettings(supabase, tenantId),
  ]);

  return (
    <ProcurementOverviewTerminalV2
      procurementSettings={procurementSettings}
      supplierStats={{
        supplier_count: stats.supplier_count,
        active_supplier_count: stats.active_supplier_count,
      }}
      importsEnabled={isImportLogisticsEnabled(importLogisticsSettings)}
    />
  );
}
