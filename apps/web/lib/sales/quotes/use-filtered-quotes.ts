"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { SalesQuoteListPrefs } from "@/lib/sales/quotes/list-prefs";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

export function useFilteredQuotes(rows: SalesQuoteRow[], prefs: SalesQuoteListPrefs) {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim().toLowerCase() ?? "";

  return useMemo(() => {
    let filtered = rows;

    if (prefs.customerId) {
      filtered = filtered.filter((row) => row.customer_id === prefs.customerId);
    }

    if (prefs.status !== "all") {
      filtered = filtered.filter((row) => row.commercial_status === prefs.status);
    }

    if (query) {
      filtered = filtered.filter((row) => {
        const haystack = [
          row.quotation_number,
          row.customer_name,
          row.origin_location_name,
          row.billing_state,
          row.shipping_state,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      });
    }

    return {
      filteredRows: filtered,
      resultCount: filtered.length,
      totalCount: rows.length,
    };
  }, [prefs.customerId, prefs.status, query, rows]);
}
