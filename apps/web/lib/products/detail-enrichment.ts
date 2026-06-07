import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";

/** Join storefront channel labels from catalog context (avoids embed in detail query). */
export function enrichProductDetailSnapshot(
  detail: ProductDetailSnapshot,
  catalogContext: ProductCatalogContext
): ProductDetailSnapshot {
  const storefrontById = new Map(catalogContext.storefronts.map((row) => [row.id, row]));

  return {
    ...detail,
    storefront_visibility: detail.storefront_visibility.map((row) => {
      const channel = storefrontById.get(row.storefront_id);
      if (!channel) return row;
      return {
        ...row,
        storefront_name: channel.name,
        channel_type: channel.channel_type,
      };
    }),
  };
}

/** Item-level peek cache can be re-used when only the focused variant changes. */
export function resolvePeekVariantFocus(
  detail: ProductDetailSnapshot,
  variantId?: string | null
): string | null {
  const preferred = variantId?.trim() || null;
  if (preferred) return preferred;

  const master = detail.variants.find((row) => row.is_master);
  if (master) return master.id;

  const sellable = detail.variants.find((row) => row.is_sellable !== false);
  if (sellable) return sellable.id;

  return detail.variants[0]?.id ?? detail.variant_id ?? null;
}

export function reanchorProductDetailVariant(
  detail: ProductDetailSnapshot,
  variantId?: string | null
): ProductDetailSnapshot {
  const preferred = variantId?.trim() || null;
  if (!preferred || detail.variant_id === preferred) return detail;

  const anchored = detail.variants.find((row) => row.id === preferred);
  if (!anchored) return detail;

  const master =
    detail.variants.find((row) => row.is_master) ??
    detail.variants.find((row) => row.is_sellable !== false) ??
    detail.variants[0];

  return {
    ...detail,
    variant_id: anchored.id,
    sku: anchored.sku,
    barcode: anchored.barcode,
    variant_attributes: anchored.variant_attributes ?? {},
    dead_weight_kg: master?.dead_weight_kg ?? detail.dead_weight_kg,
    volume: master?.volume ?? detail.volume,
    length_cm: master?.length_cm ?? detail.length_cm,
    width_cm: master?.width_cm ?? detail.width_cm,
    height_cm: master?.height_cm ?? detail.height_cm,
    variant_is_active: master?.is_active ?? detail.variant_is_active,
  };
}

/**
 * Re-use a peek cache entry when switching variant focus.
 * Returns null when the cached snapshot cannot satisfy the requested focus
 * (e.g. tiered essentials only loaded master + one other variant row).
 */
export function resolvePeekCachedDetail(
  detail: ProductDetailSnapshot,
  variantId?: string | null
): ProductDetailSnapshot | null {
  const focusId = resolvePeekVariantFocus(detail, variantId);
  if (!focusId) return null;

  const reanchored = reanchorProductDetailVariant(detail, focusId);
  if (reanchored.variant_id !== focusId) return null;

  return reanchored;
}

export function peekItemCacheKey(itemId: string) {
  return `${itemId}:*peek`;
}
