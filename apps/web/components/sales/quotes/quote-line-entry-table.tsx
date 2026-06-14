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
import type { QuoteDraftLine } from "@/lib/sales/quotes/draft-form";

type Props = {
  lines: QuoteDraftLine[];
  disabled?: boolean;
  fillHeight?: boolean;
  onChange: (lines: QuoteDraftLine[] | ((current: QuoteDraftLine[]) => QuoteDraftLine[])) => void;
  onResolveSku: (key: string, sku: string) => void;
};

const QUOTE_COLUMNS: DocumentLineColumn[] = [
  { id: "sku", label: "SKU", align: "left", widthClass: "w-[7rem]", editable: true },
  {
    id: "item",
    label: "Item",
    align: "left",
    widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
    editable: false,
  },
  {
    id: "quantity_quoted",
    label: "Qty",
    align: "right",
    widthClass: "w-[4.75rem]",
    editable: true,
  },
  {
    id: "unit_price_selling",
    label: "Unit price",
    align: "right",
    widthClass: "w-[4.75rem]",
    editable: true,
  },
];

export function QuoteLineEntryTable({
  lines,
  disabled = false,
  fillHeight = false,
  onChange,
  onResolveSku,
}: Props) {
  const patchLine = useCallback(
    (key: string, patch: Partial<QuoteDraftLine>) => {
      onChange((current) =>
        current.map((line) => (line.key === key ? { ...line, ...patch } : line))
      );
    },
    [onChange]
  );

  return (
    <DocumentLineEntrySection title="Quote lines" fillHeight={fillHeight}>
      <DocumentLineEntryGrid
        lines={lines}
        columns={QUOTE_COLUMNS}
        minTableWidth="min-w-[36rem]"
        fillHeight={fillHeight}
        disabled={disabled}
        showRemoveColumn={false}
        renderCell={(column, line) => {
          if (column.id === "sku") {
            return (
              <div className="px-1 py-1">
                <DocumentLineCompactInput
                  value={line.sku}
                  disabled={disabled}
                  onChange={(event) =>
                    patchLine(line.key, { sku: event.target.value, skuError: null })
                  }
                  onBlur={() => {
                    if (line.sku.trim()) onResolveSku(line.key, line.sku.trim());
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && line.sku.trim()) {
                      event.preventDefault();
                      onResolveSku(line.key, line.sku.trim());
                    }
                  }}
                />
                {line.skuError ? (
                  <p className="px-1 text-xs text-destructive">{line.skuError}</p>
                ) : null}
              </div>
            );
          }
          if (column.id === "item") {
            return (
              <DocumentLineReadOnlyItemCell
                itemName={line.item_name || "—"}
                variantSku={line.variant_sku}
              />
            );
          }
          if (column.id === "quantity_quoted") {
            return (
              <DocumentLineCompactInput
                value={line.quantity_quoted}
                disabled={disabled}
                align="right"
                onChange={(event) =>
                  patchLine(line.key, { quantity_quoted: event.target.value })
                }
              />
            );
          }
          return (
            <DocumentLineCompactInput
              value={line.unit_price_selling}
              disabled={disabled}
              align="right"
              onChange={(event) =>
                patchLine(line.key, { unit_price_selling: event.target.value })
              }
            />
          );
        }}
      />
    </DocumentLineEntrySection>
  );
}
