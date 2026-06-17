"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DocumentLineStockHint } from "@/components/documents/document-line-stock-hint";
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
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { transferQuantityExceedsOnHand } from "@/lib/inventory/transfers/draft-quantity-hints";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";
import { useLineStockContext } from "@/lib/inventory/stock/use-line-stock-context";
import { prefetchLineStockContexts } from "@/lib/inventory/stock/line-stock-context-cache";
import {
  PoLineQtyValueStack,
  PoLineSublineSingleRow,
  PO_LINE_SUBLINE_TEXT_CLASS,
} from "@/components/procurement/purchase-orders/po-line-qty-unit-slot";
import { cn } from "@/lib/utils";

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
  sourceLocationId: string;
  disabled?: boolean;
  showSectionTitle?: boolean;
  fillHeight?: boolean;
  onChange: (
    lines: TransferDraftLine[] | ((current: TransferDraftLine[]) => TransferDraftLine[])
  ) => void;
};

const TRANSFER_STOCK_SCOPE = { scope: "on_hand" as const };

const TRANSFER_QTY_COLUMN_WIDTH = "min-w-[8.75rem] w-[8.75rem] sm:min-w-[9.5rem] sm:w-[9.5rem]";

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
    widthClass: TRANSFER_QTY_COLUMN_WIDTH,
    editable: true,
  },
];

function useTransferLineActions(
  lines: TransferDraftLine[],
  sourceLocationId: string,
  onChange: (
    lines: TransferDraftLine[] | ((current: TransferDraftLine[]) => TransferDraftLine[])
  ) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

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
      if (patch.variant_id?.trim() && sourceLocationId.trim()) {
        prefetchLineStockContexts(sourceLocationId, patch.variant_id, TRANSFER_STOCK_SCOPE);
      }

      onChange((current) => {
        const next = current.map((line) => (line.key === lineKey ? { ...line, ...patch } : line));
        return ensureTrailingEmptyLine(next, isDocumentLineItemSelected, createEmptyTransferLine);
      });
    },
    [onChange, sourceLocationId]
  );

  return { itemRefs, patchLine, removeLine, bindItemChange };
}

export function TransferLineEntryTable({
  lines,
  sourceLocationId,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  onChange,
}: Props) {
  const actions = useTransferLineActions(lines, sourceLocationId, onChange);
  const lineVariantIds = useMemo(
    () => lines.map((line) => line.variant_id).filter(Boolean),
    [lines]
  );
  const getLineStockContext = useLineStockContext(
    sourceLocationId,
    lineVariantIds,
    TRANSFER_STOCK_SCOPE
  );

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  useEffect(() => {
    const locationId = sourceLocationId.trim();
    if (!locationId || lineVariantIds.length === 0) return;
    prefetchLineStockContexts(locationId, lineVariantIds, TRANSFER_STOCK_SCOPE);
  }, [sourceLocationId, lineVariantIds]);

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
        minTableWidth="min-w-[38rem]"
        disabled={disabled}
        canRemoveLine={(_, __, allLines) => allLines.length > 1}
        onRemoveLine={actions.removeLine}
        renderCell={(column, line) => {
          const stockContext =
            line.variant_id && sourceLocationId
              ? getLineStockContext(line.variant_id)
              : null;

          if (column.id === "item") {
            return (
              <div className="min-w-0 px-2 py-2 text-sm">
                <StockVariantSkuField
                  compact
                  displayMode="item"
                  disabled={disabled}
                  stockLocationId={sourceLocationId}
                  stockContextScope="on_hand"
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
                {line.variant_id && sourceLocationId ? (
                  <DocumentLineStockHint
                    context={stockContext}
                    className="mt-1 px-0.5"
                  />
                ) : null}
              </div>
            );
          }

          if (column.id === "quantity_dispatched") {
            const exceedsOnHand = transferQuantityExceedsOnHand(
              line.quantity_dispatched,
              stockContext
            );

            const qtyInput = (
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

            if (!exceedsOnHand) {
              return qtyInput;
            }

            return (
              <PoLineQtyValueStack
                showUnitUnderQty
                align="right"
                unitSlot={
                  <PoLineSublineSingleRow align="right">
                    <span
                      className={cn(
                        "block w-full truncate px-2 tabular-nums text-amber-700 dark:text-amber-300",
                        PO_LINE_SUBLINE_TEXT_CLASS
                      )}
                      title="Draft saves are allowed; dispatch rechecks on-hand"
                    >
                      Exceeds on hand
                    </span>
                  </PoLineSublineSingleRow>
                }
              >
                {qtyInput}
              </PoLineQtyValueStack>
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
