"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { SalesOrderListPrefs } from "@/lib/sales/orders/list-prefs";
import type { SalesOrderRow } from "@/lib/sales/orders/types";

function filterSalesOrdersByResidual(rows: SalesOrderRow[], query: string): SalesOrderRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => {
    const haystack = [
      row.voucher_number,
      row.customer_name,
      row.shipping_location_name,
      row.shipping_location_code,
      row.created_by_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export function useFilteredSalesOrders(rows: SalesOrderRow[], prefs: SalesOrderListPrefs) {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  return useMemo(() => {
    let filtered = rows;

    if (prefs.status !== "all") {
      filtered = filtered.filter((row) => row.commercial_status === prefs.status);
    }

    if (prefs.locationId) {
      filtered = filtered.filter((row) => row.shipping_location_id === prefs.locationId);
    }

    if (query) {
      filtered = filterSalesOrdersByResidual(filtered, query);
    }

    return {
      filteredRows: filtered,
      resultCount: filtered.length,
      totalCount: rows.length,
    };
  }, [prefs.locationId, prefs.status, query, rows]);
}
