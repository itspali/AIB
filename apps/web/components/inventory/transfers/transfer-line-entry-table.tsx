"use client";

import { useCallback, useEffect, useRef } from "react";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { DocumentLineCompactInput, DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS } from "@/components/documents/document-line-entry-cells";
import {
  DocumentLineEntryGrid,
  DocumentLineEntrySection,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";
import { ensureTrailingEmptyLine } from "@/lib/documents/line-entry";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";

export type TransferDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  quantity_dispatched: string;
  skuError: string | null;
};

type Props = {
  lines: TransferDraftLine[];
  disabled?: boolean;
  showSectionTitle?: boolean;
  fillHeight?: boolean;
  onChange: (
    lines: TransferDraftLine[] | ((current: TransferDraftLine[]) => TransferDraftLine[])
  ) => void;
};

export function createEmptyTransferLine(): TransferDraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    quantity_dispatched: "",
    skuError: null,
  };
}

function isTransferLineComplete(line: TransferDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_dispatched) > 0;
}

const TRANSFER_COLUMNS: DocumentLineColumn[] = [
  {
    id: "item",
    label: "Item",
    align: "left",
    widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
    editable: true,
  },
  {
    id: "quantity_dispatched",
    label: "Qty to transfer",
    align: "right",
    widthClass: "w-[5.5rem]",
    editable: true,
  },
];

function useTransferLineActions(
  lines: TransferDraftLine[],
  onChange: (
    lines: TransferDraftLine[] | ((current: TransferDraftLine[]) => TransferDraftLine[])
  ) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<TransferDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        return ensureTrailingEmptyLine(next, isTransferLineComplete, createEmptyTransferLine);
      });
    },
    [onChange]
  );

  const removeLine = useCallback(
    (key: string) => {
      onChange((current) => {
        if (current.length <= 1) return current;
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingEmptyLine(next, isTransferLineComplete, createEmptyTransferLine);
      });
    },
    [onChange]
  );

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: Partial<TransferDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === lineKey ? { ...line, ...patch } : line));
        return ensureTrailingEmptyLine(next, isTransferLineComplete, createEmptyTransferLine);
      });
    },
    [onChange]
  );

  return { itemRefs, patchLine, removeLine, bindItemChange };
}

export function TransferLineEntryTable({
  lines,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  onChange,
}: Props) {
  const actions = useTransferLineActions(lines, onChange);

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
        columns={TRANSFER_COLUMNS}
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
                    unit_cost: "0",
                    skuError: line.skuError,
                  }}
                  onChange={actions.bindItemChange(line.key)}
                />
                {line.variant_sku ? (
                  <div className="mt-1.5 truncate border-t border-border/50 pt-1.5 font-mono text-xs leading-snug text-muted-foreground">
                    {line.variant_sku}
                  </div>
                ) : null}
              </div>
            );
          }

          if (column.id === "quantity_dispatched") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_dispatched}
                disabled={disabled}
                inputMode="decimal"
                placeholder="0"
                aria-label="Quantity to transfer"
                onChange={(event) =>
                  actions.patchLine(line.key, { quantity_dispatched: event.target.value })
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

export function filterSavableTransferLines(lines: TransferDraftLine[]): TransferDraftLine[] {
  return lines.filter(isTransferLineComplete);
}
