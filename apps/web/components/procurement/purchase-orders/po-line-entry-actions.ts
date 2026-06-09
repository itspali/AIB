"use client";

import { useCallback, useRef } from "react";
import { lookupSupplierVariantPrice } from "@/app/procurement/purchase-orders/actions";
import {
  ensureTrailingPoLine,
  isPoLineComplete,
  type PoDraftLine,
} from "@/lib/procurement/purchase-orders/draft-form";

function focusInput(input: HTMLInputElement | null | undefined) {
  if (!input) return;
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

export function usePoLineEntryActions(
  lines: PoDraftLine[],
  supplierId: string,
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const removeLine = useCallback(
    (key: string) => {
      onChange((current) => {
        if (current.length <= 1) return current;
        return current.filter((line) => line.key !== key);
      });
    },
    [onChange]
  );

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
        updatedLine.unit_price_contractual ?? "0"
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

  type ItemChangePatch = Partial<PoDraftLine> & { unit_cost?: string };

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: ItemChangePatch) => {
      onChange((currentLines) => {
        const currentLine = currentLines.find((row) => row.key === lineKey);
        if (!currentLine) return currentLines;

        const hadVariant = Boolean(currentLine.variant_id);
        const nextLines = currentLines.map((row) => {
          if (row.key !== lineKey) return row;
          const clearingItem = patch.variant_id === "";
          return {
            ...row,
            ...patch,
            item_id: clearingItem ? "" : patch.item_id ?? row.item_id,
            unit_price_contractual: clearingItem
              ? "0"
              : patch.unit_cost ?? row.unit_price_contractual,
          };
        });

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
    },
    [handleVariantSelected, onChange]
  );

  return {
    itemRefs,
    qtyRefs,
    priceRefs,
    patchLine,
    focusItem,
    focusQty,
    focusPrice,
    advanceFromLine,
    removeLine,
    bindItemChange,
  };
}

export function isEnterKey(key: string): boolean {
  return key === "Enter" || key === "NumpadEnter";
}
