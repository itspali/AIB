"use client";

import { useEffect, useRef } from "react";
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
import { resolveSalesLineUomAfterCatalogUpdate, applySalesDraftLineUomTransition } from "@/lib/sales/shared/sales-line-uom-options";

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

/** Loads read-only catalog snapshots for existing sales lines (e.g. when opening a saved document). */
export function useSalesLineCatalogHydration<T extends SalesCommerceLineBase>(
  lines: T[],
  onChange: (lines: T[] | ((current: T[]) => T[])) => void,
  taxCodeOptions: readonly PoLineTaxCodeOption[] = [],
  pricesTaxInclusive = false
) {
  const inflightRef = useRef(new Set<string>());

  useEffect(() => {
    const variantIds = [
      ...new Set(
        lines
          .filter(
            (line) => line.variant_id && needsPoLineCatalogHydration(line.catalog_context)
          )
          .map((line) => line.variant_id)
      ),
    ];

    for (const variantId of variantIds) {
      if (inflightRef.current.has(variantId)) continue;

      const cached = getCachedPoLineCatalogContext(variantId);
      if (cached) {
        onChange((current) =>
          current.map((line) =>
            line.variant_id === variantId &&
            needsPoLineCatalogHydration(line.catalog_context)
              ? applyCatalogHydration(line, cached, taxCodeOptions, pricesTaxInclusive)
              : line
          )
        );
        continue;
      }

      inflightRef.current.add(variantId);

      void lookupSalesLineCatalogContext({ variant_id: variantId }).then((result) => {
        inflightRef.current.delete(variantId);
        if ("error" in result) return;
        if (result.context) {
          setCachedPoLineCatalogContext(variantId, result.context);
        }

        onChange((current) =>
          current.map((line) =>
            line.variant_id === variantId &&
            needsPoLineCatalogHydration(line.catalog_context) &&
            result.context
              ? applyCatalogHydration(line, result.context, taxCodeOptions, pricesTaxInclusive)
              : line
          )
        );
      });
    }
  }, [lines, onChange, taxCodeOptions, pricesTaxInclusive]);
}
