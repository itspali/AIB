"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
import type { StockBalanceColumnId } from "@/lib/inventory/stock/list-columns";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";

export function renderStockBalanceListCell(
  columnId: StockBalanceColumnId,
  row: StockBalanceRow
): ReactNode {
  switch (columnId) {
    case "location":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.location_name}</div>
          {row.location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.location_code}</div>
          ) : null}
        </>
      );
    case "item":
      return (
        <>
          <div className={LIST_TABLE_CELL_PRIMARY}>{row.item_name}</div>
          {row.variant_sku ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.variant_sku}</div>
          ) : null}
        </>
      );
    case "sku":
      return <span className={LIST_TABLE_CELL_MONO_REF}>{row.variant_sku || "—"}</span>;
    case "on_hand":
      return (
        <div className="inline-flex items-center justify-end gap-2">
          <span className={LIST_TABLE_CELL_AMOUNT}>{formatListQuantity(row.total_quantity_on_hand)}</span>
          {row.below_reorder ? (
            <Badge variant="action_required" className="text-[10px]">
              Low
            </Badge>
          ) : null}
        </div>
      );
    case "available":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatListQuantity(row.quantity_available)}</span>;
    case "reserved":
      return <span className={LIST_TABLE_CELL_COUNT}>{formatListQuantity(row.quantity_reserved)}</span>;
    case "promo_on_hand":
      return (
        <span className={LIST_TABLE_CELL_COUNT}>
          {formatListQuantity(row.promo_quantity_on_hand)}
        </span>
      );
    case "avg_cost":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatListCurrency(row.current_average_cost)}</span>;
    case "reorder":
      return <span className={LIST_TABLE_CELL_COUNT}>{formatListQuantity(row.reorder_point)}</span>;
    default:
      return null;
  }
}
