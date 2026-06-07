import type { ProductMediaSnapshot, ProductVariantSnapshot } from "@/lib/products/types";

export type MediaVariantRow = {
  key: string;
  label: string;
  subtitle: string;
  uploadVariantId: string | null;
  isMaster: boolean;
};

export function findMasterVariant<T extends { id: string; is_master?: boolean }>(
  variants: T[]
): T | null {
  return variants.find((variant) => variant.is_master) ?? null;
}

export function sortMediaEntries(media: ProductMediaSnapshot[]): ProductMediaSnapshot[] {
  return [...media].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

/** Images stored on the master variant or product level (variant_id null). */
export function filterSharedMedia(
  media: ProductMediaSnapshot[],
  masterVariant: ProductVariantSnapshot | null
): ProductMediaSnapshot[] {
  const masterId = masterVariant?.id ?? null;
  return sortMediaEntries(
    media.filter(
      (entry) => entry.variant_id === null || (masterId !== null && entry.variant_id === masterId)
    )
  );
}

export function filterVariantSpecificMedia(
  media: ProductMediaSnapshot[],
  variantId: string
): ProductMediaSnapshot[] {
  return sortMediaEntries(media.filter((entry) => entry.variant_id === variantId));
}

export function listMediaVariantRows(variants: ProductVariantSnapshot[]): MediaVariantRow[] {
  const masterVariant = findMasterVariant(variants);
  const sellableVariants = variants
    .filter((variant) => variant.is_sellable !== false && !variant.is_master)
    .sort((a, b) => a.sku.localeCompare(b.sku));

  const rows: MediaVariantRow[] = [
    {
      key: masterVariant?.id ?? "shared",
      label: masterVariant ? `Master · ${masterVariant.sku}` : "Shared images",
      subtitle: "Applies to all variants. Edit these on the master row only.",
      uploadVariantId: masterVariant?.id ?? null,
      isMaster: true,
    },
  ];

  for (const variant of sellableVariants) {
    rows.push({
      key: variant.id,
      label: variant.sku,
      subtitle: "Additional images for this variant only.",
      uploadVariantId: variant.id,
      isMaster: false,
    });
  }

  return rows;
}

export function resolveMasterVariantIdFromVariants(
  variants: ProductVariantSnapshot[] | undefined
): string | null {
  if (!variants?.length) return null;
  return findMasterVariant(variants)?.id ?? null;
}

/** SKU label for sellable variant-owned media; null for shared/master/product-level images. */
export function resolveMediaVariantSkuBadge(
  variantId: string | null,
  variants: ProductVariantSnapshot[],
  masterVariant?: ProductVariantSnapshot | null
): string | null {
  if (!variantId) return null;

  const master = masterVariant ?? findMasterVariant(variants);
  if (master?.id === variantId) return null;

  const variant = variants.find((row) => row.id === variantId);
  if (!variant || variant.is_master || variant.is_sellable === false) return null;

  const sku = variant.sku?.trim();
  return sku || null;
}

/** Compact SKU label for small media thumbnails; hides the shared product-code prefix. */
export function formatMediaSkuBadgeLabel(sku: string, maxLength = 14): string {
  const normalized = sku.trim();
  if (normalized.length <= maxLength) return normalized;

  return `…${normalized.slice(-(maxLength - 1))}`;
}
