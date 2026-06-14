"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getSalesQuoteColumnDef,
  type SalesQuoteListColumnId,
} from "@/lib/sales/quotes/list-columns";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

type Options = {
  chipDisplay?: Partial<Record<SalesQuoteListColumnId, ColumnChipDisplay>>;
};

export function renderSalesQuoteListCell(
  columnId: SalesQuoteListColumnId,
  row: SalesQuoteRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "quote_number":
      return <span className="font-mono text-xs font-medium">{row.quotation_number}</span>;
    case "customer":
      return <span className="font-medium">{row.customer_name}</span>;
    case "origin_location":
      return <span className="font-medium">{row.origin_location_name || "—"}</span>;
    case "status": {
      const column = getSalesQuoteColumnDef("status");
      const label = salesQuoteStatusLabel(row.commercial_status);
      return renderChipOrText({
        column,
        valueKey: row.commercial_status,
        label,
        textNode: <span className="text-sm font-medium">{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "valid_until":
      return <span className="text-sm text-muted-foreground">{formatDate(row.valid_until)}</span>;
    case "lines":
      return <span className="tabular-nums">{row.line_count}</span>;
    case "net_amount":
      return <span className="tabular-nums">{row.total_net_amount}</span>;
    case "created":
      return <span className="text-sm text-muted-foreground">{formatDate(row.created_at)}</span>;
    case "updated":
      return <span className="text-sm text-muted-foreground">{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
