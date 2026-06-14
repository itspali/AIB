"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { SalesInvoiceListPrefs } from "@/lib/sales/invoices/list-prefs";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";

export function useFilteredInvoices(rows: SalesInvoiceRow[], prefs: SalesInvoiceListPrefs) {
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

    if (prefs.paymentStatus !== "all") {
      filtered = filtered.filter((row) => row.invoice_payment_status === prefs.paymentStatus);
    }

    if (query) {
      filtered = filtered.filter((row) => {
        const haystack = [
          row.invoice_number,
          row.customer_name,
          row.source_order_number,
          row.origin_location_name,
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
  }, [prefs.customerId, prefs.paymentStatus, prefs.status, query, rows]);
}
