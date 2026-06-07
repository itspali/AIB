import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpeningStockOnHandCell } from "@/lib/products/opening-stock";

type ValuationRow = {
  variant_id: string | null;
  location_id: string;
  total_quantity_on_hand: number | string;
  current_average_cost: number | string;
};

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

export async function fetchItemVariantValuations(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<OpeningStockOnHandCell[]> {
  const { data, error } = await supabase
    .from("item_valuations")
    .select("variant_id, location_id, total_quantity_on_hand, current_average_cost")
    .eq("tenant_id", tenantId)
    .eq("item_id", itemId);

  if (error) throw new Error(error.message);

  return ((data ?? []) as ValuationRow[])
    .filter((row) => row.variant_id)
    .map((row) => ({
      variant_id: row.variant_id as string,
      location_id: row.location_id,
      quantity_on_hand: formatDecimal(row.total_quantity_on_hand, "0"),
      average_cost: formatDecimal(row.current_average_cost, "0"),
    }));
}
