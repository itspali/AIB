import type { ProductListRow } from "@/lib/products/types";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";

type SublineInput = {
  product: ProductListRow;
  showSku: boolean;
  showStatus: boolean;
  showVariants?: boolean;
};

export type CompactCardSubline = {
  skuPart: string | null;
  statusPart: string | null;
  statusActive: boolean;
};

export function buildCompactCardSubline({
  product,
  showSku,
  showStatus,
  showVariants = false,
}: SublineInput): CompactCardSubline | null {
  const { displaySku, isExpandedVariantRow } = resolveProductListRowPresentation(
    product,
    showVariants
  );

  // Variant cards render SKU in the card header; keep subline for master/single rows.
  if (isExpandedVariantRow) {
    return null;
  }

  const skuPart = showSku ? (displaySku?.trim() ? displaySku.trim() : "No SKU") : null;
  const statusPart = showStatus ? (product.is_active ? "Active" : "Inactive") : null;

  if (!skuPart && !statusPart) return null;

  return {
    skuPart,
    statusPart,
    statusActive: product.is_active,
  };
}

export function formatCompactCardSubline(subline: CompactCardSubline): string {
  const parts = [subline.skuPart, subline.statusPart].filter(Boolean);
  return parts.join(" · ");
}
