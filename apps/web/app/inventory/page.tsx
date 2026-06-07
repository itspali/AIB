import { createClient } from "@/lib/supabase/server";
import { getSessionTenantId } from "@/lib/supabase/auth";
import { fetchInventoryOverviewSnapshot } from "@/lib/inventory/overview/queries";
import { InventoryOverviewTerminal } from "@/components/inventory/inventory-overview-terminal";

export default async function InventoryPage() {
  const [supabase, tenantId] = await Promise.all([createClient(), getSessionTenantId()]);
  if (!tenantId) return null;

  const snapshot = await fetchInventoryOverviewSnapshot(supabase, tenantId);

  return <InventoryOverviewTerminal snapshot={snapshot} />;
}
