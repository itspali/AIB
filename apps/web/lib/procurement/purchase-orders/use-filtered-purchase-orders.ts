"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import {
  filterPurchaseOrdersByAst,
  filterPurchaseOrdersByResidual,
} from "@/lib/search/executor/client-scopes";
import type { PurchaseOrderListPrefs } from "@/lib/procurement/purchase-orders/list-prefs";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

export function useFilteredPurchaseOrders(
  rows: PurchaseOrderRow[],
  prefs: PurchaseOrderListPrefs
) {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  return useMemo(() => {
    let filtered = rows;

    if (prefs.status !== "all") {
      filtered = filtered.filter((row) => row.document_status === prefs.status);
    }

    if (prefs.locationId) {
      filtered = filtered.filter((row) => row.destination_location_id === prefs.locationId);
    }

    if (query) {
      if (omnibar?.scope === "purchase-orders" && omnibar.activeAst.length) {
        filtered = filterPurchaseOrdersByAst(filtered, omnibar.activeAst);
      } else {
        filtered = filterPurchaseOrdersByResidual(filtered, query);
      }
    }

    return {
      filteredRows: filtered,
      resultCount: filtered.length,
      totalCount: rows.length,
    };
  }, [
    omnibar?.activeAst,
    omnibar?.scope,
    prefs.locationId,
    prefs.status,
    query,
    rows,
  ]);
}
