"use client";

import type { ReactNode } from "react";
import { SalesListDocumentRefLink } from "@/components/sales/shared/sales-list-document-ref-link";
import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
import {
  getSalesOrderColumnDef,
  type SalesOrderListColumnId,
} from "@/lib/sales/orders/list-columns";
import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_DOC,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SECONDARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import { SALES_QUOTES_HREF } from "@/lib/sales/navigation";
import type { SalesOrderRow } from "@/lib/sales/orders/types";

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
      return <div className={LIST_TABLE_CELL_MONO_DOC}>{row.voucher_number}</div>;
    case "customer":
      return <span className={LIST_TABLE_CELL_PRIMARY}>{row.customer_name}</span>;
    case "shipping_location":
      return (
        <>
          <div className={LIST_TABLE_CELL_SECONDARY}>{row.shipping_location_name}</div>
          {row.shipping_location_code ? (
            <div className={LIST_TABLE_CELL_SUBLINE}>{row.shipping_location_code}</div>
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
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.status,
      });
    }
    case "source_quote":
      return (
        <SalesListDocumentRefLink
          documentId={row.source_quotation_id}
          documentNumber={row.source_quotation_number}
          moduleHref={SALES_QUOTES_HREF}
        />
      );
    case "lines":
      return <span className={LIST_TABLE_CELL_COUNT}>{formatListQuantity(row.line_count)}</span>;
    case "net_amount":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatListCurrency(row.total_net_amount)}</span>;
    case "created":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.created_at)}</span>;
    case "created_by":
      return <span className={LIST_TABLE_CELL_SECONDARY}>{row.created_by_name?.trim() || "—"}</span>;
    case "updated":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
