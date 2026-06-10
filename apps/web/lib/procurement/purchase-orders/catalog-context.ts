import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchCategoryRows } from "@/lib/categories/queries";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { fetchVariantPrimaryImageUrl } from "@/lib/procurement/purchase-orders/variant-image";
import { filterUserCustomFieldEntries } from "@/lib/products/catalog-reserved-fields";
import { listVariantAttributeEntries } from "@/lib/products/list-row-key";

export type { PoLineCatalogContext };

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

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
        tax_code_id: string | null;
        tax_codes:
          | {
              rate: number | string | null;
              is_variable: boolean | null;
            }
          | {
              rate: number | string | null;
              is_variable: boolean | null;
            }[]
          | null;
      }
    | {
        description: string | null;
        hsn_sac_code: string | null;
        base_unit_of_measure: string;
        custom_fields: Record<string, unknown> | null;
        category_id: string | null;
        tax_code_id: string | null;
        tax_codes:
          | {
              rate: number | string | null;
              is_variable: boolean | null;
            }
          | {
              rate: number | string | null;
              is_variable: boolean | null;
            }[]
          | null;
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

async function resolveCatalogAttributeLabels(
  supabase: SupabaseClient,
  tenantId: string,
  categoryId: string | null | undefined
): Promise<Record<string, string>> {
  const attributeLabels: Record<string, string> = {};
  try {
    if (!categoryId) return attributeLabels;
    const categories = await fetchCategoryRows(supabase, tenantId);
    const templates = resolveEffectiveAttributeTemplates(categoryId, categories);
    for (const template of templates) {
      attributeLabels[template.key] = template.label?.trim() || template.key;
    }
  } catch {
    // Attribute labels are optional; catalog fields still load without them.
  }
  return attributeLabels;
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
      ${VARIANT_ITEM_EMBED}!inner (
        description,
        hsn_sac_code,
        base_unit_of_measure,
        custom_fields,
        category_id,
        tax_code_id,
        tax_codes (
          rate,
          is_variable
        )
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  const row = data as VariantCatalogRow;
  const item = resolveJoin(row.items);
  if (!item) return null;

  const taxCode = resolveJoin(item.tax_codes);
  const taxRate = taxCode?.rate != null ? Number(taxCode.rate) : 0;

  const [attributeLabels, imageUrl] = await Promise.all([
    resolveCatalogAttributeLabels(supabase, tenantId, item.category_id),
    fetchVariantPrimaryImageUrl(supabase, tenantId, row.item_id, row.id).catch(() => null),
  ]);

  return {
    description: item.description?.trim() || null,
    hsn_sac_code: item.hsn_sac_code?.trim() || null,
    base_unit_of_measure: item.base_unit_of_measure?.trim() || null,
    image_url: imageUrl,
    tax_code_id: item.tax_code_id,
    tax_rate: Number.isFinite(taxRate) ? taxRate : 0,
    tax_is_variable: Boolean(taxCode?.is_variable),
    custom_fields: mapCustomFields(item.custom_fields),
    variant_attributes: mapVariantAttributes(row.variant_attributes),
    attribute_labels: attributeLabels,
    catalog_snapshot_source: "server",
  };
}
