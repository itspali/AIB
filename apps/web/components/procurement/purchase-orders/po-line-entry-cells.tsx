"use client";

import { Trash2 } from "lucide-react";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoLineColumnId } from "@/lib/documents/purchase-order-layout";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { computeLineGross, formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import { cn } from "@/lib/utils";
import { isEnterKey } from "@/components/procurement/purchase-orders/po-line-entry-actions";
import { PoLineSupplierInsightsButton } from "@/components/procurement/purchase-orders/po-line-supplier-insights";

export const PO_LINE_COMPACT_INPUT_CLASS =
  "h-8 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-sm shadow-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

/** Spreadsheet cell embed — square corners, no inner border box. */
export const PO_LINE_ITEM_CELL_INPUT_CLASS =
  "h-9 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:border-transparent focus-visible:outline-none focus-visible:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0";

type LineCellContext = {
  line: PoDraftLine;
  disabled: boolean;
  supplierId: string;
  destinationLocationId: string;
  excludePurchaseOrderId?: string | null;
  itemRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  qtyRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  priceRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  patchLine: (key: string, patch: Partial<PoDraftLine>) => void;
  bindItemChange: (lineKey: string) => (patch: Partial<PoDraftLine>) => void;
  focusPrice: (lineKey: string) => void;
  advanceFromLine: (lineKey: string) => void;
};

function nestedFieldDisplayValue(columnId: PoLineColumnId, _line: PoDraftLine): string {
  switch (columnId) {
    case "unit":
    case "discount_pct":
    case "discount_amount":
      return "—";
    default:
      return "—";
  }
}

export function PoLineNestedUnderItemFields({
  line,
  nestedColumns,
}: {
  line: PoDraftLine;
  nestedColumns: DocumentColumnPref[];
}) {
  if (!line.variant_id || nestedColumns.length === 0) return null;

  return (
    <div className="mt-1.5 space-y-1 border-t border-border/50 px-0 pb-0.5 pt-1.5">
      {line.variant_sku ? (
        <div className="truncate font-mono text-xs leading-snug text-muted-foreground">
          {line.variant_sku}
        </div>
      ) : null}
      {nestedColumns.map((column) => (
        <div
          key={column.id}
          className="flex min-w-0 items-baseline gap-1 text-xs leading-snug"
        >
          {column.showLabel !== false ? (
            <span className="shrink-0 text-muted-foreground">{column.label}:</span>
          ) : null}
          <span className="min-w-0 truncate tabular-nums text-foreground">
            {nestedFieldDisplayValue(column.id as PoLineColumnId, line)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PoLineItemCell({
  ctx,
  nestedColumns,
}: {
  ctx: LineCellContext;
  nestedColumns: DocumentColumnPref[];
}) {
  const { line, disabled, supplierId, destinationLocationId, excludePurchaseOrderId, itemRefs, bindItemChange, patchLine } =
    ctx;

  const hideFieldSecondary = nestedColumns.length > 0 && Boolean(line.variant_id);

  return (
    <div className="min-w-0 px-2 py-2 text-sm">
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <StockVariantSkuField
            compact
            displayMode="item"
            disabled={disabled}
            inputClassName={PO_LINE_ITEM_CELL_INPUT_CLASS}
            showSecondaryText={!hideFieldSecondary}
            inputRef={(node) => {
              itemRefs.current[line.key] = node;
            }}
            value={{
              sku: line.sku,
              variant_id: line.variant_id,
              item_name: line.item_name,
              variant_sku: line.variant_sku,
              unit_cost: line.unit_price_contractual || "0",
              skuError: line.skuError,
            }}
            onChange={bindItemChange(line.key)}
          />
        </div>
        <PoLineSupplierInsightsButton
          line={line}
          supplierId={supplierId}
          destinationLocationId={destinationLocationId}
          excludePurchaseOrderId={excludePurchaseOrderId}
          disabled={disabled}
          onApplyCatalogPrice={(lineKey, price) =>
            patchLine(lineKey, { unit_price_contractual: price })
          }
        />
      </div>
      <PoLineNestedUnderItemFields line={line} nestedColumns={nestedColumns} />
    </div>
  );
}

export function PoLineQtyCell({
  ctx,
  align,
}: {
  ctx: LineCellContext;
  align?: "left" | "right" | "center";
}) {
  const { line, disabled, qtyRefs, patchLine, focusPrice } = ctx;

  return (
    <div className={align === "right" ? "flex justify-end" : undefined}>
      <Input
        ref={(node) => {
          qtyRefs.current[line.key] = node;
        }}
        className={cn(
          "tabular-nums",
          PO_LINE_COMPACT_INPUT_CLASS,
          "w-full",
          align === "right" && "text-right"
        )}
        value={line.quantity_ordered}
        disabled={disabled}
        inputMode="decimal"
        aria-label="Quantity ordered"
        onChange={(event) => patchLine(line.key, { quantity_ordered: event.target.value })}
        onKeyDown={(event) => {
          if (!isEnterKey(event.key)) return;
          event.preventDefault();
          if (line.variant_id && Number(line.quantity_ordered) > 0) {
            focusPrice(line.key);
          }
        }}
      />
    </div>
  );
}

export function PoLinePriceCell({
  ctx,
  align,
}: {
  ctx: LineCellContext;
  align?: "left" | "right" | "center";
}) {
  const { line, disabled, priceRefs, patchLine, advanceFromLine } = ctx;

  return (
    <div className={align === "right" ? "flex justify-end" : undefined}>
      <Input
        ref={(node) => {
          priceRefs.current[line.key] = node;
        }}
        className={cn(
          "tabular-nums",
          PO_LINE_COMPACT_INPUT_CLASS,
          "w-full",
          align === "right" && "text-right"
        )}
        value={line.unit_price_contractual}
        disabled={disabled}
        inputMode="decimal"
        aria-label="Unit price ex tax"
        onChange={(event) =>
          patchLine(line.key, { unit_price_contractual: event.target.value })
        }
        onKeyDown={(event) => {
          if (!isEnterKey(event.key)) return;
          event.preventDefault();
          advanceFromLine(line.key);
        }}
      />
    </div>
  );
}

export function PoLineTotalCell({
  line,
  align,
}: {
  line: PoDraftLine;
  align?: "left" | "right" | "center";
}) {
  const lineTotal = formatPoMoney(computeLineGross(line));

  return (
    <div
      className={cn(
        "px-2 py-1.5 text-sm tabular-nums text-muted-foreground",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {lineTotal}
    </div>
  );
}

export function PoLineRemoveButton({
  lineKey,
  disabled,
  canRemove,
  onRemove,
}: {
  lineKey: string;
  disabled: boolean;
  canRemove: boolean;
  onRemove: (key: string) => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 w-8 p-0 text-muted-foreground"
      disabled={disabled || !canRemove}
      onClick={() => onRemove(lineKey)}
      aria-label="Remove line"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

export function renderPoLineColumnCell(
  columnId: PoLineColumnId,
  column: DocumentColumnPref,
  ctx: LineCellContext,
  nestedColumns: DocumentColumnPref[]
) {
  if (columnId === "item") {
    return <PoLineItemCell ctx={ctx} nestedColumns={nestedColumns} />;
  }
  if (columnId === "quantity_ordered") {
    return <PoLineQtyCell ctx={ctx} align={column.align} />;
  }
  if (columnId === "unit_price") {
    return <PoLinePriceCell ctx={ctx} align={column.align} />;
  }
  if (columnId === "line_total") {
    return <PoLineTotalCell line={ctx.line} align={column.align} />;
  }
  return <span className="px-2 text-sm text-muted-foreground">—</span>;
}

export type { LineCellContext };
