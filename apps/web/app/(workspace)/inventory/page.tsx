import { createClient } from "@/lib/supabase/server";
import { getSessionTenantId } from "@/lib/supabase/auth";
import { fetchInventoryOverviewSnapshot } from "@/lib/inventory/overview/queries";
import { fetchImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { isImportLogisticsEnabled } from "@/lib/procurement/import-logistics-capability";
import { InventoryOverviewTerminal } from "@/components/inventory/inventory-overview-terminal";

export default async function InventoryPage() {
  const [supabase, tenantId] = await Promise.all([createClient(), getSessionTenantId()]);
  if (!tenantId) return null;

  const [snapshot, importLogisticsSettings] = await Promise.all([
    fetchInventoryOverviewSnapshot(supabase, tenantId),
    fetchImportLogisticsSettings(supabase, tenantId),
  ]);

  return (
    <InventoryOverviewTerminal
      snapshot={snapshot}
      importsEnabled={isImportLogisticsEnabled(importLogisticsSettings)}
    />
  );
}
