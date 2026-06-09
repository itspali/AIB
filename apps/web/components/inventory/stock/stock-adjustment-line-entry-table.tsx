"use client";

import { useCallback, useEffect, useRef } from "react";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { DocumentLineCompactInput, DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS } from "@/components/documents/document-line-entry-cells";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";
import {
  ensureTrailingEmptyLine,
  isDocumentLineItemSelected,
} from "@/lib/documents/line-entry";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";

export type StockAdjustmentDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  quantity_delta: string;
  unit_cost: string;
  line_notes: string;
  skuError: string | null;
};

type Props = {
  lines: StockAdjustmentDraftLine[];
  disabled?: boolean;
  showSectionTitle?: boolean;
  fillHeight?: boolean;
  onChange: (
    lines:
      | StockAdjustmentDraftLine[]
      | ((current: StockAdjustmentDraftLine[]) => StockAdjustmentDraftLine[])
  ) => void;
};

export function createEmptyStockAdjustmentLine(): StockAdjustmentDraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    quantity_delta: "",
    unit_cost: "0",
    line_notes: "",
    skuError: null,
  };
}

function isStockAdjustmentLineComplete(line: StockAdjustmentDraftLine): boolean {
  return Boolean(line.variant_id) && line.quantity_delta.trim() !== "";
}

const STOCK_ADJUSTMENT_COLUMNS: DocumentLineColumn[] = [
  {
    id: "item",
    label: "Item",
    align: "left",
    widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
    editable: true,
  },
  {
    id: "quantity_delta",
    label: "Qty Δ",
    align: "right",
    widthClass: "w-[4.5rem]",
    editable: true,
  },
  {
    id: "unit_cost",
    label: "Unit cost",
    align: "right",
    widthClass: "w-[5.5rem]",
    editable: true,
  },
  {
    id: "line_notes",
    label: "Notes",
    align: "left",
    widthClass: "min-w-[8rem]",
    editable: true,
  },
];

function useStockAdjustmentLineActions(
  lines: StockAdjustmentDraftLine[],
  onChange: (
    lines:
      | StockAdjustmentDraftLine[]
      | ((current: StockAdjustmentDraftLine[]) => StockAdjustmentDraftLine[])
  ) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<StockAdjustmentDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        return ensureTrailingEmptyLine(next, isStockAdjustmentLineComplete, createEmptyStockAdjustmentLine);
      });
    },
    [onChange]
  );

  const removeLine = useCallback(
    (key: string) => {
      onChange((current) => {
        if (current.length <= 1) return current;
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingEmptyLine(next, isStockAdjustmentLineComplete, createEmptyStockAdjustmentLine);
      });
    },
    [onChange]
  );

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: Partial<StockAdjustmentDraftLine> & { unit_cost?: string }) => {
      onChange((current) => {
        const next = current.map((line) => {
          if (line.key !== lineKey) return line;
          return {
            ...line,
            ...patch,
            unit_cost: patch.unit_cost ?? line.unit_cost,
          };
        });
        return ensureTrailingEmptyLine(next, isDocumentLineItemSelected, createEmptyStockAdjustmentLine);
      });
    },
    [onChange]
  );

  return { itemRefs, patchLine, removeLine, bindItemChange };
}

export function StockAdjustmentLineEntryTable({
  lines,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  onChange,
}: Props) {
  const actions = useStockAdjustmentLineActions(lines, onChange);

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
    >
      <DocumentLineEntryGrid
        lines={lines}
        columns={STOCK_ADJUSTMENT_COLUMNS}
        minTableWidth="min-w-[40rem]"
        fillHeight={fillHeight}
        disabled={disabled}
        canRemoveLine={(_, __, allLines) => allLines.length > 1}
        onRemoveLine={actions.removeLine}
        renderCell={(column, line) => {
          if (column.id === "item") {
            return (
              <div className="min-w-0 px-2 py-2 text-sm">
                <StockVariantSkuField
                  compact
                  displayMode="item"
                  disabled={disabled}
                  inputClassName={DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS}
                  inputRef={(node) => {
                    actions.itemRefs.current[line.key] = node;
                  }}
                  value={{
                    sku: line.sku,
                    variant_id: line.variant_id,
                    item_name: line.item_name,
                    variant_sku: line.variant_sku,
                    unit_cost: line.unit_cost || "0",
                    skuError: line.skuError,
                  }}
                  onChange={actions.bindItemChange(line.key)}
                />
              </div>
            );
          }

          if (column.id === "quantity_delta") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_delta}
                disabled={disabled}
                inputMode="decimal"
                placeholder="10"
                aria-label="Quantity delta"
                onChange={(event) =>
                  actions.patchLine(line.key, { quantity_delta: event.target.value })
                }
              />
            );
          }

          if (column.id === "unit_cost") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.unit_cost}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Unit cost"
                onChange={(event) =>
                  actions.patchLine(line.key, { unit_cost: event.target.value })
                }
              />
            );
          }

          if (column.id === "line_notes") {
            return (
              <DocumentLineCompactInput
                value={line.line_notes}
                disabled={disabled}
                placeholder="Optional"
                aria-label="Line notes"
                onChange={(event) =>
                  actions.patchLine(line.key, { line_notes: event.target.value })
                }
              />
            );
          }

          return null;
        }}
      />
    </DocumentLineEntrySection>
  );
}

export function filterSavableStockAdjustmentLines(
  lines: StockAdjustmentDraftLine[]
): StockAdjustmentDraftLine[] {
  return lines.filter(isStockAdjustmentLineComplete);
}
