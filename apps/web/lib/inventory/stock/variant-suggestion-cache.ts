"use client";

import { listStockVariantsForAdjustmentBrowse } from "@/app/inventory/stock/actions";
import type { StockVariantOption } from "@/lib/inventory/stock/types";
import { filterStockVariantSuggestions } from "@/lib/inventory/stock/variant-suggestion-filter";

export { filterStockVariantSuggestions };

const BROWSE_TTL_MS = 60_000;

let browseVariants: StockVariantOption[] | null = null;
let browseFetchedAt = 0;
let browsePromise: Promise<StockVariantOption[] | null> | null = null;

export function getCachedBrowseVariants(): StockVariantOption[] | null {
  if (!browseVariants) return null;
  if (Date.now() - browseFetchedAt > BROWSE_TTL_MS) {
    browseVariants = null;
    return null;
  }
  return browseVariants;
}

export async function loadBrowseVariants(options?: {
  force?: boolean;
}): Promise<StockVariantOption[] | null> {
  if (!options?.force) {
    const cached = getCachedBrowseVariants();
    if (cached) return cached;
  }

  if (browsePromise) return browsePromise;

  browsePromise = (async () => {
    try {
      const result = await listStockVariantsForAdjustmentBrowse();
      if ("error" in result) return null;
      browseVariants = result.variants;
      browseFetchedAt = Date.now();
      return browseVariants;
    } finally {
      browsePromise = null;
    }
  })();

  return browsePromise;
}

export function prefetchBrowseVariants(): void {
  void loadBrowseVariants();
}
