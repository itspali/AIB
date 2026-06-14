"use client";

import { useEffect, useRef } from "react";
import { lookupPoLineCatalogContext } from "@/app/procurement/purchase-orders/actions";
import {
  mergePoLineCatalogContext,
  needsPoLineCatalogHydration,
} from "@/lib/documents/catalog-line-values";
import {
  getCachedPoLineCatalogContext,
  setCachedPoLineCatalogContext,
} from "@/lib/documents/po-line-catalog-cache";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { syncPoLineMrpMarkdownFromOfferPrice } from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  isPoLineSavedTaxSnapshot,
  mergeSavedPoLineTaxIntoCatalog,
} from "@/lib/procurement/purchase-orders/po-line-saved-tax";
import { resolvePoLineUomAfterCatalogUpdate } from "@/lib/procurement/purchase-orders/po-line-uom-options";

function withMrpMarkdownSync(line: PoDraftLine): PoDraftLine {
  const sync = syncPoLineMrpMarkdownFromOfferPrice(line);
  return sync ? { ...line, ...sync } : line;
}

function applyCatalogHydration(
  line: PoDraftLine,
  context: PoLineCatalogContext,
  taxCodeOptions: readonly PoLineTaxCodeOption[]
): PoDraftLine {
  const savedSnapshot = line.catalog_context;
  const catalog_contextRaw = mergePoLineCatalogContext(savedSnapshot, context);
  if (!catalog_contextRaw) return line;

  const catalog_context =
    savedSnapshot && isPoLineSavedTaxSnapshot(savedSnapshot)
      ? mergeSavedPoLineTaxIntoCatalog(savedSnapshot, catalog_contextRaw, taxCodeOptions)
      : catalog_contextRaw;

  return withMrpMarkdownSync({
    ...line,
    catalog_context,
    uom_code: resolvePoLineUomAfterCatalogUpdate(line.uom_code, catalog_context),
  });
}

/** Loads read-only catalog snapshots for existing lines (e.g. when opening a saved PO). */
export function usePoLineCatalogHydration(
  lines: PoDraftLine[],
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void,
  taxCodeOptions: readonly PoLineTaxCodeOption[] = []
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
              ? applyCatalogHydration(line, cached, taxCodeOptions)
              : line
          )
        );
        continue;
      }

      inflightRef.current.add(variantId);

      void lookupPoLineCatalogContext({ variant_id: variantId }).then((result) => {
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
              ? applyCatalogHydration(line, result.context, taxCodeOptions)
              : line
          )
        );
      });
    }
  }, [lines, onChange, taxCodeOptions]);
}
