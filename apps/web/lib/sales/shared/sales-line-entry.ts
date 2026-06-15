import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";

export type SalesCommerceLineBase = {
  key: string;
  sku: string;
  variant_id: string;
  item_id: string;
  item_name: string;
  variant_sku: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  discount_type?: "percent" | "amount";
  image_url?: string | null;
  base_unit_of_measure?: string | null;
  uom_code?: string;
  skuError: string | null;
  catalog_context?: PoLineCatalogContext | null;
  /** Percent variance from catalog selling rate (draft UI only). */
  selling_markdown_percentage?: string;
};

export function isSalesCommerceLineComplete(
  line: SalesCommerceLineBase & { quantity: string }
): boolean {
  return Boolean(line.variant_id) && Number(line.quantity) > 0;
}

export function isSalesCommerceLineBlank(line: SalesCommerceLineBase): boolean {
  return !line.variant_id && !line.sku.trim();
}

export function createEmptySalesCommerceLineBase(): Omit<SalesCommerceLineBase, "key"> {
  return {
    sku: "",
    variant_id: "",
    item_id: "",
    item_name: "",
    variant_sku: "",
    unit_price_selling: "0",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
  };
}

export function ensureTrailingSalesCommerceLine<T extends SalesCommerceLineBase>(
  lines: T[],
  createLine: () => T,
  getQuantity: (line: T) => string
): T[] {
  const last = lines.at(-1);
  if (!last || isSalesCommerceLineComplete({ ...last, quantity: getQuantity(last) })) {
    return [...lines, createLine()];
  }
  return lines;
}

export function moveSalesCommerceDraftLine<T extends { key: string }>(
  lines: T[],
  fromKey: string,
  toKey: string,
  position: "before" | "after"
): T[] {
  const fromIndex = lines.findIndex((line) => line.key === fromKey);
  const toIndex = lines.findIndex((line) => line.key === toKey);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return lines;

  const next = [...lines];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return lines;

  let insertIndex = toIndex;
  if (fromIndex < toIndex) insertIndex -= 1;
  if (position === "after") insertIndex += 1;
  next.splice(insertIndex, 0, moved);
  return next;
}

export function normalizeSalesCommerceLinesForAnchor<T extends SalesCommerceLineBase>(
  lines: T[],
  anchor: "top" | "bottom",
  createLine: () => T
): T[] {
  const complete = lines.filter(
    (line) => !isSalesCommerceLineBlank(line) || line.sku.trim().length > 0
  );
  const trailing = anchor === "top" ? [createLine(), ...complete] : [...complete, createLine()];
  return trailing;
}

export function salesCommerceLinesNeedAnchorNormalization<T extends SalesCommerceLineBase>(
  lines: T[],
  anchor: "top" | "bottom"
): boolean {
  if (lines.length === 0) return true;
  const first = lines[0];
  const last = lines.at(-1);
  if (!first || !last) return true;
  if (anchor === "top") return !isSalesCommerceLineBlank(first);
  return !isSalesCommerceLineBlank(last);
}
