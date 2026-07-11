import { formatVariantAttributesSubline } from "@/lib/products/list-row-key";
import { resolveSellableVariantCount } from "@/lib/products/peek-panels";
import { SUMMARY_VIEWING_VARIANT } from "@/lib/products/product-user-labels";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import {
  isDetailVariantSkuContext,
  resolveDetailIdentitySku,
  resolveMasterFormSku,
} from "@/lib/products/types";
import { variantStrategyLabel } from "@/lib/products/variant-strategy";

export type ItemDetailHeaderLines = {
  title: string;
  subtitle: string | null;
};

function resolveRowIdentitySku(row: ProductListRow): string {
  return row.style_code?.trim() || row.default_sku?.trim() || "";
}

function resolveProductStrategyMeta(detail: ProductDetailSnapshot): string {
  const isMultiSku = detail.variant_strategy === "MULTI_SKU";
  const strategy = variantStrategyLabel(detail.variant_strategy);
  if (!isMultiSku) return strategy;
  const sellableCount = resolveSellableVariantCount(detail);
  return `${strategy} · ${sellableCount} sellable variant${sellableCount === 1 ? "" : "s"}`;
}

/**
 * Title + subtitle for item peek chrome (split detail header, drawer title helpers).
 * Avoids repeating identity SKU when it matches the display name.
 */
export function buildItemDetailHeaderLines(
  detail: ProductDetailSnapshot | null,
  row: ProductListRow | null
): ItemDetailHeaderLines {
  const name = (detail?.name ?? row?.name ?? "").trim() || "—";

  if (!detail) {
    const identitySku = row ? resolveRowIdentitySku(row) : "";
    const title = name !== "—" ? name : identitySku || "—";
    const subtitle = identitySku && identitySku !== title ? identitySku : null;
    return { title, subtitle };
  }

  const variantSkuContext = isDetailVariantSkuContext(detail);
  const identitySku = resolveDetailIdentitySku(detail).trim();
  const selectedVariant =
    detail.variants.find((variant) => variant.id === detail.variant_id) ??
    (variantSkuContext ? null : (detail.variants.find((variant) => variant.is_master) ?? null));

  if (variantSkuContext && selectedVariant) {
    const productCode = resolveMasterFormSku(detail);
    const attributeLine = formatVariantAttributesSubline(selectedVariant.variant_attributes);
    const subtitleParts: string[] = [SUMMARY_VIEWING_VARIANT];
    if (attributeLine) subtitleParts.push(attributeLine);
    if (productCode && productCode !== selectedVariant.sku) {
      subtitleParts.push(productCode);
    }
    return {
      title: selectedVariant.sku,
      subtitle: subtitleParts.join(" · "),
    };
  }

  const strategyMeta = resolveProductStrategyMeta(detail);
  const title = name !== "—" && name !== identitySku ? name : identitySku || name;
  const subtitleParts: string[] = [];
  if (identitySku && identitySku !== title) {
    subtitleParts.push(identitySku);
  }
  subtitleParts.push(strategyMeta);

  return {
    title,
    subtitle: subtitleParts.join(" · "),
  };
}
