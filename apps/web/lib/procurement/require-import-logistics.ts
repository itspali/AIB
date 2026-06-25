import "server-only";

import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { isImportLogisticsEnabled } from "@/lib/procurement/import-logistics-capability";

export async function requireImportLogisticsEnabled(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  const settings = await fetchImportLogisticsSettings(supabase, tenantId);
  if (!isImportLogisticsEnabled(settings)) {
    redirect("/procurement");
  }
}
