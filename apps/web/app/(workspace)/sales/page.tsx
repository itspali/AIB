import { SalesOverviewTerminal } from "@/components/sales/sales-overview-terminal";
import { fetchEntityOverviewStats } from "@/lib/entities/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function SalesPage() {
  const { supabase } = await getModulePageContext();
  const stats = await fetchEntityOverviewStats(supabase);

  return <SalesOverviewTerminal stats={stats} />;
}
