"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  lookupPoLineCatalogContext,
  lookupSupplierVariantPrice,
} from "@/app/procurement/purchase-orders/actions";
import {
  createOptimisticPoLineCatalogContextFromPicker,
  mergePoLineCatalogContext,
} from "@/lib/documents/catalog-line-values";
import {
  getCachedPoLineCatalogContext,
  loadPoLineCatalogContext,
  setCachedPoLineCatalogContext,
} from "@/lib/documents/po-line-catalog-cache";
import {
  getCachedVariantBaseUnit,
  getCachedVariantImageUrl,
} from "@/lib/inventory/stock/variant-suggestion-cache";
import {
  createEmptyPoLine,
  ensureEntryPoLine,
  isPoEntryLineKey,
  isPoLineBlank,
  isPoLineComplete,
  movePoDraftLine,
  type PoDraftLine,
} from "@/lib/procurement/purchase-orders/draft-form";
import type { PoLineEntryAnchor } from "@/lib/procurement/purchase-orders/line-entry-anchor";
import {
  resolveDefaultPoLineUomCode,
  resolvePoLineUomAfterCatalogUpdate,
  applyPoDraftLineUomTransition,
  scalePoCatalogBaseUnitPriceToLineUom,
} from "@/lib/procurement/purchase-orders/po-line-uom-options";
import { syncPoLineMrpMarkdownFromOfferPrice } from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import {
  resolvePoLineOfferUnitPrice,
  resolvePoLinePickerOfferUnitPrice,
} from "@/lib/procurement/purchase-orders/supplier-price";
import {
  attachSupplierPriceSnapshot,
  attachWritebackSnapshotFromCatalog,
} from "@/lib/procurement/purchase-orders/po-line-writeback-snapshot";

function applyMrpMarkdownSync(line: PoDraftLine): PoDraftLine {
  const sync = syncPoLineMrpMarkdownFromOfferPrice(line);
  return sync ? { ...line, ...sync } : line;
}

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

type ItemChangePatch = Partial<PoDraftLine> & {
  unit_cost?: string;
  purchase_price?: string | null;
  image_url?: string | null;
  base_unit_of_measure?: string | null;
  description?: string | null;
  hsn_sac_code?: string | null;
  mrp?: string | null;
  variant_attributes?: Record<string, string>;
  custom_fields?: Record<string, string>;
};

function buildOptimisticCatalogContext(
  variantId: string,
  patch: ItemChangePatch
): PoDraftLine["catalog_context"] {
  return createOptimisticPoLineCatalogContextFromPicker({
    image_url: resolveVariantImageUrl(variantId, patch.image_url),
    base_unit_of_measure: resolveVariantBaseUnit(variantId, patch.base_unit_of_measure),
    description: patch.description,
    hsn_sac_code: patch.hsn_sac_code,
    mrp: patch.mrp,
    variant_attributes: patch.variant_attributes,
    custom_fields: patch.custom_fields,
  });
}

