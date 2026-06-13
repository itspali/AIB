import type { SupabaseClient } from "@supabase/supabase-js";

export type QcInventoryBalanceRow = {
  id: string;
  location_id: string;
  location_name: string;
  item_id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  goods_receipt_id: string;
  goods_receipt_voucher_number: string;
  quantity_on_hand: string;
  unit_cost: string;
};

export async function fetchQcInventoryBalances(
  supabase: SupabaseClient,
  tenantId: string,
  options?: { locationId?: string; goodsReceiptId?: string }
): Promise<QcInventoryBalanceRow[]> {
  let query = supabase
    .from("qc_inventory_balances")
    .select(
      `
      id,
      location_id,
      item_id,
      variant_id,
      goods_receipt_id,
      quantity_on_hand,
      unit_cost,
      tenant_locations (name),
      items (name),
      item_variants (sku),
      goods_receipts (voucher_number)
    `
    )
    .eq("tenant_id", tenantId)
    .gt("quantity_on_hand", 0);

  if (options?.locationId) query = query.eq("location_id", options.locationId);
  if (options?.goodsReceiptId) query = query.eq("goods_receipt_id", options.goodsReceiptId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const location = Array.isArray(row.tenant_locations)
      ? row.tenant_locations[0]
      : row.tenant_locations;
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    const variant = Array.isArray(row.item_variants) ? row.item_variants[0] : row.item_variants;
    const grn = Array.isArray(row.goods_receipts) ? row.goods_receipts[0] : row.goods_receipts;

    return {
      id: row.id as string,
      location_id: row.location_id as string,
      location_name: (location?.name as string) ?? "",
      item_id: row.item_id as string,
      item_name: (item?.name as string) ?? "",
      variant_id: row.variant_id as string,
      variant_sku: (variant?.sku as string) ?? "",
      goods_receipt_id: row.goods_receipt_id as string,
      goods_receipt_voucher_number: (grn?.voucher_number as string) ?? "",
      quantity_on_hand: String(row.quantity_on_hand ?? "0"),
      unit_cost: String(row.unit_cost ?? "0"),
    };
  });
}
