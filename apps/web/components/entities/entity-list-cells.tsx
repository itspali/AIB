"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import { ENTITY_TYPE_LABELS, TAX_TREATMENT_LABELS } from "@/lib/entities/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { EntityListRow } from "@/lib/entities/types";
import { cn } from "@/lib/utils";

type Options = {
  chipDisplay?: Partial<Record<EntityListColumnId, ColumnChipDisplay>>;
};

export function renderEntityListCell(
  columnId: EntityListColumnId,
  row: EntityListRow,
  options?: Options
): ReactNode {
  switch (columnId) {
    case "name":
      return (
        <>
          <div className="font-medium">{row.name}</div>
          {row.code ? (
            <div className="text-xs text-muted-foreground">{row.code}</div>
          ) : null}
        </>
      );
    case "code":
      return row.code ?? "—";
    case "type": {
      const column = getEntityColumnDef("type");
      const label = ENTITY_TYPE_LABELS[row.type];
      return renderChipOrText({
        column,
        valueKey: row.type,
        label,
        textNode: <span className="text-sm">{label}</span>,
        chipDisplay: options?.chipDisplay?.type,
      });
    }
    case "legal_name":
      return row.legal_name ?? "—";
    case "tax_treatment": {
      const column = getEntityColumnDef("tax_treatment");
      const label = TAX_TREATMENT_LABELS[row.tax_treatment].label;
      return renderChipOrText({
        column,
        valueKey: row.tax_treatment,
        label,
        textNode: <span className="text-sm">{label}</span>,
        chipDisplay: options?.chipDisplay?.tax_treatment,
      });
    }
    case "tax_registration_number":
      return row.tax_registration_number ?? "—";
    case "primary_contact_name":
      return row.primary_contact_name ?? "—";
    case "primary_contact_email":
      return row.primary_contact_email ?? "—";
    case "company_email":
      return row.company_email ?? "—";
    case "company_phone":
      return row.company_phone ?? "—";
    case "credit_limit":
    case "current_balance":
      return <span className="tabular-nums">{row[columnId]}</span>;
    case "payment_terms_days":
      return (
        <span className="tabular-nums">
          {row.payment_terms_days}
          <span className="text-muted-foreground"> d</span>
        </span>
      );
    case "is_active": {
      const column = getEntityColumnDef("is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: String(row.is_active),
        label,
        textNode: (
          <span
            className={cn(
              "text-sm font-medium",
              row.is_active ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"
            )}
          >
            {label}
          </span>
        ),
        chipDisplay: options?.chipDisplay?.is_active,
      });
    }
    case "created_at":
    case "updated_at":
      return (
        <span className="text-sm text-muted-foreground">{formatDate(row[columnId])}</span>
      );
    default:
      return "—";
  }
}
