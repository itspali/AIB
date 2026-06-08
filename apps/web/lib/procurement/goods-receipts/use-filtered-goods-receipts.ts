import { useMemo } from "react";
import type { GoodsReceiptListPrefs } from "@/lib/procurement/goods-receipts/list-prefs";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";

export function useFilteredGoodsReceipts(
  rows: GoodsReceiptRow[],
  prefs: GoodsReceiptListPrefs
) {
  return useMemo(() => {
    let filtered = rows;

    if (prefs.locationId) {
      filtered = filtered.filter((row) => row.destination_location_id === prefs.locationId);
    }

    return {
      filteredRows: filtered,
      resultCount: filtered.length,
      totalCount: rows.length,
    };
  }, [prefs.locationId, rows]);
}
