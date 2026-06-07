"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";

function matchesQuery(haystack: string, query: string): boolean {
  if (!query) return true;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

function balanceHaystack(row: StockBalanceRow): string {
  return [row.location_name, row.location_code, row.item_name, row.variant_sku].join(" ");
}

function adjustmentHaystack(row: StockAdjustmentRow): string {
  return [
    row.adjustment_number,
    row.location_name,
    row.location_code,
    row.reason,
    row.kind,
  ].join(" ");
}

export function useFilteredStockBalances(
  rows: StockBalanceRow[],
  locationId: string | null
): { filteredRows: StockBalanceRow[]; totalCount: number; resultCount: number } {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (locationId && row.location_id !== locationId) return false;
      return matchesQuery(balanceHaystack(row), query);
    });
  }, [locationId, query, rows]);

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
    return rows.filter((row) => {
      if (locationId && row.location_id !== locationId) return false;
      return matchesQuery(adjustmentHaystack(row), query);
    });
  }, [locationId, query, rows]);

  return {
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}
