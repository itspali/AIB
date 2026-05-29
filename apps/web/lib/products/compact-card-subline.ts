import type { ProductListRow } from "@/lib/products/types";

type SublineInput = {
  product: ProductListRow;
  showSku: boolean;
  showStatus: boolean;
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
}: SublineInput): CompactCardSubline | null {
  const skuPart = showSku
    ? product.default_sku?.trim()
      ? product.default_sku.trim()
      : "No SKU"
    : null;
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
