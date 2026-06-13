import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildReservedCatalogCustomFieldsPayload,
  extractDefaultPurchasePriceFromCustomFieldsRecord,
  extractMrpFromCustomFieldsRecord,
} from "@/lib/products/catalog-reserved-fields";
import { COMMERCE_DEFAULT_PURCHASE_UOM_KEY } from "@/lib/products/item-uom-commerce";

export type ItemWritebackProfile = {
  item_id: string;
  variant_id: string;
  sku: string;
  name: string;
  classification: string;
  base_unit_of_measure: string;
  category_id: string | null;
  description: string | null;
  hsn_sac_code: string | null;
  is_purchasable: boolean;
  is_salable: boolean;
  is_returnable: boolean;
  default_tax_category: string;
  variant_strategy: string | null;
  item_type: string;
  track_inventory: boolean;
  costing_method: string | null;
  standard_cost: number | null;
  tracking_mode: string | null;
  is_bundle: boolean;
  tax_code_id: string | null;
  custom_fields: Record<string, unknown>;
  current_mrp: string | null;
  current_purchase_price: string | null;
};

export async function loadItemWritebackProfile(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  variantId: string
): Promise<ItemWritebackProfile | null> {
  const { data: variant, error: variantError } = await supabase
    .from("item_variants")
    .select("id, sku, item_id")
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .eq("item_id", itemId)
    .maybeSingle();

  if (variantError || !variant) return null;

  const { data, error } = await supabase
    .from("items")
    .select(
      `
      id,
      name,
      code,
      classification,
      base_unit_of_measure,
      category_id,
      description,
      hsn_sac_code,
      is_purchasable,
      is_salable,
      is_returnable,
      default_tax_category,
      custom_fields,
      variant_strategy,
      item_type,
      track_inventory,
      costing_method,
      standard_cost,
      tracking_mode,
      is_bundle,
      tax_code_id
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) return null;

  const customFields = (data.custom_fields as Record<string, unknown> | null) ?? {};

  return {
    item_id: data.id,
    variant_id: variant.id as string,
    sku: String(data.code ?? variant.sku ?? ""),
    name: String(data.name ?? ""),
    classification: String(data.classification ?? "PHYSICAL_GOOD"),
    base_unit_of_measure: String(data.base_unit_of_measure ?? "PCS"),
    category_id: (data.category_id as string | null) ?? null,
    description: (data.description as string | null) ?? null,
    hsn_sac_code: (data.hsn_sac_code as string | null) ?? null,
    is_purchasable: Boolean(data.is_purchasable),
    is_salable: Boolean(data.is_salable),
    is_returnable: data.is_returnable !== false,
    default_tax_category: String(data.default_tax_category ?? "STANDARD"),
    variant_strategy: (data.variant_strategy as string | null) ?? null,
    item_type: String(data.item_type ?? "PHYSICAL"),
    track_inventory: Boolean(data.track_inventory),
    costing_method: (data.costing_method as string | null) ?? null,
    standard_cost:
      data.standard_cost != null && Number.isFinite(Number(data.standard_cost))
        ? Number(data.standard_cost)
        : null,
    tracking_mode: (data.tracking_mode as string | null) ?? null,
    is_bundle: Boolean(data.is_bundle),
    tax_code_id: (data.tax_code_id as string | null) ?? null,
    custom_fields: customFields,
    current_mrp: extractMrpFromCustomFieldsRecord(customFields) || null,
    current_purchase_price:
      extractDefaultPurchasePriceFromCustomFieldsRecord(customFields) || null,
  };
}

export function mergeWritebackCustomFields(
  profile: ItemWritebackProfile,
  nextMrp?: string,
  nextPurchasePrice?: string,
  nextPurchaseUom?: string
): Record<string, unknown> {
  const merged = { ...profile.custom_fields };
  const reserved = buildReservedCatalogCustomFieldsPayload({
    mrp: nextMrp ?? profile.current_mrp ?? "",
    purchase_price: nextPurchasePrice ?? profile.current_purchase_price ?? "",
    reorder_point: "",
    selling_price: "",
    variant_strategy: profile.variant_strategy ?? undefined,
    supplier_id: undefined,
  });

  for (const [key, value] of Object.entries(reserved)) {
    if (value != null && String(value).trim() !== "") {
      merged[key] = value;
    }
  }

  if (nextPurchaseUom !== undefined) {
    const base = profile.base_unit_of_measure.trim();
    const code = nextPurchaseUom.trim();
    if (code && code !== base) {
      merged[COMMERCE_DEFAULT_PURCHASE_UOM_KEY] = code;
    } else {
      delete merged[COMMERCE_DEFAULT_PURCHASE_UOM_KEY];
    }
  }

  return merged;
}
