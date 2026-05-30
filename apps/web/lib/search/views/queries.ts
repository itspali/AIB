import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AstClause, CustomModuleView } from "@/lib/search/types";

export function mapCustomModuleViewRow(row: Record<string, unknown>): CustomModuleView {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    user_id: String(row.user_id),
    module_name: String(row.module_name),
    view_name: String(row.view_name),
    raw_search_text: String(row.raw_search_text),
    compiled_ast: (row.compiled_ast as AstClause[]) ?? [],
    is_system_default: Boolean(row.is_system_default),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function fetchDefaultCustomModuleView(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  moduleName: string
): Promise<CustomModuleView | null> {
  const { data, error } = await supabase
    .from("custom_module_views")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("module_name", moduleName)
    .eq("is_system_default", true)
    .maybeSingle();

  if (error || !data) return null;
  return mapCustomModuleViewRow(data);
}
