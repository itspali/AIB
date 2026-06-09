"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import {
  DocumentLineCompactInput,
  DOCUMENT_LINE_ITEM_CELL_INPUT_CLASS,
  DocumentLineReadOnlyItemCell,
} from "@/components/documents/document-line-entry-cells";
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

export type GrnDraftLine = {
  key: string;
  sku: string;
  variant_id: string;
  item_name: string;
  variant_sku: string;
  po_item_id: string | null;
  quantity_received: string;
  raw_unit_cost: string;
  open_quantity: string | null;
  skuError: string | null;
};

type Props = {
  lines: GrnDraftLine[];
  poLocked: boolean;
  disabled?: boolean;
  showSectionTitle?: boolean;
  fillHeight?: boolean;
  onChange: (lines: GrnDraftLine[] | ((current: GrnDraftLine[]) => GrnDraftLine[])) => void;
};

export function createEmptyGrnLine(): GrnDraftLine {
  return {
    key: crypto.randomUUID(),
    sku: "",
    variant_id: "",
    item_name: "",
    variant_sku: "",
    po_item_id: null,
    quantity_received: "",
    raw_unit_cost: "0",
    open_quantity: null,
    skuError: null,
  };
}

function isGrnLineComplete(line: GrnDraftLine): boolean {
  return Boolean(line.variant_id) && Number(line.quantity_received) > 0;
}

const GRN_COLUMNS: DocumentLineColumn[] = [
  {
    id: "item",
    label: "Item",
    align: "left",
    widthClass: "min-w-[12rem] w-auto sm:min-w-[16rem]",
    editable: true,
  },
  {
    id: "quantity_received",
    label: "Qty received",
    align: "right",
    widthClass: "w-[5.5rem]",
    editable: true,
  },
  {
    id: "raw_unit_cost",
    label: "Unit cost",
    align: "right",
    widthClass: "w-[5.5rem]",
    editable: true,
  },
];

function useGrnLineEntryActions(
  lines: GrnDraftLine[],
  poLocked: boolean,
  onChange: (lines: GrnDraftLine[] | ((current: GrnDraftLine[]) => GrnDraftLine[])) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<GrnDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        if (!poLocked) {
          return ensureTrailingEmptyLine(next, isGrnLineComplete, createEmptyGrnLine);
        }
        return next;
      });
    },
    [onChange, poLocked]
  );

  const removeLine = useCallback(
    (key: string) => {
      if (poLocked) return;
      onChange((current) => {
        if (current.length <= 1) return current;
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingEmptyLine(next, isGrnLineComplete, createEmptyGrnLine);
      });
    },
    [onChange, poLocked]
  );

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: Partial<GrnDraftLine> & { unit_cost?: string }) => {
      onChange((current) => {
        const next = current.map((line) => {
          if (line.key !== lineKey) return line;
          return {
            ...line,
            ...patch,
            raw_unit_cost: patch.unit_cost ?? line.raw_unit_cost,
          };
        });
        if (!poLocked) {
          return ensureTrailingEmptyLine(next, isDocumentLineItemSelected, createEmptyGrnLine);
        }
        return next;
      });
    },
    [onChange, poLocked]
  );

  return { itemRefs, patchLine, removeLine, bindItemChange };
}

export function GrnLineEntryTable({
  lines,
  poLocked,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  onChange,
}: Props) {
  const actions = useGrnLineEntryActions(lines, poLocked, onChange);

  useEffect(() => {
    if (!poLocked) prefetchBrowseVariants();
  }, [poLocked]);

  const columns = useMemo(
    () =>
      GRN_COLUMNS.map((column) => ({
        ...column,
        editable: column.id === "item" ? !poLocked : true,
      })),
    [poLocked]
  );

  return (
    <DocumentLineEntrySection
      title="Lines"
      fillHeight={fillHeight}
      showSectionTitle={showSectionTitle}
    >
      <DocumentLineEntryGrid
        lines={lines}
        columns={columns}
        fillHeight={fillHeight}
        disabled={disabled}
        showRemoveColumn={!poLocked}
        canRemoveLine={(_, __, allLines) => !poLocked && allLines.length > 1}
        onRemoveLine={actions.removeLine}
        renderCell={(column, line) => {
          if (column.id === "item") {
            if (poLocked) {
              return (
                <DocumentLineReadOnlyItemCell
                  itemName={line.item_name}
                  variantSku={line.variant_sku}
                  hint={line.open_quantity ? `Open: ${line.open_quantity}` : null}
                />
              );
            }

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
                    unit_cost: line.raw_unit_cost || "0",
                    skuError: line.skuError,
                  }}
                  onChange={actions.bindItemChange(line.key)}
                />
              </div>
            );
          }

          if (column.id === "quantity_received") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.quantity_received}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Quantity received"
                onChange={(event) =>
                  actions.patchLine(line.key, { quantity_received: event.target.value })
                }
              />
            );
          }

          if (column.id === "raw_unit_cost") {
            return (
              <DocumentLineCompactInput
                align="right"
                value={line.raw_unit_cost}
                disabled={disabled}
                inputMode="decimal"
                aria-label="Unit cost"
                onChange={(event) =>
                  actions.patchLine(line.key, { raw_unit_cost: event.target.value })
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

export function filterSavableGrnLines(lines: GrnDraftLine[]): GrnDraftLine[] {
  return lines.filter(isGrnLineComplete);
}
