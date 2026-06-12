import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoInventoryBalanceRow = {
  id: string;
  location_id: string;
  location_name: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  quantity_on_hand: string;
  quarantine_type: string;
};

export async function fetchPromoInventoryBalances(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string; variantId?: string }
): Promise<PromoInventoryBalanceRow[]> {
  let query = supabase
    .from("promo_inventory_balances")
    .select(
      `
      id,
      location_id,
      item_id,
      variant_id,
      quantity_on_hand,
      quarantine_type,
      tenant_locations!promo_inventory_balances_location_tenant_fk (name),
      items!promo_inventory_balances_item_tenant_fk (name),
      item_variants!promo_inventory_balances_variant_tenant_fk (sku)
    `
    )
    .eq("tenant_id", tenantId)
    .gt("quantity_on_hand", 0);

  if (options?.locationId) query = query.eq("location_id", options.locationId);
  if (options?.variantId) query = query.eq("variant_id", options.variantId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const location = Array.isArray(row.tenant_locations)
      ? row.tenant_locations[0]
      : row.tenant_locations;
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    const variant = Array.isArray(row.item_variants) ? row.item_variants[0] : row.item_variants;

    return {
      id: row.id as string,
      location_id: row.location_id as string,
      location_name: (location?.name as string) ?? "",
      item_id: row.item_id as string,
      item_name: (item?.name as string) ?? "",
      variant_id: row.variant_id as string,
      variant_sku: (variant?.sku as string) ?? "",
      quantity_on_hand: String(row.quantity_on_hand ?? "0"),
      quarantine_type: String(row.quarantine_type ?? "PROMOTIONAL_HOLD"),
    };
  });
}
