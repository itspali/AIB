import { FulfillmentOverviewTerminal } from "@/components/fulfillment/fulfillment-overview-terminal";
import { fetchFulfillmentOverviewStats } from "@/lib/fulfillment/overview-queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function FulfillmentPage() {
  const { supabase, tenantId } = await getModulePageContext();
  const stats = await fetchFulfillmentOverviewStats(supabase, tenantId);

  return <FulfillmentOverviewTerminal stats={stats} />;
}
