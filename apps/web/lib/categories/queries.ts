import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRow } from "@/lib/categories/types";
import { parseAttributeTemplates } from "@/lib/categories/tree";
import { isItemType } from "@/lib/products/item-model";
import { isProductVariantStrategy } from "@/lib/products/variant-strategy";

export async function fetchCategoryRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("item_categories")
    .select(
      "id, name, parent_id, is_active, attribute_templates, inherit_parent_attributes, default_variant_strategy, default_item_type, created_at, updated_at"
    )
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];

  return data.map((row) => mapCategoryRow(row));
}

function mapCategoryRow(row: {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: unknown;
  inherit_parent_attributes: boolean | null;
  default_variant_strategy: string | null;
  default_item_type?: string | null;
  created_at: string;
  updated_at: string;
}): CategoryRow {
  return {
    id: row.id,
    name: row.name,
    parent_id: row.parent_id,
    is_active: row.is_active,
    attribute_templates: parseAttributeTemplates(row.attribute_templates),
    inherit_parent_attributes: row.inherit_parent_attributes ?? true,
    default_variant_strategy: isProductVariantStrategy(row.default_variant_strategy ?? "")
      ? row.default_variant_strategy
      : "SINGLE_SKU",
    default_item_type: isItemType(row.default_item_type ?? "")
      ? row.default_item_type
      : "PHYSICAL",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Item counts per category_id for delete validation in the UI. */
export async function fetchCategoryItemCounts(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("items")
    .select("category_id")
    .eq("tenant_id", tenantId)
    .not("category_id", "is", null);

  if (error || !data) return {};

  const counts: Record<string, number> = {};
  for (const row of data) {
    const categoryId = row.category_id as string;
    counts[categoryId] = (counts[categoryId] ?? 0) + 1;
  }
  return counts;
}
