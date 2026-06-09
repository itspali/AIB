"use client";

import { useEffect, useRef } from "react";
import { lookupPoLineCatalogContext } from "@/app/procurement/purchase-orders/actions";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

/** Loads read-only catalog snapshots for existing lines (e.g. when opening a saved PO). */
export function usePoLineCatalogHydration(
  lines: PoDraftLine[],
  onChange: (lines: PoDraftLine[] | ((current: PoDraftLine[]) => PoDraftLine[])) => void
) {
  const inflightRef = useRef(new Set<string>());

  useEffect(() => {
    const variantIds = [
      ...new Set(
        lines
          .filter((line) => line.variant_id && line.catalog_context === undefined)
          .map((line) => line.variant_id)
      ),
    ];

    for (const variantId of variantIds) {
      if (inflightRef.current.has(variantId)) continue;
      inflightRef.current.add(variantId);

      void lookupPoLineCatalogContext({ variant_id: variantId }).then((result) => {
        inflightRef.current.delete(variantId);
        if ("error" in result) return;

        onChange((current) =>
          current.map((line) =>
            line.variant_id === variantId && line.catalog_context === undefined
              ? { ...line, catalog_context: result.context }
              : line
          )
        );
      });
    }
  }, [lines, onChange]);
}
