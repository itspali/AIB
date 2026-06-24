"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { getTaxColumnDef, type TaxListColumnId } from "@/lib/tax/list-columns";
import {
  formatTaxComponentsSummary,
  formatTaxRateSummary,
} from "@/lib/tax/list-column-display-text";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_MONO_REF,
  LIST_TABLE_CELL_PRIMARY,
} from "@/lib/layout/list-table-chrome";
import { taxCodeKindLabel, type TaxCodeRow } from "@/lib/tax/types";

type Options = {
  chipDisplay?: Partial<Record<TaxListColumnId, ColumnChipDisplay>>;
};

export function renderTaxListCell(
  columnId: TaxListColumnId,
  row: TaxCodeRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "code":
      return <span className={LIST_TABLE_CELL_MONO_REF}>{row.code}</span>;
    case "name":
      return <div className={LIST_TABLE_CELL_PRIMARY}>{row.name}</div>;
    case "kind": {
      const column = getTaxColumnDef("kind");
      const label = taxCodeKindLabel(row.kind);
      return renderChipOrText({
        column,
        valueKey: row.kind,
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.kind,
      });
    }
    case "rate":
      return <span className={LIST_TABLE_CELL_AMOUNT}>{formatTaxRateSummary(row)}</span>;
    case "is_active": {
      const column = getTaxColumnDef("is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: String(row.is_active),
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_active,
      });
    }
    case "is_variable": {
      const column = getTaxColumnDef("is_variable");
      const label = row.is_variable ? "Yes" : "No";
      return renderChipOrText({
        column,
        valueKey: String(row.is_variable),
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_variable,
      });
    }
    case "is_recoverable": {
      const column = getTaxColumnDef("is_recoverable");
      const label = row.is_recoverable ? "Yes" : "No";
      return renderChipOrText({
        column,
        valueKey: String(row.is_recoverable),
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_recoverable,
      });
    }
    case "components":
      return formatTaxComponentsSummary(row);
    case "effective_from":
      return (
        <span className={LIST_TABLE_CELL_DATE}>
          {row.effective_from ? formatDate(row.effective_from) : "—"}
        </span>
      );
    case "effective_to":
      return (
        <span className={LIST_TABLE_CELL_DATE}>
          {row.effective_to ? formatDate(row.effective_to) : "—"}
        </span>
      );
    case "updated_at":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row.updated_at)}</span>;
    default:
      return null;
  }
}
