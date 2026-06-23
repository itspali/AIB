import { useMemo } from "react";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";
import type { QcQueueListPrefs } from "@/lib/procurement/quality-inspection/list-prefs";

export function useFilteredQcQueueRows(
  rows: QcInspectionQueueRow[],
  prefs: Pick<QcQueueListPrefs, "locationId">,
  searchQuery: string
) {
  return useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filteredRows = rows.filter((row) => {
      if (prefs.locationId && row.destination_location_id !== prefs.locationId) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        row.item_name,
        row.variant_sku,
        row.grn_number,
        row.purchase_order_number ?? "",
        row.destination_location_name,
        row.destination_location_code,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });

    return {
      filteredRows,
      filteredCount: filteredRows.length,
    };
  }, [prefs.locationId, rows, searchQuery]);
}
