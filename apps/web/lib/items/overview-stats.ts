import type { SupabaseClient } from "@supabase/supabase-js";

export type ItemsOverviewStats = {
  item_count: number;
  active_item_count: number;
  category_count: number;
  variant_count: number;
};

export async function fetchItemsOverviewStats(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ItemsOverviewStats> {
  const [itemsResult, activeResult, categoriesResult, variantsResult] = await Promise.all([
    supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("items")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
    supabase
      .from("item_categories")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("item_variants")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  return {
    item_count: itemsResult.count ?? 0,
    active_item_count: activeResult.count ?? 0,
    category_count: categoriesResult.count ?? 0,
    variant_count: variantsResult.count ?? 0,
  };
}
