"use server";

import { revalidatePath } from "next/cache";
import { fetchProductDetail } from "@/lib/products/queries";
import { productMasterSchema } from "@/lib/products/schemas";
import { formatRpcDeployError, isMissingRpcError } from "@/lib/supabase/rpc-error";
import { requireTenantId } from "@/lib/supabase/require-tenant";

function parseDecimal(value: string, fallback = 0): number {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function saveProductMasterProfile(raw: unknown) {
  const parsed = productMasterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product profile" };
  }

  const values = parsed.data;
  const { supabase } = await requireTenantId();

  const { data, error } = await supabase.rpc("save_product_master_profile", {
    p_item_id: values.item_id,
    p_name: values.name,
    p_classification: values.classification,
    p_base_uom: values.base_unit_of_measure,
    p_category_id: values.category_id,
    p_sku: values.sku,
    p_hsn_sac_code: values.hsn_sac_code || null,
    p_is_returnable: values.is_returnable,
    p_dead_weight_kg: parseDecimal(values.dead_weight_kg),
    p_length_cm: parseDecimal(values.length_cm),
    p_width_cm: parseDecimal(values.width_cm),
    p_height_cm: parseDecimal(values.height_cm),
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
  return { success: true as const, itemId: data as string };
}

export async function getProductDetail(itemId: string) {
  const { supabase, tenantId } = await requireTenantId();
  const detail = await fetchProductDetail(supabase, tenantId, itemId);
  if (!detail) return { error: "Product profile not found." };
  return { detail };
}
