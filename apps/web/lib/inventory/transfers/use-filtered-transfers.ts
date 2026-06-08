"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { TransferListPrefs } from "@/lib/inventory/transfers/list-prefs";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import {
  filterTransfersByAst,
  filterTransfersByResidual,
} from "@/lib/search/executor/client-scopes";

export function useFilteredTransfers(rows: StockTransferRow[], prefs: TransferListPrefs) {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  return useMemo(() => {
    let filtered = rows;

    if (prefs.status !== "all") {
      filtered = filtered.filter((row) => row.current_status === prefs.status);
    }

    if (prefs.sourceLocationId) {
      filtered = filtered.filter((row) => row.source_location_id === prefs.sourceLocationId);
    }

    if (query) {
      if (omnibar?.scope === "transfers" && omnibar.activeAst.length) {
        filtered = filterTransfersByAst(filtered, omnibar.activeAst);
      } else {
        filtered = filterTransfersByResidual(filtered, query);
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
    prefs.sourceLocationId,
    prefs.status,
    query,
    rows,
  ]);
}
