import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchDashboardMetrics } from "@/lib/dashboard/queries";
import { MetricGaugeCardsLazy } from "@/components/dashboard/metric-gauge-cards-lazy";

export async function MetricGaugeGrid() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);
  if (!tenantId) return null;

  const metrics = await fetchDashboardMetrics(supabase, tenantId);

  return <MetricGaugeCardsLazy metrics={metrics} />;
}
