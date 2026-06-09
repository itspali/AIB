"use client";

import { lookupPoLineCatalogContext } from "@/app/procurement/purchase-orders/actions";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";

const catalogByVariantId = new Map<string, PoLineCatalogContext>();
const inflightByVariantId = new Map<string, Promise<PoLineCatalogContext | null>>();

export function getCachedPoLineCatalogContext(
  variantId: string
): PoLineCatalogContext | null {
  if (!variantId) return null;
  return catalogByVariantId.get(variantId) ?? null;
}

export function setCachedPoLineCatalogContext(
  variantId: string,
  context: PoLineCatalogContext | null | undefined
): void {
  if (!variantId || !context || context.catalog_snapshot_source !== "server") return;
  catalogByVariantId.set(variantId, context);
}

/** Warm the server catalog snapshot before the user confirms a picker row. */
export function prefetchPoLineCatalogContext(variantId: string): void {
  if (!variantId || catalogByVariantId.has(variantId) || inflightByVariantId.has(variantId)) {
    return;
  }

  const promise = lookupPoLineCatalogContext({ variant_id: variantId }).then((result) => {
    inflightByVariantId.delete(variantId);
    if ("error" in result || !result.context) return null;
    catalogByVariantId.set(variantId, result.context);
    return result.context;
  });

  inflightByVariantId.set(variantId, promise);
}

export async function loadPoLineCatalogContext(
  variantId: string
): Promise<PoLineCatalogContext | null> {
  const cached = getCachedPoLineCatalogContext(variantId);
  if (cached) return cached;

  const inflight = inflightByVariantId.get(variantId);
  if (inflight) return inflight;

  return null;
}
