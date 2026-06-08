"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import {
  filterStockAdjustmentsByAst,
  filterStockAdjustmentsByResidual,
  filterStockBalancesByAst,
  filterStockBalancesByResidual,
} from "@/lib/search/executor/client-scopes";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";

export function useFilteredStockBalances(
  rows: StockBalanceRow[],
  locationId: string | null
): { filteredRows: StockBalanceRow[]; totalCount: number; resultCount: number } {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  const filteredRows = useMemo(() => {
    let filtered = rows;

    if (locationId) {
      filtered = filtered.filter((row) => row.location_id === locationId);
    }

    if (!query) return filtered;

    if (omnibar?.scope === "stock" && omnibar.activeAst.length) {
      return filterStockBalancesByAst(filtered, omnibar.activeAst);
    }

    return filterStockBalancesByResidual(filtered, query);
  }, [locationId, omnibar?.activeAst, omnibar?.scope, query, rows]);

  return {
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}

export function useFilteredStockAdjustments(
  rows: StockAdjustmentRow[],
  locationId: string | null
): { filteredRows: StockAdjustmentRow[]; totalCount: number; resultCount: number } {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  const filteredRows = useMemo(() => {
    let filtered = rows;

    if (locationId) {
      filtered = filtered.filter((row) => row.location_id === locationId);
    }

    if (!query) return filtered;

    if (omnibar?.scope === "stock" && omnibar.activeAst.length) {
      return filterStockAdjustmentsByAst(filtered, omnibar.activeAst);
    }

    return filterStockAdjustmentsByResidual(filtered, query);
  }, [locationId, omnibar?.activeAst, omnibar?.scope, query, rows]);

  return {
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}
