import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import { isReservedCatalogFormFieldKey } from "@/lib/products/catalog-reserved-fields";

export type PoCatalogFieldSuggestions = {
  customFieldKeys: string[];
  variantAttributeKeys: string[];
};

export async function fetchPoCatalogFieldSuggestions(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PoCatalogFieldSuggestions> {
  const [categories, itemsResult] = await Promise.all([
    fetchCategoryRows(supabase, tenantId),
    supabase.from("items").select("custom_fields").eq("tenant_id", tenantId).limit(500),
  ]);

  const variantAttributeKeys = new Set<string>();
  for (const category of categories) {
    const templates = resolveEffectiveAttributeTemplates(category.id, categories);
    for (const template of templates) {
      if (template.key.trim()) variantAttributeKeys.add(template.key.trim());
    }
  }

  const customFieldKeys = new Set<string>();
  for (const row of itemsResult.data ?? []) {
    const raw = row.custom_fields as Record<string, unknown> | null;
    if (!raw) continue;
    for (const key of Object.keys(raw)) {
      const trimmed = key.trim();
      if (!trimmed || isReservedCatalogFormFieldKey(trimmed)) continue;
      customFieldKeys.add(trimmed);
    }
  }

  const sortKeys = (keys: Set<string>) =>
    [...keys].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));

  return {
    customFieldKeys: sortKeys(customFieldKeys),
    variantAttributeKeys: sortKeys(variantAttributeKeys),
  };
}
