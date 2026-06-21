import { createClient } from "@/lib/supabase/server";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchTaxRateRegistry } from "@/lib/dashboard/queries";
import { TaxPolicyGridLazy } from "@/components/dashboard/tax-policy-grid-lazy";

export async function TaxPolicySection() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);
  if (!tenantId) return null;

  const rows = await fetchTaxRateRegistry(supabase, tenantId);
  return <TaxPolicyGridLazy rows={rows} />;
}
