"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { lookupPoLineCatalogContext, lookupSupplierVariantPrice } from "@/app/procurement/purchase-orders/actions";
import { mergePoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  getCachedVariantBaseUnit,
  getCachedVariantImageUrl,
} from "@/lib/inventory/stock/variant-suggestion-cache";
import {
  createEmptyPoLine,
  ensureTrailingPoLine,
  isPoLineComplete,
  type PoDraftLine,
} from "@/lib/procurement/purchase-orders/draft-form";

function focusInput(input: HTMLInputElement | HTMLTextAreaElement | null | undefined) {
  if (!input) return;
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function resolveVariantImageUrl(
  variantId: string,
  patchImageUrl?: string | null
): string | null {
  return patchImageUrl?.trim() || getCachedVariantImageUrl(variantId) || null;
}

function resolveVariantBaseUnit(
  variantId: string,
  patchBaseUnit?: string | null
): string | null {
  return patchBaseUnit?.trim() || getCachedVariantBaseUnit(variantId) || null;
}

export function usePoLineEntryActions(
  lines: PoDraftLine[],
  supplierId: string,
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<PoDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        return ensureTrailingPoLine(next);
      });
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
        if (current.length <= 1) return [createEmptyPoLine()];
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingPoLine(next);
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

  const applyCatalogContext = useCallback(
    async (lineKey: string, variantId: string, fallbackImageUrl?: string | null) => {
      if (!variantId) return;
      const result = await lookupPoLineCatalogContext({ variant_id: variantId });
      if ("error" in result) {
        toast.error(result.error ?? "Could not load item details for this line");
        return;
      }
      if (!result.context) {
        toast.error("Item catalog details were not found for this variant");
        return;
      }

      onChange((current) =>
        current.map((line) => {
          if (line.key !== lineKey) return line;
          return {
            ...line,
            catalog_context: mergePoLineCatalogContext(
              line.catalog_context,
              result.context,
              fallbackImageUrl
            ),
          };
        })
      );
    },
    [onChange]
  );

  const seedOptimisticCatalogContext = useCallback(
    (
      lineKey: string,
      updatedLine: PoDraftLine,
      snapshot: { imageUrl: string | null; baseUnit: string | null }
    ) => {
      if (!snapshot.imageUrl && !snapshot.baseUnit) return;
      patchLine(lineKey, {
        catalog_context: mergePoLineCatalogContext(
          updatedLine.catalog_context,
          null,
          snapshot.imageUrl,
          snapshot.baseUnit
        ),
      });
    },
    [patchLine]
  );

  const handleVariantSelected = useCallback(
    (
      lineKey: string,
      patch: Partial<PoDraftLine>,
      updatedLine: PoDraftLine,
      isLastLine: boolean,
      nextLines: PoDraftLine[],
      patchImageUrl?: string | null,
      patchBaseUnit?: string | null
    ) => {
      const variantId = patch.variant_id!;
      const imageUrl = resolveVariantImageUrl(variantId, patchImageUrl);
      const baseUnit = resolveVariantBaseUnit(variantId, patchBaseUnit);

      void applySupplierPrice(lineKey, variantId, updatedLine.unit_price_contractual ?? "0");
      seedOptimisticCatalogContext(lineKey, updatedLine, { imageUrl, baseUnit });
      void applyCatalogContext(lineKey, variantId, imageUrl);

      const qtyIsDefaultOne = Number(updatedLine.quantity_ordered) === 1;
      if (isLastLine && qtyIsDefaultOne && variantId) {
        advanceFromLine(lineKey, nextLines);
        return;
      }

      focusQty(lineKey);
    },
    [advanceFromLine, applyCatalogContext, applySupplierPrice, focusQty, seedOptimisticCatalogContext]
  );

  type ItemChangePatch = Partial<PoDraftLine> & {
    unit_cost?: string;
    image_url?: string | null;
    base_unit_of_measure?: string | null;
  };

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: ItemChangePatch) => {
      onChange((currentLines) => {
        const currentLine = currentLines.find((row) => row.key === lineKey);
        if (!currentLine) return currentLines;

        const clearingItem = patch.variant_id === "";
        const variantChanged =
          Boolean(patch.variant_id) && patch.variant_id !== currentLine.variant_id;

        const nextLines = currentLines.map((row) => {
          if (row.key !== lineKey) return row;
          return {
            ...row,
            ...patch,
            item_id: clearingItem ? "" : patch.item_id ?? row.item_id,
            unit_price_contractual: clearingItem
              ? "0"
              : patch.unit_cost ?? row.unit_price_contractual,
            catalog_context: clearingItem ? undefined : row.catalog_context,
          };
        });

        if (variantChanged && patch.variant_id) {
          const updatedLine = nextLines.find((row) => row.key === lineKey)!;
          window.requestAnimationFrame(() => {
            handleVariantSelected(
              lineKey,
              patch,
              updatedLine,
              lineKey === currentLines.at(-1)?.key,
              nextLines,
              patch.image_url,
              patch.base_unit_of_measure
            );
          });
          return nextLines;
        }

        return ensureTrailingPoLine(nextLines);
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
