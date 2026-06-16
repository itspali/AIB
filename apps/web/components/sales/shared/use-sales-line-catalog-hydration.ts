"use client";

import { useEffect, useMemo, useRef } from "react";
import { lookupSalesLineCatalogContext } from "@/app/sales/shared/catalog-actions";
import {
  mergePoLineCatalogContext,
  needsPoLineCatalogHydration,
  type PoLineCatalogContext,
} from "@/lib/documents/catalog-line-values";
import {
  getCachedPoLineCatalogContext,
  setCachedPoLineCatalogContext,
} from "@/lib/documents/po-line-catalog-cache";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  isPoLineSavedTaxSnapshot,
  mergeSavedPoLineTaxIntoCatalog,
} from "@/lib/procurement/purchase-orders/po-line-saved-tax";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
import { applySellingCatalogToLine } from "@/lib/sales/shared/sales-line-selling-markdown";
import {
  resolveSalesLineUomAfterCatalogUpdate,
  applySalesDraftLineUomTransition,
} from "@/lib/sales/shared/sales-line-uom-options";

function applyCatalogHydration<T extends SalesCommerceLineBase>(
  line: T,
  context: PoLineCatalogContext,
  taxCodeOptions: readonly PoLineTaxCodeOption[],
  pricesTaxInclusive: boolean
): T {
  const savedSnapshot = line.catalog_context;
  const catalog_contextRaw = mergePoLineCatalogContext(savedSnapshot, context);
  if (!catalog_contextRaw) return line;

  const catalog_context =
    savedSnapshot && isPoLineSavedTaxSnapshot(savedSnapshot)
      ? mergeSavedPoLineTaxIntoCatalog(savedSnapshot, catalog_contextRaw, taxCodeOptions)
      : catalog_contextRaw;

  return applySellingCatalogToLine(
    applySalesDraftLineUomTransition(
      {
        ...line,
        catalog_context,
      },
      resolveSalesLineUomAfterCatalogUpdate(line.uom_code, catalog_context)
    ),
    catalog_context,
    pricesTaxInclusive
  );
}

function applyHydratedCatalogToLines<T extends SalesCommerceLineBase>(
  current: T[],
  variantId: string,
  context: PoLineCatalogContext,
  taxCodeOptions: readonly PoLineTaxCodeOption[],
  pricesTaxInclusive: boolean
): T[] {
  let changed = false;
  const next = current.map((line) => {
    if (line.variant_id !== variantId || !needsPoLineCatalogHydration(line.catalog_context)) {
      return line;
    }
    changed = true;
    return applyCatalogHydration(line, context, taxCodeOptions, pricesTaxInclusive);
  });
  return changed ? next : current;
}

/** Loads read-only catalog snapshots for existing sales lines (e.g. when opening a saved document). */
export function useSalesLineCatalogHydration<T extends SalesCommerceLineBase>(
  lines: T[],
  onChange: (lines: T[] | ((current: T[]) => T[])) => void,
  taxCodeOptions: readonly PoLineTaxCodeOption[] = [],
  pricesTaxInclusive = false
) {
  const inflightRef = useRef(new Set<string>());
  const onChangeRef = useRef(onChange);
  const taxCodeOptionsRef = useRef(taxCodeOptions);
  const pricesTaxInclusiveRef = useRef(pricesTaxInclusive);

  onChangeRef.current = onChange;
  taxCodeOptionsRef.current = taxCodeOptions;
  pricesTaxInclusiveRef.current = pricesTaxInclusive;

  const variantIdsNeedingHydration = useMemo(
    () => [
      ...new Set(
        lines
          .filter(
            (line) => line.variant_id && needsPoLineCatalogHydration(line.catalog_context)
          )
          .map((line) => line.variant_id)
      ),
    ],
    [lines]
  );

  const hydrationKey = variantIdsNeedingHydration.join("|");

  useEffect(() => {
    if (!hydrationKey) return;

    const variantIds = hydrationKey.split("|");

    for (const variantId of variantIds) {
      if (inflightRef.current.has(variantId)) continue;

      const cached = getCachedPoLineCatalogContext(variantId);
      if (cached) {
        onChangeRef.current((current) =>
          applyHydratedCatalogToLines(
            current,
            variantId,
            cached,
            taxCodeOptionsRef.current,
            pricesTaxInclusiveRef.current
          )
        );
        continue;
      }

      inflightRef.current.add(variantId);

      void lookupSalesLineCatalogContext({ variant_id: variantId }).then((result) => {
        if ("error" in result) {
          inflightRef.current.delete(variantId);
          return;
        }

        if (result.context) {
          setCachedPoLineCatalogContext(variantId, result.context);
        }

        inflightRef.current.delete(variantId);

        if (!result.context) return;

        onChangeRef.current((current) =>
          applyHydratedCatalogToLines(
            current,
            variantId,
            result.context,
            taxCodeOptionsRef.current,
            pricesTaxInclusiveRef.current
          )
        );
      });
    }
  }, [hydrationKey]);
}
