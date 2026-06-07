import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchStockAdjustments,
  fetchStockBalances,
} from "@/lib/inventory/stock/queries";
import type { InventoryOverviewSnapshot } from "@/lib/inventory/overview/types";

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function buildInventoryOverviewSnapshot(
  balances: Awaited<ReturnType<typeof fetchStockBalances>>,
  adjustments: Awaited<ReturnType<typeof fetchStockAdjustments>>
): InventoryOverviewSnapshot {
  let inventoryValuation = 0;
  let belowReorderCount = 0;
  let stockedBalanceCount = 0;

  for (const row of balances) {
    const onHand = parseNonNegativeNumber(row.total_quantity_on_hand);
    const avgCost = parseNonNegativeNumber(row.current_average_cost);
    inventoryValuation += onHand * avgCost;
    if (onHand > 0) stockedBalanceCount += 1;
    if (row.below_reorder) belowReorderCount += 1;
  }

  return {
    inventoryValuation,
    belowReorderCount,
    stockedBalanceCount,
    recentAdjustments: adjustments.slice(0, 8),
  };
}

export async function fetchInventoryOverviewSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<InventoryOverviewSnapshot> {
  const [balances, adjustments] = await Promise.all([
    fetchStockBalances(supabase, tenantId),
    fetchStockAdjustments(supabase, tenantId),
  ]);

  return buildInventoryOverviewSnapshot(balances, adjustments);
}
