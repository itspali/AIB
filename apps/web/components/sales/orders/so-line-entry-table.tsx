"use client";

import { useCallback } from "react";
import { lookupStockVariantBySku } from "@/app/sales/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createEmptySoLine,
  ensureTrailingSoLine,
  isSoLineBlank,
  type SoDraftLine,
} from "@/lib/sales/orders/draft-form";
import { computeSoLineGross } from "@/lib/sales/orders/totals";
import { cn } from "@/lib/utils";

type Props = {
  lines: SoDraftLine[];
  disabled?: boolean;
  allowLineItemDiscounts?: boolean;
  onChange: (lines: SoDraftLine[] | ((current: SoDraftLine[]) => SoDraftLine[])) => void;
};

export function SoLineEntryTable({
  lines,
  disabled = false,
  allowLineItemDiscounts = true,
  onChange,
}: Props) {
  const updateLine = useCallback(
    (key: string, patch: Partial<SoDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        return ensureTrailingSoLine(next);
      });
    },
    [onChange]
  );

  const removeLine = useCallback(
    (key: string) => {
      onChange((current) => {
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingSoLine(next.length > 0 ? next : [createEmptySoLine()]);
      });
    },
    [onChange]
  );

  const resolveSku = useCallback(
    async (line: SoDraftLine) => {
      const sku = line.sku.trim();
      if (!sku) return;

      const result = await lookupStockVariantBySku(sku);
      if ("error" in result) {
        updateLine(line.key, { skuError: result.error ?? "Unable to resolve SKU." });
        return;
      }
      if (!result.variant) {
        updateLine(line.key, { skuError: "SKU not found." });
        return;
      }

      updateLine(line.key, {
        sku: result.variant.variant_sku,
        variant_id: result.variant.variant_id,
        item_id: result.variant.item_id,
        item_name: result.variant.item_name,
        variant_sku: result.variant.variant_sku,
        skuError: null,
      });
    },
    [updateLine]
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Item</th>
            <th className="px-3 py-2 font-medium text-right">Qty</th>
            <th className="px-3 py-2 font-medium text-right">Price</th>
            {allowLineItemDiscounts ? (
              <>
                <th className="px-3 py-2 font-medium text-right">Disc %</th>
                <th className="px-3 py-2 font-medium text-right">Disc amt</th>
              </>
            ) : null}
            <th className="px-3 py-2 font-medium text-right">Line total</th>
            <th className="px-3 py-2 font-medium text-right">Tax</th>
            <th className="w-10 px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => {
            const blank = isSoLineBlank(line);
            const lineTotal = computeSoLineGross(line);

            return (
              <tr key={line.key} className="border-b border-border/70 align-top">
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <Input
                      value={line.sku}
                      disabled={disabled}
                      placeholder="SKU"
                      className="h-8 font-mono text-xs"
                      onChange={(event) =>
                        updateLine(line.key, {
                          sku: event.target.value,
                          skuError: null,
                        })
                      }
                      onBlur={() => void resolveSku(line)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void resolveSku(line);
                        }
                      }}
                    />
                    {line.item_name ? (
                      <p className="text-xs text-muted-foreground">{line.item_name}</p>
                    ) : null}
                    {line.skuError ? (
                      <p className="text-xs text-destructive">{line.skuError}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={line.quantity_ordered}
                    disabled={disabled}
                    inputMode="decimal"
                    className="h-8 text-right tabular-nums"
                    onChange={(event) =>
                      updateLine(line.key, { quantity_ordered: event.target.value })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={line.unit_price_selling}
                    disabled={disabled}
                    inputMode="decimal"
                    className="h-8 text-right tabular-nums"
                    onChange={(event) =>
                      updateLine(line.key, { unit_price_selling: event.target.value })
                    }
                  />
                </td>
                {allowLineItemDiscounts ? (
                  <>
                    <td className="px-3 py-2">
                      <Input
                        value={line.discount_percentage}
                        disabled={disabled}
                        inputMode="decimal"
                        className="h-8 text-right tabular-nums"
                        onChange={(event) =>
                          updateLine(line.key, { discount_percentage: event.target.value })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={line.discount_amount}
                        disabled={disabled}
                        inputMode="decimal"
                        className="h-8 text-right tabular-nums"
                        onChange={(event) =>
                          updateLine(line.key, { discount_amount: event.target.value })
                        }
                      />
                    </td>
                  </>
                ) : null}
                <td className={cn("px-3 py-2 text-right tabular-nums")}>
                  {line.variant_id ? lineTotal.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">—</td>
                <td className="px-2 py-2 text-right">
                  {!blank ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      disabled={disabled}
                      onClick={() => removeLine(line.key)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
