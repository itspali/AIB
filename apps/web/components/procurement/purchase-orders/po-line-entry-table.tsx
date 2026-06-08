"use client";

import { useCallback, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { lookupSupplierVariantPrice } from "@/app/procurement/purchase-orders/actions";
import { StockVariantSkuField } from "@/components/inventory/stock/stock-variant-sku-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getVisiblePoLineColumns } from "@/lib/documents/purchase-order-layout";
import type { PoLineColumnId } from "@/lib/documents/purchase-order-layout";
import {
  createEmptyPoLine,
  ensureTrailingPoLine,
  isPoLineComplete,
  type PoDraftLine,
} from "@/lib/procurement/purchase-orders/draft-form";
import { computeLineGross, formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import { cn } from "@/lib/utils";

type Props = {
  lines: PoDraftLine[];
  supplierId: string;
  disabled?: boolean;
  showSectionTitle?: boolean;
  /** Fill parent height and scroll line rows inside the table panel. */
  fillHeight?: boolean;
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void;
};

function isEnterKey(key: string): boolean {
  return key === "Enter" || key === "NumpadEnter";
}

const PO_LINE_COLUMN_WIDTH: Partial<Record<PoLineColumnId, string>> = {
  item: "min-w-[220px]",
  quantity_ordered: "w-28",
  unit_price: "w-36",
  line_total: "w-32",
};

function poLineColumnClass(
  columnId: PoLineColumnId,
  align: "left" | "right" | undefined,
  extra?: string
) {
  return cn(
    "p-2 align-top",
    align === "right" ? "text-right" : "text-left",
    PO_LINE_COLUMN_WIDTH[columnId],
    extra
  );
}

const PO_LINE_HEADER_CELL_CLASS =
  "sticky z-[5] bg-muted/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))] top-0";

const PO_LINE_NUMBER_HEADER_CLASS = cn(
  "w-10 p-2 text-center font-medium",
  PO_LINE_HEADER_CELL_CLASS
);

const PO_LINE_NUMBER_CELL_CLASS =
  "w-10 p-2 text-center align-top tabular-nums text-xs text-muted-foreground";

function focusInput(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

export function PoLineEntryTable({
  lines,
  supplierId,
  disabled = false,
  showSectionTitle = true,
  fillHeight = false,
  onChange,
}: Props) {
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const visibleColumns = getVisiblePoLineColumns();

  const patchLine = useCallback(
    (key: string, patch: Partial<PoDraftLine>) => {
      onChange((current) =>
        current.map((line) => (line.key === key ? { ...line, ...patch } : line))
      );
    },
    [onChange]
  );

  const focusItem = useCallback((lineKey: string) => {
    focusInput(itemRefs.current[lineKey]);
  }, []);

  const focusQty = useCallback((lineKey: string) => {
    focusInput(qtyRefs.current[lineKey]);
  }, []);

  const focusPrice = useCallback((lineKey: string) => {
    focusInput(priceRefs.current[lineKey]);
  }, []);

  const advanceFromLine = useCallback(
    (lineKey: string, linesOverride?: PoDraftLine[]) => {
      const resolveNext = (currentLines: PoDraftLine[]) => {
        const lineIndex = currentLines.findIndex((row) => row.key === lineKey);
        if (lineIndex === -1) {
          return { lines: currentLines, focusKey: null as string | null };
        }

        const line = currentLines[lineIndex]!;
        if (!isPoLineComplete(line)) {
          return { lines: currentLines, focusKey: null as string | null };
        }

        const withTrailing =
          lineIndex === currentLines.length - 1
            ? ensureTrailingPoLine(currentLines)
            : currentLines;

        const nextLine = withTrailing[lineIndex + 1];
        return {
          lines: withTrailing,
          focusKey: nextLine?.key ?? null,
        };
      };

      if (linesOverride) {
        const { lines: nextLines, focusKey } = resolveNext(linesOverride);
        if (nextLines !== linesOverride) {
          onChange(nextLines);
        }
        if (focusKey) focusItem(focusKey);
        return;
      }

      onChange((currentLines) => {
        const { lines: nextLines, focusKey } = resolveNext(currentLines);
        if (focusKey) focusItem(focusKey);
        return nextLines;
      });
    },
    [focusItem, onChange]
  );

  const addLine = () => {
    onChange((current) => {
      const nextLines = [...current, createEmptyPoLine()];
      const newLine = nextLines.at(-1);
      if (newLine) focusItem(newLine.key);
      return nextLines;
    });
  };

  const removeLine = (key: string) => {
    onChange((current) => {
      if (current.length <= 1) return current;
      return current.filter((line) => line.key !== key);
    });
  };

  const applySupplierPrice = useCallback(
    async (lineKey: string, variantId: string, fallbackCost: string) => {
      if (!supplierId || !variantId) return;
      const result = await lookupSupplierVariantPrice({
        supplier_id: supplierId,
        variant_id: variantId,
      });
      if ("error" in result) return;
      const nextPrice = result.unit_price ?? fallbackCost;
      patchLine(lineKey, { unit_price_contractual: nextPrice || "0" });
    },
    [patchLine, supplierId]
  );

  const handleVariantSelected = useCallback(
    (
      lineKey: string,
      patch: Partial<PoDraftLine>,
      updatedLine: PoDraftLine,
      isLastLine: boolean,
      nextLines: PoDraftLine[]
    ) => {
      void applySupplierPrice(
        lineKey,
        patch.variant_id!,
        patch.unit_cost ?? updatedLine.unit_price_contractual ?? "0"
      );

      const qtyIsDefaultOne = Number(updatedLine.quantity_ordered) === 1;
      if (isLastLine && qtyIsDefaultOne && patch.variant_id) {
        advanceFromLine(lineKey, nextLines);
        return;
      }

      focusQty(lineKey);
    },
    [advanceFromLine, applySupplierPrice, focusQty]
  );

  return (
    <div className={cn("flex flex-col gap-3", fillHeight && "min-h-0 flex-1")}>
      {showSectionTitle ? (
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Lines
        </p>
      ) : null}

      <div
        className={cn(
          "surface-inset overflow-hidden",
          fillHeight && "flex min-h-0 flex-1 flex-col"
        )}
      >
        <div
          className={cn(
            "overflow-x-auto",
            fillHeight ? "min-h-0 flex-1 overflow-y-auto" : "overflow-y-visible"
          )}
        >
          <table className="min-w-full table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            {visibleColumns.map((column) => (
              <col key={column.id} className={PO_LINE_COLUMN_WIDTH[column.id as PoLineColumnId]} />
            ))}
            <col className="w-10" />
          </colgroup>
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th scope="col" className={PO_LINE_NUMBER_HEADER_CLASS} aria-label="Line number">
                #
              </th>
              {visibleColumns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={cn(
                    poLineColumnClass(column.id as PoLineColumnId, column.align, "font-medium"),
                    PO_LINE_HEADER_CELL_CLASS
                  )}
                >
                  {column.label}
                </th>
              ))}
              <th
                className={cn("w-10 p-2", PO_LINE_HEADER_CELL_CLASS)}
                scope="col"
                aria-label="Remove line"
              />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, lineIndex) => {
              const lineTotal = formatPoMoney(computeLineGross(line));

              return (
                <tr key={line.key} className="border-t border-border">
                  <td className={PO_LINE_NUMBER_CELL_CLASS}>{lineIndex + 1}</td>
                  {visibleColumns.map((column) => {
                    const columnId = column.id as PoLineColumnId;
                    const cellClass = poLineColumnClass(columnId, column.align);

                    if (columnId === "item") {
                      return (
                        <td key={columnId} className={cellClass}>
                          <StockVariantSkuField
                            compact
                            displayMode="item"
                            disabled={disabled}
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
                            onChange={(patch) => {
                              const lineKey = line.key;
                              onChange((currentLines) => {
                                const currentLine = currentLines.find((row) => row.key === lineKey);
                                if (!currentLine) return currentLines;

                                const hadVariant = Boolean(currentLine.variant_id);
                                const nextLines = currentLines.map((row) =>
                                  row.key === lineKey
                                    ? {
                                        ...row,
                                        ...patch,
                                        unit_price_contractual:
                                          patch.unit_cost ?? row.unit_price_contractual,
                                      }
                                    : row
                                );

                                if (!hadVariant && patch.variant_id) {
                                  const updatedLine = nextLines.find((row) => row.key === lineKey)!;
                                  window.requestAnimationFrame(() => {
                                    handleVariantSelected(
                                      lineKey,
                                      patch,
                                      updatedLine,
                                      lineKey === currentLines.at(-1)?.key,
                                      nextLines
                                    );
                                  });
                                }

                                return nextLines;
                              });
                            }}
                          />
                        </td>
                      );
                    }

                    if (columnId === "quantity_ordered") {
                      return (
                        <td key={columnId} className={cellClass}>
                          <div className={column.align === "right" ? "flex justify-end" : undefined}>
                            <Input
                              ref={(node) => {
                                qtyRefs.current[line.key] = node;
                              }}
                              className="h-9 w-24 tabular-nums"
                              value={line.quantity_ordered}
                              disabled={disabled}
                              inputMode="decimal"
                              aria-label="Quantity ordered"
                              onChange={(event) =>
                                patchLine(line.key, { quantity_ordered: event.target.value })
                              }
                              onKeyDown={(event) => {
                                if (!isEnterKey(event.key)) return;
                                event.preventDefault();
                                if (line.variant_id && Number(line.quantity_ordered) > 0) {
                                  focusPrice(line.key);
                                }
                              }}
                            />
                          </div>
                        </td>
                      );
                    }

                    if (columnId === "unit_price") {
                      return (
                        <td key={columnId} className={cellClass}>
                          <div className={column.align === "right" ? "flex justify-end" : undefined}>
                            <Input
                              ref={(node) => {
                                priceRefs.current[line.key] = node;
                              }}
                              className="h-9 w-28 tabular-nums"
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
                        </td>
                      );
                    }

                    if (columnId === "line_total") {
                      return (
                        <td
                          key={columnId}
                          className={cn(cellClass, "tabular-nums text-muted-foreground")}
                        >
                          {lineTotal}
                        </td>
                      );
                    }

                    return (
                      <td key={columnId} className={cellClass}>
                        —
                      </td>
                    );
                  })}
                  <td className="w-10 p-2 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                      disabled={disabled || lines.length <= 1}
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 gap-1 self-start"
        disabled={disabled}
        onClick={addLine}
      >
        <Plus className="h-3.5 w-3.5" />
        Add line
      </Button>
    </div>
  );
}
