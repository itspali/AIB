import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchStockAdjustments,
  fetchStockBalances,
} from "@/lib/inventory/stock/queries";
import { fetchStockTransfers } from "@/lib/inventory/transfers/queries";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import type {
  BelowReorderOverviewRow,
  InventoryOverviewSnapshot,
} from "@/lib/inventory/overview/types";
import { fetchOpenProcurementGitVoucherCount } from "@/lib/procurement/git/queries";

const BELOW_REORDER_OVERVIEW_LIMIT = 12;

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function compareBelowReorderRows(a: StockBalanceRow, b: StockBalanceRow): number {
  const aOnHand = parseNonNegativeNumber(a.total_quantity_on_hand);
  const bOnHand = parseNonNegativeNumber(b.total_quantity_on_hand);
  const aReorder = a.reorder_point != null ? parseNonNegativeNumber(a.reorder_point) : 0;
  const bReorder = b.reorder_point != null ? parseNonNegativeNumber(b.reorder_point) : 0;

  const aGap = aOnHand - aReorder;
  const bGap = bOnHand - bReorder;
  if (aGap !== bGap) return aGap - bGap;

  const locationCompare = a.location_name.localeCompare(b.location_name);
  if (locationCompare !== 0) return locationCompare;

  return a.variant_sku.localeCompare(b.variant_sku);
}

export function buildInventoryOverviewSnapshot(
  balances: Awaited<ReturnType<typeof fetchStockBalances>>,
  adjustments: Awaited<ReturnType<typeof fetchStockAdjustments>>,
  transfers: StockTransferRow[] = [],
  procurementGitInTransitCount = 0
): InventoryOverviewSnapshot {
  let inventoryValuation = 0;
  let belowReorderCount = 0;
  let stockedBalanceCount = 0;
  const belowReorderRows: StockBalanceRow[] = [];

  for (const row of balances) {
    const onHand = parseNonNegativeNumber(row.total_quantity_on_hand);
    const avgCost = parseNonNegativeNumber(row.current_average_cost);
    inventoryValuation += onHand * avgCost;
    if (onHand > 0) stockedBalanceCount += 1;
    if (row.below_reorder) {
      belowReorderCount += 1;
      belowReorderRows.push(row);
    }
  }

  belowReorderRows.sort(compareBelowReorderRows);

  const belowReorderBalances: BelowReorderOverviewRow[] = belowReorderRows
    .slice(0, BELOW_REORDER_OVERVIEW_LIMIT)
    .map((row) => {
      const surplus = balances
        .filter(
          (candidate) =>
            candidate.variant_id === row.variant_id &&
            candidate.location_id !== row.location_id &&
            parseNonNegativeNumber(candidate.total_quantity_on_hand) > 0
        )
        .sort(
          (a, b) =>
            parseNonNegativeNumber(b.total_quantity_on_hand) -
            parseNonNegativeNumber(a.total_quantity_on_hand)
        )[0];

      return {
        ...row,
        suggested_source_location_id: surplus?.location_id ?? null,
        suggested_source_location_name: surplus?.location_name ?? null,
      };
    });

  const inTransitTransferCount = transfers.filter(
    (transfer) => transfer.current_status === "DISPATCHED_IN_TRANSIT"
  ).length;

  return {
    inventoryValuation,
    belowReorderCount,
    stockedBalanceCount,
    inTransitTransferCount,
    procurementGitInTransitCount,
    belowReorderBalances,
    recentTransfers: transfers.slice(0, 8),
    recentAdjustments: adjustments.slice(0, 8),
  };
}

export async function fetchInventoryOverviewSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<InventoryOverviewSnapshot> {
  const [balances, adjustments, transfers, procurementGitInTransitCount] = await Promise.all([
    fetchStockBalances(supabase, tenantId),
    fetchStockAdjustments(supabase, tenantId),
    fetchStockTransfers(supabase, tenantId),
    fetchOpenProcurementGitVoucherCount(supabase, tenantId),
  ]);

  return buildInventoryOverviewSnapshot(
    balances,
    adjustments,
    transfers,
    procurementGitInTransitCount
  );
}
