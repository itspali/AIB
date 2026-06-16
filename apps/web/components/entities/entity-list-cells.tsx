"use client";

import type { ReactNode } from "react";
import { formatDate } from "@/lib/dashboard/format";
import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import {
  ENTITY_TYPE_LABELS,
  PARTY_NATURE_LABELS,
  TAX_TREATMENT_LABELS,
} from "@/lib/entities/labels";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import type { EntityListRow } from "@/lib/entities/types";

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
          <div className={LIST_TABLE_CELL_PRIMARY}>{row.name}</div>
          {row.code ? <div className={LIST_TABLE_CELL_SUBLINE}>{row.code}</div> : null}
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
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.type,
      });
    }
    case "party_nature": {
      const column = getEntityColumnDef("party_nature");
      const label = PARTY_NATURE_LABELS[row.party_nature];
      return renderChipOrText({
        column,
        valueKey: row.party_nature,
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.party_nature,
      });
    }
    case "customer_category":
      return row.customer_category_name ?? "—";
    case "supplier_category":
      return row.supplier_category_name ?? "—";
    case "legal_name":
      return row.legal_name ?? "—";
    case "tax_treatment": {
      const column = getEntityColumnDef("tax_treatment");
      const label = TAX_TREATMENT_LABELS[row.tax_treatment].label;
      return renderChipOrText({
        column,
        valueKey: row.tax_treatment,
        label,
        textNode: <span>{label}</span>,
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
      return <span className={LIST_TABLE_CELL_AMOUNT}>{row[columnId]}</span>;
    case "payment_terms_days":
      return (
        <span className={LIST_TABLE_CELL_COUNT}>
          {row.payment_terms_days}
          <span> d</span>
        </span>
      );
    case "is_active": {
      const column = getEntityColumnDef("is_active");
      const label = row.is_active ? "Active" : "Inactive";
      return renderChipOrText({
        column,
        valueKey: String(row.is_active),
        label,
        textNode: <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>,
        chipDisplay: options?.chipDisplay?.is_active,
      });
    }
    case "created_at":
    case "updated_at":
      return <span className={LIST_TABLE_CELL_DATE}>{formatDate(row[columnId])}</span>;
    default:
      return "—";
  }
}
