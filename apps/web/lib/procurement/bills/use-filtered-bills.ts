"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import {
  filterPurchaseBillsByAst,
  filterPurchaseBillsByResidual,
} from "@/lib/search/executor/client-scopes";
import type { PurchaseBillListPrefs } from "@/lib/procurement/bills/list-prefs";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";

function parseInclusiveDateStart(isoDate: string): number | null {
  const parsed = Date.parse(`${isoDate}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInclusiveDateEnd(isoDate: string): number | null {
  const parsed = Date.parse(`${isoDate}T23:59:59.999Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function rowCreatedAtMs(row: PurchaseBillRow): number | null {
  const parsed = Date.parse(row.created_at);
  return Number.isFinite(parsed) ? parsed : null;
}

export function useFilteredBills(rows: PurchaseBillRow[], prefs: PurchaseBillListPrefs) {
  const omnibar = useOptionalOmnibarContext();
  const query = omnibar?.appliedQuery?.trim() ?? "";

  return useMemo(() => {
    let filtered = rows;

    if (prefs.supplierId) {
      filtered = filtered.filter((row) => row.supplier_id === prefs.supplierId);
    }

    if (prefs.matchStatus !== "all") {
      filtered = filtered.filter((row) => row.match_status === prefs.matchStatus);
    }

    if (prefs.paidFilter === "paid") {
      filtered = filtered.filter((row) => row.is_paid);
    } else if (prefs.paidFilter === "unpaid") {
      filtered = filtered.filter((row) => !row.is_paid);
    }

    if (prefs.createdFrom) {
      const fromMs = parseInclusiveDateStart(prefs.createdFrom);
      if (fromMs != null) {
        filtered = filtered.filter((row) => {
          const createdMs = rowCreatedAtMs(row);
          return createdMs != null && createdMs >= fromMs;
        });
      }
    }

    if (prefs.createdTo) {
      const toMs = parseInclusiveDateEnd(prefs.createdTo);
      if (toMs != null) {
        filtered = filtered.filter((row) => {
          const createdMs = rowCreatedAtMs(row);
          return createdMs != null && createdMs <= toMs;
        });
      }
    }

    if (query) {
      if (omnibar?.scope === "bills" && omnibar.activeAst.length) {
        filtered = filterPurchaseBillsByAst(filtered, omnibar.activeAst);
      } else {
        filtered = filterPurchaseBillsByResidual(filtered, query);
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
    prefs.createdFrom,
    prefs.createdTo,
    prefs.matchStatus,
    prefs.paidFilter,
    prefs.supplierId,
    query,
    rows,
  ]);
}
