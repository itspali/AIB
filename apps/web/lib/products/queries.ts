import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isItemClassification } from "@/lib/products/classification-labels";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";

type VariantRow = {
  id: string;
  sku: string;
  created_at: string;
  dead_weight_kg: number | string | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
};

type ItemRow = {
  id: string;
  name: string;
  classification: string;
  base_unit_of_measure: string;
  category_id: string | null;
  hsn_sac_code: string | null;
  is_returnable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  item_categories: { name: string } | { name: string }[] | null;
  item_variants: VariantRow[] | null;
};

function resolveCategoryName(raw: ItemRow["item_categories"]): string | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ?? null;
  return raw.name ?? null;
}

function pickDefaultVariant(variants: VariantRow[] | null | undefined): VariantRow | null {
  if (!variants?.length) return null;
  return [...variants].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )[0];
}

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function mapListRow(row: ItemRow): ProductListRow | null {
  if (!isItemClassification(row.classification)) return null;
  const variant = pickDefaultVariant(row.item_variants);

  return {
    id: row.id,
    name: row.name,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    is_active: row.is_active,
    default_variant_id: variant?.id ?? null,
    default_sku: variant?.sku ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function fetchProductListRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProductListRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      classification,
      base_unit_of_measure,
      category_id,
      is_active,
      created_at,
      updated_at,
      item_categories ( name ),
      item_variants ( id, sku, created_at )
    `
    )
    .eq("tenant_id", tenantId)
    .order("name");

  if (error || !data) return [];

  return (data as ItemRow[])
    .map(mapListRow)
    .filter((row): row is ProductListRow => row !== null);
}

export async function fetchProductDetail(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<ProductDetailSnapshot | null> {
  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      classification,
      base_unit_of_measure,
      category_id,
      hsn_sac_code,
      is_returnable,
      is_active,
      created_at,
      updated_at,
      item_categories ( name ),
      item_variants ( id, sku, created_at, dead_weight_kg, length_cm, width_cm, height_cm )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as ItemRow;
  if (!isItemClassification(row.classification)) return null;

  const variant = pickDefaultVariant(row.item_variants);
  if (!variant) return null;

  return {
    id: row.id,
    name: row.name,
    classification: row.classification,
    base_unit_of_measure: row.base_unit_of_measure,
    category_id: row.category_id,
    category_name: resolveCategoryName(row.item_categories),
    hsn_sac_code: row.hsn_sac_code,
    is_returnable: row.is_returnable,
    is_active: row.is_active,
    variant_id: variant.id,
    sku: variant.sku,
    dead_weight_kg: formatDecimal(variant.dead_weight_kg, "0"),
    length_cm: formatDecimal(variant.length_cm, "0"),
    width_cm: formatDecimal(variant.width_cm, "0"),
    height_cm: formatDecimal(variant.height_cm, "0"),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
