import { useMemo } from "react";
import type { PurchaseOrderListPrefs } from "@/lib/procurement/purchase-orders/list-prefs";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

export function useFilteredPurchaseOrders(
  rows: PurchaseOrderRow[],
  prefs: PurchaseOrderListPrefs
) {
  return useMemo(() => {
    let filtered = rows;

    if (prefs.status !== "all") {
      filtered = filtered.filter((row) => row.document_status === prefs.status);
    }

    if (prefs.locationId) {
      filtered = filtered.filter((row) => row.destination_location_id === prefs.locationId);
    }

    return {
      filteredRows: filtered,
      resultCount: filtered.length,
      totalCount: rows.length,
    };
  }, [prefs.locationId, prefs.status, rows]);
}
