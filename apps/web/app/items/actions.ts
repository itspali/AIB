"use server";

import { revalidatePath } from "next/cache";
import { fetchProductDetail } from "@/lib/products/queries";
import { productMasterSchema } from "@/lib/products/schemas";
import { buildCustomFieldsPayload } from "@/lib/products/sku-mask";
import type { ProductMasterInput } from "@/lib/products/schemas";
import { itemMediaSchema, itemVariantSchema } from "@/lib/products/variant-schemas";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

function parseDecimal(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalDecimal(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildVariantAttributes(raw: Record<string, string>): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmedKey = key.trim();
    const trimmedValue = value.trim();
    if (!trimmedKey || !trimmedValue) continue;
    attributes[trimmedKey] = trimmedValue;
  }
  return attributes;
}

function buildAlternateUomsPayload(values: ProductMasterInput) {
  const rows = values.alternate_uoms.map((row) => ({
    uom_code: row.uom_code,
    conversion_factor: parseDecimal(row.conversion_factor, 1),
  }));

  if (values.purchase_uom !== values.base_unit_of_measure) {
    const purchaseIndex = rows.findIndex((row) => row.uom_code === values.purchase_uom);
    if (purchaseIndex >= 0) {
      rows[purchaseIndex] = {
        uom_code: values.purchase_uom,
        conversion_factor: parseDecimal(values.purchase_uom_conversion, 1),
      };
    } else {
      rows.unshift({
        uom_code: values.purchase_uom,
        conversion_factor: parseDecimal(values.purchase_uom_conversion, 1),
      });
    }
  }

  return rows;
}

function buildStorefrontItemsPayload(values: ProductMasterInput) {
  return values.storefront_visibility
    .filter(
      (row) =>
        row.is_visible ||
        row.store_custom_name.trim() ||
        row.store_price_book_id
    )
    .map((row) => ({
      storefront_id: row.storefront_id,
      is_visible: row.is_visible,
      store_custom_name: row.store_custom_name.trim() || null,
      store_price_book_id: row.store_price_book_id,
    }));
}

export async function ensureProductTag(name: string, tagGroup?: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Tag name is required." };

  const { supabase } = await requireTenantId();
  const { data, error } = await supabase.rpc("ensure_tag", {
    p_name: trimmed,
    p_tag_group: tagGroup?.trim() || null,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("ensure_tag") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const, tagId: data as string };
}

export async function saveProductMasterProfile(raw: unknown) {
  const parsed = productMasterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product profile" };
  }

  const values = parsed.data;
  const { supabase, tenantId } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_product_master_profile", {
    p_item_id: values.item_id,
    p_name: values.name,
    p_classification: values.classification,
    p_base_uom: values.base_unit_of_measure,
    p_category_id: values.category_id,
    p_sku: values.sku,
    p_description: values.description || null,
    p_is_purchasable: values.is_purchasable,
    p_is_salable: values.is_salable,
    p_is_active: values.is_active,
    p_hsn_sac_code: values.hsn_sac_code || null,
    p_has_variants: values.has_variants,
    p_default_tax_category: values.default_tax_category,
    p_is_returnable: values.is_returnable,
    p_barcode: values.barcode || null,
    p_variant_attributes: buildVariantAttributes(values.variant_attributes),
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
    p_weight: parseOptionalDecimal(values.weight),
    p_volume: parseOptionalDecimal(values.volume),
    p_length_cm: parseDecimal(values.length_cm),
    p_width_cm: parseDecimal(values.width_cm),
    p_height_cm: parseDecimal(values.height_cm),
    p_variant_is_active: values.variant_is_active,
    p_selling_price: parseOptionalDecimal(values.selling_price),
    p_selling_uom:
      values.selling_uom !== values.base_unit_of_measure ? values.selling_uom : null,
    p_purchase_uom:
      values.purchase_uom !== values.base_unit_of_measure ? values.purchase_uom : null,
    p_purchase_uom_conversion:
      values.purchase_uom !== values.base_unit_of_measure
        ? parseDecimal(values.purchase_uom_conversion, 1)
        : null,
    p_purchase_price: parseOptionalDecimal(values.purchase_price),
    p_supplier_id: values.supplier_id,
    p_custom_fields: buildCustomFieldsPayload(values.sku_mask, values.custom_fields),
    p_alternate_uoms: buildAlternateUomsPayload(values),
    p_tag_ids: values.tag_ids,
    p_storefront_items: buildStorefrontItemsPayload(values),
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_product_master_profile") };
    }
    if (error.message.toLowerCase().includes("sku already exists")) {
      return { error: "Master SKU is already assigned to another product in this workspace." };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  revalidatePath("/items/categories");

  const itemId = data as string;
  const detail = await fetchProductDetail(supabase, tenantId, itemId);

  return { success: true as const, itemId, detail };
}

export async function getProductDetail(itemId: string) {
  const { supabase, tenantId } = await requireTenantId();
  const detail = await fetchProductDetail(supabase, tenantId, itemId);
  if (!detail) return { error: "Product profile not found." };
  return { detail };
}

export async function saveItemVariant(raw: unknown) {
  const parsed = itemVariantSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid variant profile" };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_item_variant", {
    p_item_id: values.item_id,
    p_sku: values.sku,
    p_variant_id: values.variant_id,
    p_barcode: values.barcode || null,
    p_variant_attributes: buildVariantAttributes(values.variant_attributes),
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
    p_weight: parseOptionalDecimal(values.weight),
    p_volume: parseOptionalDecimal(values.volume),
    p_length_cm: parseDecimal(values.length_cm),
    p_width_cm: parseDecimal(values.width_cm),
    p_height_cm: parseDecimal(values.height_cm),
    p_is_active: values.is_active,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_variant") };
    }
    if (error.message.toLowerCase().includes("sku already exists")) {
      return { error: "SKU is already assigned to another variant in this workspace." };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const, variantId: data as string };
}

export async function deleteItemVariant(variantId: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("delete_item_variant", {
    p_variant_id: variantId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("delete_item_variant") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const };
}

export async function saveItemMedia(raw: unknown) {
  const parsed = itemMediaSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid media profile" };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_item_media", {
    p_item_id: values.item_id,
    p_storage_url: values.storage_url,
    p_media_id: values.media_id,
    p_variant_id: values.variant_id,
    p_sort_order: values.sort_order,
    p_is_primary: values.is_primary,
    p_show_on_storefront: values.show_on_storefront,
    p_show_in_digital_catalog: values.show_in_digital_catalog,
    p_show_on_internal_transactions: values.show_on_internal_transactions,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("save_item_media") };
    }
    return { error: error.message };
  }

  revalidatePath("/items");
  return { success: true as const, mediaId: data as string };
}

export async function deleteItemMedia(mediaId: string, storagePath?: string) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("delete_item_media", {
    p_media_id: mediaId,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { error: formatRpcDeployError("delete_item_media") };
    }
    return { error: error.message };
  }

  if (storagePath?.trim()) {
    await supabase.storage.from("product-media").remove([storagePath.trim()]);
  }

  revalidatePath("/items");
  return { success: true as const };
}
