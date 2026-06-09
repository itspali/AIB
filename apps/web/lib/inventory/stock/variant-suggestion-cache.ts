"use client";

import { listStockVariantsForAdjustmentBrowse } from "@/app/inventory/stock/actions";
import type { StockVariantOption } from "@/lib/inventory/stock/types";
import { filterStockVariantSuggestions } from "@/lib/inventory/stock/variant-suggestion-filter";

export { filterStockVariantSuggestions };

const BROWSE_TTL_MS = 60_000;

let browseVariants: StockVariantOption[] | null = null;
let browseFetchedAt = 0;
let browsePromise: Promise<StockVariantOption[] | null> | null = null;
const variantImageById = new Map<string, string>();
const variantBaseUnitById = new Map<string, string>();

export function registerVariantSuggestions(options: readonly StockVariantOption[]): void {
  for (const option of options) {
    if (option.image_url) {
      variantImageById.set(option.variant_id, option.image_url);
    }
    if (option.base_unit_of_measure?.trim()) {
      variantBaseUnitById.set(option.variant_id, option.base_unit_of_measure.trim());
    }
  }
}

/** @deprecated Use registerVariantSuggestions */
export function registerVariantSuggestionImages(options: readonly StockVariantOption[]): void {
  registerVariantSuggestions(options);
}

export function getCachedVariantImageUrl(variantId: string): string | null {
  if (!variantId) return null;
  const fromBrowse = getCachedBrowseVariants()?.find((row) => row.variant_id === variantId);
  if (fromBrowse?.image_url) return fromBrowse.image_url;
  return variantImageById.get(variantId) ?? null;
}

export function getCachedVariantBaseUnit(variantId: string): string | null {
  if (!variantId) return null;
  const fromBrowse = getCachedBrowseVariants()?.find((row) => row.variant_id === variantId);
  if (fromBrowse?.base_unit_of_measure?.trim()) {
    return fromBrowse.base_unit_of_measure.trim();
  }
  return variantBaseUnitById.get(variantId) ?? null;
}

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
      registerVariantSuggestions(browseVariants);
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
