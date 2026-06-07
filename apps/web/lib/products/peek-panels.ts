import type {
  ProductDetailSnapshot,
  ProductPeekPanelId,
  ProductPeekSection,
  ProductVariantCountSummary,
} from "@/lib/products/types";

export type { ProductPeekPanelId, ProductPeekSection, ProductVariantCountSummary } from "@/lib/products/types";

export const PRODUCT_PEEK_PANEL_IDS: ProductPeekPanelId[] = [
  "essentials",
  "variants",
  "media",
  "reach",
];

export function isProductPeekPanelId(value: string | null | undefined): value is ProductPeekPanelId {
  return (
    value === "essentials" ||
    value === "variants" ||
    value === "media" ||
    value === "reach"
  );
}

export function peekPanelToSection(panel: ProductPeekPanelId): ProductPeekSection | null {
  if (panel === "variants") return "variants";
  if (panel === "media") return "media";
  if (panel === "reach") return "reach";
  return null;
}

export function isPeekSectionLoaded(
  detail: ProductDetailSnapshot | null | undefined,
  section: ProductPeekSection
): boolean {
  return Boolean(detail?.peek_loaded_sections?.includes(section));
}

export function mergeProductPeekSection(
  detail: ProductDetailSnapshot,
  section: ProductPeekSection,
  patch: Partial<ProductDetailSnapshot>
): ProductDetailSnapshot {
  const loaded = new Set(detail.peek_loaded_sections ?? []);
  loaded.add(section);

  const next: ProductDetailSnapshot = {
    ...detail,
    ...patch,
    peek_loaded_sections: [...loaded],
  };

  if (section === "variants" && patch.variants?.length) {
    next.variant_count_summary = undefined;
  }

  return next;
}

type VariantIndexRow = {
  id: string;
  is_master?: boolean | null;
  is_sellable?: boolean | null;
};

export function resolvePeekFocusVariantIds(
  rows: VariantIndexRow[],
  preferredVariantId?: string | null
): { focusIds: string[]; counts: ProductVariantCountSummary } {
  if (!rows.length) {
    return { focusIds: [], counts: { total: 0, sellable: 0 } };
  }

  const master = rows.find((row) => row.is_master) ?? rows[0];
  const preferred = preferredVariantId?.trim();
  const focusId =
    preferred && rows.some((row) => row.id === preferred) ? preferred : master.id;

  const focusIds = [...new Set([master.id, focusId].filter(Boolean))];
  const sellable = rows.filter(
    (row) => !row.is_master && row.is_sellable !== false
  ).length;

  return {
    focusIds,
    counts: { total: rows.length, sellable },
  };
}

export function resolveSellableVariantCount(detail: ProductDetailSnapshot): number {
  if (detail.variant_count_summary) return detail.variant_count_summary.sellable;
  return detail.variants.filter((row) => row.is_sellable !== false && !row.is_master).length;
}

export function resolveTotalVariantCount(detail: ProductDetailSnapshot): number {
  if (detail.variant_count_summary) return detail.variant_count_summary.total;
  return detail.variants.length;
}
