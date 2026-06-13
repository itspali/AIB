import { ProcurementOverviewTerminal } from "@/components/procurement/procurement-overview-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProcurementSettings } from "@/lib/procurement/settings";

export default async function ProcurementPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const procurementSettings = await fetchProcurementSettings(supabase, tenantId);

  return <ProcurementOverviewTerminal procurementSettings={procurementSettings} />;
}