export function usePoLineEntryActions(
  lines: PoDraftLine[],
  supplierId: string,
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void,
  entryAnchor: PoLineEntryAnchor = "bottom"
) {
  const itemRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const priceRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<PoDraftLine>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        return ensureEntryPoLine(next, entryAnchor);
      });
    },
    [entryAnchor, onChange]
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

        const onEntryEdge =
          entryAnchor === "top" ? lineIndex === 0 : lineIndex === currentLines.length - 1;
        const withEntryRow = onEntryEdge
          ? ensureEntryPoLine(currentLines, entryAnchor)
          : currentLines;

        const focusKey =
          entryAnchor === "top"
            ? withEntryRow[0]?.key ?? null
            : withEntryRow[lineIndex + 1]?.key ?? null;

        return {
          lines: withEntryRow,
          focusKey,
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
    [entryAnchor, focusItem, onChange]
  );

  const removeLine = useCallback(
    (key: string) => {
      onChange((current) => {
        if (current.length <= 1) return [createEmptyPoLine()];
        const next = current.filter((line) => line.key !== key);
        return ensureEntryPoLine(next, entryAnchor);
      });
    },
    [entryAnchor, onChange]
  );

  const reorderLine = useCallback(
    (
      fromKey: string,
      toKey: string,
      position: "before" | "after" = "before"
    ) => {
      onChange((current) =>
        movePoDraftLine(current, fromKey, toKey, entryAnchor, position)
      );
    },
    [entryAnchor, onChange]
  );

  const duplicateLine = useCallback(
    (key: string) => {
      onChange((current) => {
        const index = current.findIndex((line) => line.key === key);
        if (index === -1) return current;
        const source = current[index]!;
        if (!source.variant_id) return current;

        const clone: PoDraftLine = {
          ...source,
          key: crypto.randomUUID(),
          skuError: null,
        };
        const next = [...current.slice(0, index + 1), clone, ...current.slice(index + 1)];
        return ensureEntryPoLine(next, entryAnchor);
      });
    },
    [entryAnchor, onChange]
  );

  const applySupplierPrice = useCallback(
    async (lineKey: string, variantId: string, fallbackCost: string) => {
      if (!supplierId || !variantId) return;
      const result = await lookupSupplierVariantPrice({
        supplier_id: supplierId,
        variant_id: variantId,
      });
      if ("error" in result) return;
      const nextPrice = resolvePoLineOfferUnitPrice(result.unit_price, fallbackCost);
      onChange((current) =>
        current.map((line) => {
          if (line.key !== lineKey) return line;
          return applyMrpMarkdownSync(
            attachSupplierPriceSnapshot(
              {
                ...line,
                unit_price_contractual: scalePoCatalogBaseUnitPriceToLineUom(nextPrice || "0", line),
              },
              result.unit_price
            )
          );
        })
      );
    },
    [onChange, supplierId]
  );

  const applyCatalogContext = useCallback(
    async (lineKey: string, variantId: string, fallbackImageUrl?: string | null) => {
      if (!variantId) return;

      const applyContext = (context: NonNullable<PoDraftLine["catalog_context"]>) => {
        onChange((current) =>
          current.map((line) => {
            if (line.key !== lineKey) return line;
            const catalog_context = mergePoLineCatalogContext(
              line.catalog_context,
              context,
              fallbackImageUrl
            );
            if (!catalog_context) return line;
            const uom_code = resolvePoLineUomAfterCatalogUpdate(line.uom_code, catalog_context);
            return applyMrpMarkdownSync(
              attachWritebackSnapshotFromCatalog(
                applyPoDraftLineUomTransition({ ...line, catalog_context }, uom_code),
                catalog_context
              )
            );
          })
        );
      };

      const cached = getCachedPoLineCatalogContext(variantId);
      if (cached) {
        applyContext(cached);
        return;
      }

      const inflight = await loadPoLineCatalogContext(variantId);
      if (inflight) {
        applyContext(inflight);
        return;
      }

      const result = await lookupPoLineCatalogContext({ variant_id: variantId });
      if ("error" in result) {
        toast.error(result.error ?? "Could not load item details for this line");
        return;
      }
      if (!result.context) {
        toast.error("Item catalog details were not found for this variant");
        return;
      }

      setCachedPoLineCatalogContext(variantId, result.context);
      applyContext(result.context);
    },
    [onChange]
  );

  const handleVariantSelected = useCallback(
    (
      lineKey: string,
      patch: ItemChangePatch,
      updatedLine: PoDraftLine,
      nextLines: PoDraftLine[],
      patchImageUrl?: string | null
    ) => {
      const variantId = patch.variant_id!;
      const imageUrl = resolveVariantImageUrl(variantId, patchImageUrl ?? patch.image_url);
      const isEntryLine = isPoEntryLineKey(lineKey, nextLines, entryAnchor);

      void applySupplierPrice(
        lineKey,
        variantId,
        updatedLine.unit_price_contractual ?? "0"
      );
      void applyCatalogContext(lineKey, variantId, imageUrl);

      const qtyIsDefaultOne = Number(updatedLine.quantity_ordered) === 1;
      window.requestAnimationFrame(() => {
        if (isEntryLine && qtyIsDefaultOne && variantId) {
          advanceFromLine(lineKey, nextLines);
          return;
        }
        focusQty(lineKey);
      });
    },
    [advanceFromLine, applyCatalogContext, applySupplierPrice, entryAnchor, focusQty]
  );

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: ItemChangePatch) => {
      const currentLine = lines.find((row) => row.key === lineKey);
      if (!currentLine) return;

      const clearingItem = patch.variant_id === "";
      const variantChanged =
        Boolean(patch.variant_id) && patch.variant_id !== currentLine.variant_id;

      const nextLines = lines.map((row) => {
        if (row.key !== lineKey) return row;
        const optimisticContext =
          variantChanged && patch.variant_id
            ? buildOptimisticCatalogContext(patch.variant_id, patch)
            : null;
        const defaultUom = clearingItem
          ? undefined
          : variantChanged
            ? resolveDefaultPoLineUomCode(optimisticContext)
            : row.uom_code;
        const baseOfferPrice = clearingItem
          ? "0"
          : resolvePoLinePickerOfferUnitPrice(patch.purchase_price);
        const draft: PoDraftLine = {
          ...row,
          ...patch,
          item_id: clearingItem ? "" : patch.item_id ?? row.item_id,
          unit_price_contractual:
            clearingItem || !variantChanged
              ? baseOfferPrice
              : scalePoCatalogBaseUnitPriceToLineUom(baseOfferPrice, {
                  catalog_context: optimisticContext,
                  uom_code: defaultUom,
                }),
          catalog_context: clearingItem
            ? undefined
            : optimisticContext ?? row.catalog_context,
          uom_code: defaultUom,
        };
        return variantChanged && patch.variant_id && !clearingItem
          ? applyMrpMarkdownSync(draft)
          : draft;
      });

      if (variantChanged && patch.variant_id) {
        const updatedLine = nextLines.find((row) => row.key === lineKey)!;
        const linesWithEntryRow = ensureEntryPoLine(nextLines, entryAnchor);
        onChange(linesWithEntryRow);
        handleVariantSelected(lineKey, patch, updatedLine, linesWithEntryRow, patch.image_url);
        return;
      }

      onChange(ensureEntryPoLine(nextLines, entryAnchor));
    },
    [entryAnchor, handleVariantSelected, lines, onChange]
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
    reorderLine,
    duplicateLine,
    bindItemChange,
  };
}

export function canReorderPoDraftLine(line: PoDraftLine): boolean {
  return !isPoLineBlank(line);
}

export function isEnterKey(key: string): boolean {
  return key === "Enter" || key === "NumpadEnter";
}
