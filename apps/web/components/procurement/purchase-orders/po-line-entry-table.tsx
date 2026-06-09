"use client";

import { useEffect, useMemo } from "react";
import {
  getCompactPoTableColumns,
  getNestedUnderItemPoLineColumns,
} from "@/lib/documents/purchase-order-layout";
import type { PoLineColumnId } from "@/lib/documents/purchase-order-layout";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { cn } from "@/lib/utils";
import { prefetchBrowseVariants } from "@/lib/inventory/stock/variant-suggestion-cache";
import { usePoLineEntryActions } from "@/components/procurement/purchase-orders/po-line-entry-actions";
import {
  type LineCellContext,
  PoLineRemoveButton,
  renderPoLineColumnCell,
} from "@/components/procurement/purchase-orders/po-line-entry-cells";

type Props = {
  lines: PoDraftLine[];
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  disabled?: boolean;
  showSectionTitle?: boolean;
  /** Fill parent height and scroll line rows inside the table panel. */
  fillHeight?: boolean;
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void;
};

const PO_LINE_COLUMN_WIDTH: Partial<Record<PoLineColumnId, string>> = {
  item: "min-w-[12rem] w-[12rem] sm:min-w-[16rem] sm:w-[16rem]",
  quantity_ordered: "min-w-[4.5rem] w-[4.5rem]",
  unit_price: "min-w-[5.5rem] w-[5.5rem]",
  line_total: "min-w-[5.5rem] w-[5.5rem]",
};

function poLineColumnClass(
  columnId: PoLineColumnId,
  align: "left" | "right" | "center" | undefined,
  extra?: string
) {
  return cn(
    columnId === "item" ? "p-0 align-top" : "p-0 align-middle",
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
    PO_LINE_COLUMN_WIDTH[columnId],
    extra
  );
}

const PO_LINE_HEADER_CELL =
  "border border-border sticky top-0 z-[5] bg-muted/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))]";

const PO_LINE_BODY_CELL = "border border-border";

const PO_LINE_EDITABLE_CELL = "border border-border po-line-cell-surface";

const PO_LINE_EDITABLE_COLUMN_IDS = new Set<PoLineColumnId>([
  "item",
  "quantity_ordered",
  "unit_price",
]);

function PoLineEntryGrid({
  lines,
  supplierId,
  destinationLocationId,
  excludePurchaseOrderId,
  disabled,
  fillHeight,
  actions,
}: {
  lines: PoDraftLine[];
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  disabled: boolean;
  fillHeight: boolean;
  actions: ReturnType<typeof usePoLineEntryActions>;
}) {
  const visibleColumns = useMemo(() => getCompactPoTableColumns(), []);
  const nestedColumns = useMemo(() => getNestedUnderItemPoLineColumns(), []);

  return (
    <div
      className={cn(
        "po-line-grid-canvas w-full min-w-0 max-w-full overflow-hidden rounded-md border border-border",
        fillHeight && "flex min-h-0 flex-1 flex-col"
      )}
    >
      <div
        className={cn(
          "w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain",
          fillHeight ? "min-h-0 flex-1 overflow-y-auto" : "overflow-y-visible"
        )}
      >
        <table
          className={cn(
            "w-full min-w-[34rem] border-collapse text-sm",
            "[&_input:focus-visible]:border-transparent [&_input:focus-visible]:shadow-none [&_input:focus-visible]:ring-0 [&_input:focus-visible]:ring-offset-0"
          )}
        >
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th
                scope="col"
                className={cn(
                  "w-9 px-0 py-1.5 text-center text-xs font-medium",
                  PO_LINE_HEADER_CELL
                )}
                aria-label="Line number"
              >
                #
              </th>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    poLineColumnClass(
                      column.id as PoLineColumnId,
                      column.align,
                      "px-1.5 py-1.5 text-xs font-medium"
                    ),
                    PO_LINE_HEADER_CELL
                  )}
                >
                  {column.label}
                </th>
              ))}
              <th
                className={cn("w-9 px-0 py-1.5", PO_LINE_HEADER_CELL)}
                scope="col"
                aria-label="Remove line"
              />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, lineIndex) => {
              const ctx: LineCellContext = {
                line,
                disabled,
                supplierId,
                destinationLocationId,
                excludePurchaseOrderId,
                itemRefs: actions.itemRefs,
                qtyRefs: actions.qtyRefs,
                priceRefs: actions.priceRefs,
                patchLine: actions.patchLine,
                bindItemChange: actions.bindItemChange,
                focusPrice: actions.focusPrice,
                advanceFromLine: actions.advanceFromLine,
              };

              return (
                <tr key={line.key}>
                  <td className="w-9 border border-border px-0 py-1 text-center align-middle text-xs tabular-nums text-muted-foreground">
                    {lineIndex + 1}
                  </td>
                  {visibleColumns.map((column) => {
                    const columnId = column.id as PoLineColumnId;
                    return (
                      <td
                        key={columnId}
                        className={cn(
                          poLineColumnClass(columnId, column.align),
                          PO_LINE_EDITABLE_COLUMN_IDS.has(columnId)
                            ? PO_LINE_EDITABLE_CELL
                            : PO_LINE_BODY_CELL
                        )}
                      >
                        {renderPoLineColumnCell(columnId, column, ctx, nestedColumns)}
                      </td>
                    );
                  })}
                  <td className="w-9 border border-border p-0 text-center align-middle">
                    <PoLineRemoveButton
                      lineKey={line.key}
                      disabled={disabled}
                      canRemove={lines.length > 1}
                      onRemove={actions.removeLine}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PoLineEntryTable({
  lines,
  supplierId,
  destinationLocationId,
  excludePurchaseOrderId,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  onChange,
}: Props) {
  const actions = usePoLineEntryActions(lines, supplierId, onChange);

  useEffect(() => {
    prefetchBrowseVariants();
  }, []);

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", fillHeight && "min-h-0 flex-1")}>
      {showSectionTitle ? (
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lines
        </p>
      ) : (
        <span className="sr-only">Purchase order lines</span>
      )}

      <PoLineEntryGrid
        lines={lines}
        supplierId={supplierId}
        destinationLocationId={destinationLocationId}
        excludePurchaseOrderId={excludePurchaseOrderId}
        disabled={disabled}
        fillHeight={fillHeight}
        actions={actions}
      />
    </div>
  );
}
