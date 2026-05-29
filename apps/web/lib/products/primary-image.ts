type PrimaryImageCandidate = {
  variant_id: string | null;
  storage_url: string;
  preview_url?: string | null;
  sort_order: number;
  is_primary: boolean;
};

function pickPrimaryImageEntry(
  media: PrimaryImageCandidate[],
  defaultVariantId?: string | null
): PrimaryImageCandidate | null {
  if (!media.length) return null;

  const pickFrom = (rows: PrimaryImageCandidate[]) => {
    if (!rows.length) return null;
    const primary = rows.find((row) => row.is_primary);
    if (primary) return primary;
    return [...rows].sort((a, b) => a.sort_order - b.sort_order)[0] ?? null;
  };

  const fromProduct = pickFrom(media.filter((row) => row.variant_id === null));
  if (fromProduct) return fromProduct;

  if (defaultVariantId) {
    const fromVariant = pickFrom(media.filter((row) => row.variant_id === defaultVariantId));
    if (fromVariant) return fromVariant;
  }

  return pickFrom(media);
}

export function pickPrimaryImagePreviewUrl(
  media: PrimaryImageCandidate[],
  defaultVariantId?: string | null
): string | null {
  return pickPrimaryImageEntry(media, defaultVariantId)?.preview_url ?? null;
}

export function pickPrimaryImageStoragePath(
  media: PrimaryImageCandidate[],
  defaultVariantId?: string | null
): string | null {
  return pickPrimaryImageEntry(media, defaultVariantId)?.storage_url ?? null;
}
