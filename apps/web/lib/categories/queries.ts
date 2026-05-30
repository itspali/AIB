import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRow } from "@/lib/categories/types";
import { parseAttributeTemplates } from "@/lib/categories/tree";
import { isProductVariantStrategy } from "@/lib/products/variant-strategy";

export async function fetchCategoryRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("item_categories")
    .select("id, name, parent_id, is_active, attribute_templates, default_variant_strategy, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    is_active: row.is_active,
    attribute_templates: parseAttributeTemplates(row.attribute_templates),
    default_variant_strategy: isProductVariantStrategy(row.default_variant_strategy ?? "")
      ? row.default_variant_strategy
      : "SINGLE_SKU",
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
