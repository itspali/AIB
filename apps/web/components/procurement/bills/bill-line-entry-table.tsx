"use client";

import { useCallback } from "react";
import {
  DocumentLineCompactInput,
  DocumentLineReadOnlyItemCell,
} from "@/components/documents/document-line-entry-cells";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";
import { Badge } from "@/components/ui/badge";
import type { BillDraftLine } from "@/lib/procurement/bills/bill-draft-form";
import {
  computePriceVariancePct,
  resolveBillLineMatchSeverity,
} from "@/lib/procurement/bills/three-way-match";
import { cn } from "@/lib/utils";

type Props = {
  lines: BillDraftLine[];
  matchingTolerancePct: number;
  disabled?: boolean;
  fillHeight?: boolean;
  onChange: (lines: BillDraftLine[] | ((current: BillDraftLine[]) => BillDraftLine[])) => void;
};

const BILL_COLUMNS: DocumentLineColumn[] = [
  {
    id: "item",
    label: "Item",
    align: "left",
    widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
    editable: false,
  },
  {
    id: "quantity_billed",
    label: "Qty billed",
    align: "right",
    widthClass: "w-[4.75rem]",
    editable: true,
  },
  {
    id: "po_unit_price",
    label: "PO rate",
    align: "right",
    widthClass: "w-[4.75rem]",
    editable: false,
  },
  {
    id: "grn_landed_unit_cost",
    label: "GRN cost",
    align: "right",
    widthClass: "w-[4.75rem]",
    editable: false,
  },
  {
    id: "unit_price_billed",
    label: "Invoice rate",
    align: "right",
    widthClass: "w-[4.75rem]",
    editable: true,
  },
  {
    id: "match",
    label: "Match",
    align: "left",
    widthClass: "w-[6.5rem]",
    editable: false,
  },
];

function matchBadge(severity: "matched" | "variance" | "hold") {
  if (severity === "hold") {
    return (
      <Badge variant="action_required" className="text-xs font-normal">
        Hold
      </Badge>
    );
  }
  if (severity === "variance") {
    return (
      <Badge variant="administrative" className="text-xs font-normal">
        Variance
      </Badge>
    );
  }
  return (
    <Badge variant="completed" className="text-xs font-normal">
      OK
    </Badge>
  );
}

export function BillLineEntryTable({
  lines,
  matchingTolerancePct,
  disabled = false,
  fillHeight = false,
  onChange,
}: Props) {
  const patchLine = useCallback(
    (key: string, patch: Partial<BillDraftLine>) => {
      onChange((current) =>
        current.map((line) => (line.key === key ? { ...line, ...patch } : line))
      );
    },
    [onChange]
  );

  return (
    <DocumentLineEntrySection title="Bill lines" fillHeight={fillHeight}>
      <DocumentLineEntryGrid
        lines={lines}
        columns={BILL_COLUMNS}
        minTableWidth="min-w-[46rem]"
        fillHeight={fillHeight}
        disabled={disabled}
        showRemoveColumn={false}
        renderCell={(column, line) => {
          if (column.id === "item") {
            return (
              <DocumentLineReadOnlyItemCell
                itemName={line.item_name}
                variantSku={line.variant_sku}
                hint={
                  Number(line.quantity_on_grns) > 0
                    ? `On GRNs: ${line.quantity_on_grns}`
                    : null
                }
              />
            );
          }

          if (column.id === "quantity_billed") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_billed}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Quantity billed"
                onChange={(event) =>
                  patchLine(line.key, { quantity_billed: event.target.value })
                }
              />
            );
          }

          if (column.id === "po_unit_price") {
            return (
              <span className="block px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                {line.po_unit_price}
              </span>
            );
          }

          if (column.id === "grn_landed_unit_cost") {
            return (
              <span className="block px-2 py-2 text-right text-sm tabular-nums text-muted-foreground">
                {line.grn_landed_unit_cost ?? "—"}
              </span>
            );
          }

          if (column.id === "unit_price_billed") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.unit_price_billed}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Invoice unit price"
                onChange={(event) =>
                  patchLine(line.key, { unit_price_billed: event.target.value })
                }
              />
            );
          }

          if (column.id === "match") {
            const variancePct = computePriceVariancePct(
              Number(line.unit_price_billed),
              Number(line.po_unit_price)
            );
            const severity = resolveBillLineMatchSeverity(variancePct, matchingTolerancePct);
            return (
              <div className={cn("px-2 py-2", severity === "hold" && "text-amber-700 dark:text-amber-300")}>
                {matchBadge(severity)}
                {variancePct != null && variancePct > 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">{variancePct.toFixed(2)}%</p>
                ) : null}
              </div>
            );
          }

          return null;
        }}
      />
    </DocumentLineEntrySection>
  );
}
