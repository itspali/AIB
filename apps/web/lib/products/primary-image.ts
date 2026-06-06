import type { ProductMediaSnapshot, ProductVariantSnapshot } from "@/lib/products/types";
import {
  filterSharedMedia,
  filterVariantSpecificMedia,
  findMasterVariant,
} from "@/lib/products/media-variants";

type PrimaryImageCandidate = {
  variant_id: string | null;
  storage_url: string;
  preview_url?: string | null;
  sort_order: number;
  is_primary: boolean;
};

type MasterLookupVariant = { id: string; is_master?: boolean };

function pickPrimaryImageEntry(
  media: PrimaryImageCandidate[],
  defaultVariantId?: string | null,
  masterVariantId?: string | null
): PrimaryImageCandidate | null {
  if (!media.length) return null;

  const pickFrom = (rows: PrimaryImageCandidate[]) => {
    if (!rows.length) return null;
    const primary = rows.find((row) => row.is_primary);
    if (primary) return primary;
    return [...rows].sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
  };

  if (defaultVariantId) {
    const fromVariant = pickFrom(media.filter((row) => row.variant_id === defaultVariantId));
    if (fromVariant) return fromVariant;
  }

  if (masterVariantId) {
    const fromMaster = pickFrom(media.filter((row) => row.variant_id === masterVariantId));
    if (fromMaster) return fromMaster;
  }

  const fromProduct = pickFrom(media.filter((row) => row.variant_id === null));
  if (fromProduct) return fromProduct;

  return pickFrom(media);
}

export function pickPrimaryImagePreviewUrl(
  media: PrimaryImageCandidate[],
  defaultVariantId?: string | null,
  variants?: MasterLookupVariant[]
): string | null {
  const masterVariantId = findMasterVariant(variants ?? [])?.id ?? null;
  return pickPrimaryImageEntry(media, defaultVariantId, masterVariantId)?.preview_url ?? null;
}

export function pickPrimaryImageStoragePath(
  media: PrimaryImageCandidate[],
  defaultVariantId?: string | null,
  variants?: MasterLookupVariant[]
): string | null {
  const masterVariantId = findMasterVariant(variants ?? [])?.id ?? null;
  return pickPrimaryImageEntry(media, defaultVariantId, masterVariantId)?.storage_url ?? null;
}

export function resolveVariantMediaGallery(
  media: ProductMediaSnapshot[],
  variantId: string,
  variants: ProductVariantSnapshot[]
): ProductMediaSnapshot[] {
  const masterVariant = findMasterVariant(variants);
  const shared = filterSharedMedia(media, masterVariant);
  const own = filterVariantSpecificMedia(media, variantId);
  if (masterVariant?.id === variantId) {
    return shared;
  }
  return [...shared, ...own];
}
