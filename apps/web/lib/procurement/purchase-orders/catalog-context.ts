import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { fetchVariantPrimaryImageUrl } from "@/lib/procurement/purchase-orders/variant-image";
import { filterUserCustomFieldEntries } from "@/lib/products/catalog-reserved-fields";
import { listVariantAttributeEntries } from "@/lib/products/list-row-key";

export type { PoLineCatalogContext };

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type VariantCatalogRow = {
  id: string;
  item_id: string;
  variant_attributes: Record<string, unknown> | null;
  items:
    | {
        description: string | null;
        hsn_sac_code: string | null;
        base_unit_of_measure: string;
        custom_fields: Record<string, unknown> | null;
        category_id: string | null;
      }
    | {
        description: string | null;
        hsn_sac_code: string | null;
        base_unit_of_measure: string;
        custom_fields: Record<string, unknown> | null;
        category_id: string | null;
      }[]
    | null;
};

function mapCustomFields(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  if (!raw) return {};
  const entries = Object.entries(raw).map(([key, value]) => ({
    key,
    value: value == null ? "" : String(value),
  }));
  const filtered = filterUserCustomFieldEntries(entries);
  return Object.fromEntries(filtered.map((row) => [row.key, row.value]));
}

function mapVariantAttributes(raw: Record<string, unknown> | null | undefined): Record<string, string> {
  return Object.fromEntries(listVariantAttributeEntries(raw));
}

export async function fetchPoLineCatalogContext(
  supabase: SupabaseClient,
  tenantId: string,
  variantId: string
): Promise<PoLineCatalogContext | null> {
  if (!variantId.trim()) return null;

  const { data, error } = await supabase
    .from("item_variants")
    .select(
      `
      id,
      item_id,
      variant_attributes,
      items!inner (
        description,
        hsn_sac_code,
        base_unit_of_measure,
        custom_fields,
        category_id
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as VariantCatalogRow;
  const item = resolveJoin(row.items);
  if (!item) return null;

  const attributeLabels: Record<string, string> = {};
  if (item.category_id) {
    const categories = await fetchCategoryRows(supabase, tenantId);
    const templates = resolveEffectiveAttributeTemplates(item.category_id, categories);
    for (const template of templates) {
      attributeLabels[template.key] = template.label?.trim() || template.key;
    }
  }

  const imageUrl = await fetchVariantPrimaryImageUrl(
    supabase,
    tenantId,
    row.item_id,
    row.id
  );

  return {
    description: item.description?.trim() || null,
    hsn_sac_code: item.hsn_sac_code?.trim() || null,
    base_unit_of_measure: item.base_unit_of_measure?.trim() || null,
    image_url: imageUrl,
    custom_fields: mapCustomFields(item.custom_fields),
    variant_attributes: mapVariantAttributes(row.variant_attributes),
    attribute_labels: attributeLabels,
  };
}
