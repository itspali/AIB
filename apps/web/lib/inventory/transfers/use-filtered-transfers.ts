import { useMemo } from "react";
import type { TransferListPrefs } from "@/lib/inventory/transfers/list-prefs";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";

export function useFilteredTransfers(rows: StockTransferRow[], prefs: TransferListPrefs) {
  return useMemo(() => {
    let filtered = rows;

    if (prefs.status !== "all") {
      filtered = filtered.filter((row) => row.current_status === prefs.status);
    }

    if (prefs.sourceLocationId) {
      filtered = filtered.filter((row) => row.source_location_id === prefs.sourceLocationId);
    }

    return {
      filteredRows: filtered,
      resultCount: filtered.length,
      totalCount: rows.length,
    };
  }, [prefs.sourceLocationId, prefs.status, rows]);
}
