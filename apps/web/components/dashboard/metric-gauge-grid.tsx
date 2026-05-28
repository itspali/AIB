import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchDashboardMetrics } from "@/lib/dashboard/queries";
import { MetricGaugeCards } from "@/components/dashboard/metric-gauge-cards";

export async function MetricGaugeGrid() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);
  if (!tenantId) return null;

  const metrics = await fetchDashboardMetrics(supabase, tenantId);

  return <MetricGaugeCards metrics={metrics} />;
}
