import type { SupabaseClient } from "@supabase/supabase-js";

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";

export async function fetchSupplierVariantPrice(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId: string,
  variantId: string
): Promise<string | null> {
  if (!supplierId.trim() || !variantId.trim()) return null;

  const { data: variantRow, error: variantError } = await supabase
    .from("item_variants")
    .select(`id, item_id, ${VARIANT_ITEM_EMBED} (id)`)
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .eq("is_active", true)
    .maybeSingle();

  if (variantError || !variantRow) return null;

  const itemId = variantRow.item_id as string;

  const { data, error } = await supabase
    .from("supplier_items")
    .select("supplier_price, variant_id")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplierId)
    .eq("item_id", itemId)
    .or(`variant_id.eq.${variantId},variant_id.is.null`)
    .order("variant_id", { ascending: false, nullsFirst: false })
    .limit(5);

  if (error || !data?.length) return null;

  const variantMatch = data.find((row) => row.variant_id === variantId);
  const fallback = data.find((row) => row.variant_id == null);
  const price = variantMatch?.supplier_price ?? fallback?.supplier_price;
  if (price == null) return null;

  return String(price);
}
