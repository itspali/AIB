"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import {
  getSalesOrderColumnDef,
  type SalesOrderListColumnId,
} from "@/lib/sales/orders/list-columns";
import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import { cn } from "@/lib/utils";

type Options = {
  chipDisplay?: Partial<Record<SalesOrderListColumnId, ColumnChipDisplay>>;
};

export function renderSalesOrderListCell(
  columnId: SalesOrderListColumnId,
  row: SalesOrderRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "so_number":
      return <div className="font-mono text-xs font-medium">{row.voucher_number}</div>;
    case "customer":
      return <span className="font-medium">{row.customer_name}</span>;
    case "shipping_location":
      return (
        <>
          <div className="font-medium">{row.shipping_location_name}</div>
          {row.shipping_location_code ? (
            <div className="text-xs text-muted-foreground">{row.shipping_location_code}</div>
          ) : null}
        </>
      );
    case "status": {
      const column = getSalesOrderColumnDef("status");
      const label = salesOrderStatusLabel(row.commercial_status);
      return renderChipOrText({
        column,
        valueKey: row.commercial_status,
        label,
        textNode: <span className="text-sm font-medium">{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "lines":
      return <span className="tabular-nums">{row.line_count}</span>;
    case "net_amount":
      return <span className="tabular-nums">{row.total_net_amount}</span>;
    case "created":
      return (
        <span className={cn("text-sm text-muted-foreground")}>{formatDate(row.created_at)}</span>
      );
    case "created_by":
      return <span className="text-sm">{row.created_by_name?.trim() || "—"}</span>;
    case "updated":
      return (
        <span className={cn("text-sm text-muted-foreground")}>{formatDate(row.updated_at)}</span>
      );
    default:
      return null;
  }
}
