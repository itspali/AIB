"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { TaxActiveStatusFilter, TaxKindFilter } from "@/lib/tax/list-prefs";
import type { TaxCodeRow } from "@/lib/tax/types";

type Args = {
  rows: TaxCodeRow[];
  activeStatusFilter: TaxActiveStatusFilter;
  kindFilter: TaxKindFilter;
};

export function useFilteredTaxCodes({
  rows,
  activeStatusFilter,
  kindFilter,
}: Args): { filteredRows: TaxCodeRow[]; totalCount: number; resultCount: number } {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim().toLowerCase() ?? "";

  const filteredRows = useMemo(() => {
    let filtered = rows.filter((row) => {
      if (activeStatusFilter === "active" && !row.is_active) return false;
      if (activeStatusFilter === "inactive" && row.is_active) return false;
      if (kindFilter !== "all" && row.kind !== kindFilter) return false;
      return true;
    });

    if (!query) return filtered;

    filtered = filtered.filter((row) =>
      [row.code, row.name, row.kind]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );

    return filtered;
  }, [activeStatusFilter, kindFilter, query, rows]);

  return {
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}
