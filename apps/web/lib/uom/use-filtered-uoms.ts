"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { UomActiveStatusFilter, UomFamilyFilter } from "@/lib/uom/list-prefs";
import { uomFamilyLabel, type UomRow } from "@/lib/uom/types";

type Args = {
  rows: UomRow[];
  activeStatusFilter: UomActiveStatusFilter;
  familyFilter: UomFamilyFilter;
};

export function useFilteredUoms({
  rows,
  activeStatusFilter,
  familyFilter,
}: Args): { filteredRows: UomRow[]; totalCount: number; resultCount: number } {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim().toLowerCase() ?? "";

  const filteredRows = useMemo(() => {
    let filtered = rows.filter((row) => {
      if (activeStatusFilter === "active" && !row.is_active) return false;
      if (activeStatusFilter === "inactive" && row.is_active) return false;
      if (familyFilter !== "all" && row.family !== familyFilter) return false;
      return true;
    });

    if (!query) return filtered;

    filtered = filtered.filter((row) =>
      [row.code, row.name, row.family, uomFamilyLabel(row.family)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query))
    );

    return filtered;
  }, [activeStatusFilter, familyFilter, query, rows]);

  return {
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}
