"use client";

import { useCallback, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import {
  buildLineStockContextSnapshot,
  getLineStockContextCacheVersion,
  prefetchLineStockContexts,
  subscribeLineStockContextCache,
  type LineStockContextPrefetchOptions,
} from "@/lib/inventory/stock/line-stock-context-cache";
import type { DocumentLineStockContext } from "@/lib/inventory/stock/line-stock-context";

/** Resolves on-hand stock at a document location for line item hints. */
export function useLineStockContext(
  locationId: string,
  variantIds: string[],
  options?: LineStockContextPrefetchOptions
): (variantId: string) => DocumentLineStockContext | null {
  const normalizedLocation = locationId.trim();
  const scope = options?.scope ?? "full";
  const uniqueVariantIds = useMemo(
    () => [...new Set(variantIds.map((id) => id.trim()).filter(Boolean))],
    [variantIds]
  );
  const variantKey = uniqueVariantIds.join("\u0000");

  useLayoutEffect(() => {
    prefetchLineStockContexts(normalizedLocation, uniqueVariantIds, { scope });
  }, [normalizedLocation, scope, variantKey, uniqueVariantIds]);

  const cacheVersion = useSyncExternalStore(
    subscribeLineStockContextCache,
    getLineStockContextCacheVersion,
    getLineStockContextCacheVersion
  );

  const stockByVariant = useMemo(
    () => buildLineStockContextSnapshot(normalizedLocation, uniqueVariantIds),
    [cacheVersion, normalizedLocation, variantKey, uniqueVariantIds]
  );

  return useCallback(
    (variantId: string) => {
      const id = variantId.trim();
      if (!id || !normalizedLocation) return null;
      return stockByVariant[id] ?? null;
    },
    [normalizedLocation, stockByVariant]
  );
}
