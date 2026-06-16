"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { lookupSalesLineCatalogContext } from "@/app/sales/shared/catalog-actions";
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
import type { StockLineSkuSelection } from "@/components/inventory/stock/stock-variant-sku-field";
import {
  ensureTrailingSalesCommerceLine,
  isSalesCommerceLineBlank,
  isSalesCommerceLineComplete,
  moveSalesCommerceDraftLine,
  normalizeSalesCommerceLinesForAnchor,
  salesCommerceLinesNeedAnchorNormalization,
  type SalesCommerceLineBase,
} from "@/lib/sales/shared/sales-line-entry";
import { resolveSalesLinePickerOfferUnitPrice } from "@/lib/sales/shared/sales-line-offer-price";
import { applySellingCatalogToLine } from "@/lib/sales/shared/sales-line-selling-markdown";
import {
  resolveSalesLineUomAfterCatalogUpdate,
  applySalesDraftLineUomTransition,
  scaleSalesCatalogBaseUnitPriceToLineUom,
} from "@/lib/sales/shared/sales-line-uom-options";
import {
  readPoLineEntryAnchor,
  writePoLineEntryAnchor,
  type PoLineEntryAnchor,
} from "@/lib/procurement/purchase-orders/line-entry-anchor";

function focusInput(input: HTMLInputElement | HTMLTextAreaElement | null | undefined) {
  if (!input) return;
  window.requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

type ItemChangePatch = Partial<StockLineSkuSelection>;

function resolveVariantImageUrl(variantId: string, imageUrl?: string | null): string | null {
  return imageUrl?.trim() || getCachedVariantImageUrl(variantId) || null;
}

function resolveVariantBaseUnit(variantId: string, baseUnit?: string | null): string | null {
  return baseUnit?.trim() || getCachedVariantBaseUnit(variantId) || null;
}

function buildOptimisticCatalogContext(variantId: string, patch: ItemChangePatch) {
  return createOptimisticPoLineCatalogContextFromPicker({
    image_url: resolveVariantImageUrl(variantId, patch.image_url),
    base_unit_of_measure: resolveVariantBaseUnit(variantId, patch.base_unit_of_measure),
    description: patch.description,
    hsn_sac_code: patch.hsn_sac_code,
    mrp: patch.mrp,
    selling_price: patch.selling_price,
    tax_code_id: patch.tax_code_id,
    tax_rate: patch.tax_rate,
    tax_is_variable: patch.tax_is_variable,
    variant_attributes: patch.variant_attributes,
    custom_fields: patch.custom_fields,
    alternate_uoms: patch.alternate_uoms,
  });
}

export function useSalesLineEntryActions<T extends SalesCommerceLineBase>(
  lines: T[],
  onChange: (lines: T[] | ((current: T[]) => T[])) => void,
  entryAnchor: PoLineEntryAnchor,
  options: {
    createLine: () => T;
    getQuantity: (line: T) => string;
    setQuantity: (line: T, value: string) => T;
    duplicateLine: (line: T) => T;
    pricesTaxInclusive?: boolean;
  }
) {
  const pricesTaxInclusive = options.pricesTaxInclusive ?? false;
  const itemRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const priceRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});

  const patchLine = useCallback(
    (key: string, patch: Partial<T>) => {
      onChange((current) => {
        const next = current.map((line) => (line.key === key ? { ...line, ...patch } : line));
        return ensureTrailingSalesCommerceLine(next, options.createLine, options.getQuantity);
      });
    },
    [onChange, options]
  );

  const focusItem = useCallback((lineKey: string) => {
    focusInput(itemRefs.current[lineKey]);
  }, []);

  const focusPrice = useCallback((lineKey: string) => {
    focusInput(priceRefs.current[lineKey]);
  }, []);

  const advanceFromLine = useCallback(
    (lineKey: string) => {
      onChange((currentLines) => {
        const lineIndex = currentLines.findIndex((row) => row.key === lineKey);
        if (lineIndex === -1) return currentLines;

        const line = currentLines[lineIndex]!;
        if (!isSalesCommerceLineComplete({ ...line, quantity: options.getQuantity(line) })) {
          return currentLines;
        }

        const onEntryEdge =
          entryAnchor === "top" ? lineIndex === 0 : lineIndex === currentLines.length - 1;
        const withEntryRow = onEntryEdge
          ? ensureTrailingSalesCommerceLine(currentLines, options.createLine, options.getQuantity)
          : currentLines;

        const focusKey =
          entryAnchor === "top"
            ? (withEntryRow[0]?.key ?? null)
            : (withEntryRow[lineIndex + 1]?.key ?? null);

        if (focusKey) focusItem(focusKey);
        return withEntryRow;
      });
    },
    [entryAnchor, focusItem, onChange, options]
  );

  const applyCatalogContext = useCallback(
    async (lineKey: string, variantId: string, fallbackImageUrl?: string | null) => {
      if (!variantId) return;

      const applyContext = (context: NonNullable<T["catalog_context"]>) => {
        onChange((current) =>
          current.map((line) => {
            if (line.key !== lineKey) return line;
            const catalog_context = mergePoLineCatalogContext(
              line.catalog_context,
              context,
              fallbackImageUrl
            );
            if (!catalog_context) return line;
            const uom_code = resolveSalesLineUomAfterCatalogUpdate(line.uom_code, catalog_context);
            return applySellingCatalogToLine(
              applySalesDraftLineUomTransition({ ...line, catalog_context }, uom_code),
              catalog_context,
              pricesTaxInclusive
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

      const result = await lookupSalesLineCatalogContext({ variant_id: variantId });
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
    [onChange, pricesTaxInclusive]
  );

  const bindItemChange = useCallback(
    (lineKey: string) => (patch: ItemChangePatch) => {
      const currentLine = lines.find((row) => row.key === lineKey);
      if (!currentLine) return;

      const clearingItem = patch.variant_id === "";
      const variantChanged =
        Boolean(patch.variant_id) && patch.variant_id !== currentLine.variant_id;

      const { unit_cost: _unitCost, image_url, base_unit_of_measure, ...rest } = patch;
      const variantId = rest.variant_id?.trim() || "";
      const resolvedImageUrl = variantId
        ? resolveVariantImageUrl(variantId, image_url)
        : null;
      const resolvedBaseUnit = variantId
        ? resolveVariantBaseUnit(variantId, base_unit_of_measure)
        : null;
      const offerPrice = patch.selling_price?.trim()
        ? resolveSalesLinePickerOfferUnitPrice(patch.selling_price)
        : null;
      const optimisticContext =
        variantChanged && variantId ? buildOptimisticCatalogContext(variantId, patch) : null;
      const cachedCatalog =
        variantChanged && variantId ? getCachedPoLineCatalogContext(variantId) : null;
      const initialCatalogContext = cachedCatalog
        ? mergePoLineCatalogContext(optimisticContext, cachedCatalog, resolvedImageUrl)
        : optimisticContext;
      const usedServerCatalog = Boolean(
        initialCatalogContext?.catalog_snapshot_source === "server"
      );
      const defaultUom =
        variantChanged && variantId && !clearingItem
          ? resolveSalesLineUomAfterCatalogUpdate(undefined, initialCatalogContext)
          : undefined;
      const scaledOfferPrice =
        offerPrice && defaultUom
          ? scaleSalesCatalogBaseUnitPriceToLineUom(offerPrice, {
              catalog_context: initialCatalogContext,
              uom_code: defaultUom,
            })
          : offerPrice;

      const basePatch = {
        ...rest,
        ...(clearingItem
          ? {
              item_id: "",
              catalog_context: undefined,
              selling_markdown_percentage: undefined,
              uom_code: undefined,
            }
          : {}),
        image_url: resolvedImageUrl,
        base_unit_of_measure: resolvedBaseUnit,
      } as Partial<T>;

      if (variantChanged && variantId && !clearingItem && initialCatalogContext) {
        const draftLine = {
          ...currentLine,
          ...basePatch,
          catalog_context: initialCatalogContext,
          ...(defaultUom ? { uom_code: defaultUom } : {}),
          ...(scaledOfferPrice ? { unit_price_selling: scaledOfferPrice } : {}),
        } as T;
        const hydrated = applySellingCatalogToLine(
          applySalesDraftLineUomTransition(
            draftLine,
            defaultUom ?? draftLine.uom_code
          ),
          initialCatalogContext,
          pricesTaxInclusive
        );
        patchLine(lineKey, {
          ...basePatch,
          catalog_context: hydrated.catalog_context,
          uom_code: hydrated.uom_code,
          unit_price_selling: scaledOfferPrice ?? hydrated.unit_price_selling,
          selling_markdown_percentage: hydrated.selling_markdown_percentage,
        } as Partial<T>);
      } else {
        patchLine(lineKey, {
          ...basePatch,
          ...(scaledOfferPrice ? { unit_price_selling: scaledOfferPrice } : {}),
          ...(initialCatalogContext ? { catalog_context: initialCatalogContext } : {}),
          ...(defaultUom ? { uom_code: defaultUom } : {}),
        } as Partial<T>);
      }

      if (variantChanged && variantId && !usedServerCatalog) {
        void applyCatalogContext(lineKey, variantId, resolvedImageUrl);
      }
    },
    [applyCatalogContext, lines, patchLine, pricesTaxInclusive]
  );

  const removeLine = useCallback(
    (key: string) => {
      onChange((current) => {
        const next = current.filter((line) => line.key !== key);
        return ensureTrailingSalesCommerceLine(
          next.length > 0 ? next : [options.createLine()],
          options.createLine,
          options.getQuantity
        );
      });
    },
    [onChange, options]
  );

  const duplicateLine = useCallback(
    (key: string) => {
      onChange((current) => {
        const source = current.find((line) => line.key === key);
        if (!source?.variant_id) return current;
        const duplicate = options.duplicateLine(source);
        const index = current.findIndex((line) => line.key === key);
        const next = [...current];
        next.splice(index + 1, 0, duplicate);
        return ensureTrailingSalesCommerceLine(next, options.createLine, options.getQuantity);
      });
    },
    [onChange, options]
  );

  const reorderLine = useCallback(
    (fromKey: string, toKey: string, position: "before" | "after") => {
      onChange((current) => moveSalesCommerceDraftLine(current, fromKey, toKey, position));
    },
    [onChange]
  );

  return {
    itemRefs,
    qtyRefs,
    priceRefs,
    patchLine,
    bindItemChange,
    focusPrice,
    advanceFromLine,
    removeLine,
    duplicateLine,
    reorderLine,
  };
}

export function useSalesLineEntryAnchor<T extends SalesCommerceLineBase>(
  lines: T[],
  onChange: (lines: T[] | ((current: T[]) => T[])) => void,
  options: {
    createLine: () => T;
    enabled?: boolean;
  }
) {
  const enabled = options.enabled ?? true;
  const [entryAnchor, setEntryAnchor] = useState<PoLineEntryAnchor>("bottom");

  useEffect(() => {
    setEntryAnchor(readPoLineEntryAnchor());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!salesCommerceLinesNeedAnchorNormalization(lines, entryAnchor)) return;
    const normalized = normalizeSalesCommerceLinesForAnchor(lines, entryAnchor, options.createLine);
    const sameLineKeys =
      normalized.length === lines.length &&
      normalized.every((line, index) => line.key === lines[index]?.key);
    if (sameLineKeys) return;
    onChange(normalized);
  }, [enabled, entryAnchor, lines, onChange, options.createLine]);

  const handleEntryAnchorChange = useCallback(
    (anchor: PoLineEntryAnchor) => {
      setEntryAnchor(anchor);
      writePoLineEntryAnchor(anchor);
      onChange((current) => normalizeSalesCommerceLinesForAnchor(current, anchor, options.createLine));
    },
    [onChange, options.createLine]
  );

  return { entryAnchor, handleEntryAnchorChange };
}

export function canReorderSalesCommerceLine(line: SalesCommerceLineBase & { quantity?: string }): boolean {
  return Boolean(line.variant_id);
}

export function canDuplicateSalesCommerceLine(line: SalesCommerceLineBase): boolean {
  return Boolean(line.variant_id);
}

export function canRemoveSalesCommerceLine<T extends SalesCommerceLineBase>(
  line: T,
  allLines: T[],
  getQuantity: (line: T) => string
): boolean {
  if (allLines.length <= 1) return false;
  return !isSalesCommerceLineBlank(line) || isSalesCommerceLineComplete({ ...line, quantity: getQuantity(line) });
}
