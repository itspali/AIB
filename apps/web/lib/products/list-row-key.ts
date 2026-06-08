import type { ProductListRow } from "@/lib/products/types";
import type { ProductListRowKind } from "@/lib/products/variant-strategy";

export function productListRowKey(row: ProductListRow, showVariants: boolean): string {
  return showVariants && row.variant_id ? row.variant_id : row.id;
}

/** True when rows already include per-variant lines (expanded list shape). */
export function listHasExpandedVariantRows(rows: ProductListRow[]): boolean {
  return rows.some((row) => isVariantChildListRow(row));
}

/** True when the row is a sellable variant line in an expanded variant list. */
export function isVariantChildListRow(row: ProductListRow): boolean {
  if (!row.variant_id) return false;
  const strategy = row.variant_strategy ?? "SINGLE_SKU";
  return strategy === "MULTI_SKU" || Boolean(row.has_variants);
}

/** Builds a parent/style list row from the first variant row of a multi-variant item. */
export function toVariantParentListRow(row: ProductListRow): ProductListRow {
  return {
    ...row,
    variant_id: null,
    variant_attributes: null,
    variant_is_active: undefined,
    variant_is_master: undefined,
    variant_is_sellable: undefined,
    default_sku: row.style_code?.trim() || row.default_sku,
  };
}

function sumVariantStockOnHand(rows: ProductListRow[]): string {
  const total = rows.reduce((sum, row) => {
    const parsed = Number(row.stock_on_hand ?? 0);
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
  return String(total);
}

/** Parent/style row with item-level stock and reorder flags rolled up from variant children. */
export function buildVariantParentListRow(variantRows: ProductListRow[]): ProductListRow {
  const first = variantRows[0];
  if (!first) {
    throw new Error("buildVariantParentListRow requires at least one variant row.");
  }

  const sellableCount =
    typeof first.sellable_variant_count === "number" &&
    Number.isFinite(first.sellable_variant_count) &&
    first.sellable_variant_count > 0
      ? first.sellable_variant_count
      : variantRows.length;

  const parent: ProductListRow = {
    ...toVariantParentListRow(first),
    sellable_variant_count: sellableCount,
  };

  if (variantRows.length === 1) return parent;

  return {
    ...parent,
    stock_on_hand: sumVariantStockOnHand(variantRows),
    below_reorder: variantRows.some((row) => row.below_reorder === true),
  };
}

/**
 * Inserts a parent row immediately before the first variant row of each multi-variant item.
 * Used when variants are expanded so parent cards/rows can show the "Has variants" badge
 * while variant rows keep their own presentation.
 */
/** One item-level row per product when variant expansion is off. */
export function collapseVariantListRows(rows: ProductListRow[]): ProductListRow[] {
  const groups = new Map<string, ProductListRow[]>();
  const order: string[] = [];

  for (const row of rows) {
    if (!groups.has(row.id)) {
      order.push(row.id);
      groups.set(row.id, []);
    }
    groups.get(row.id)!.push(row);
  }

  return order.map((itemId) => {
    const group = groups.get(itemId)!;
    const master = group.find((row) => !row.variant_id);
    if (master) return master;

    const variantChildren = group.filter((row) => isVariantChildListRow(row));
    if (variantChildren.length > 0) return buildVariantParentListRow(variantChildren);

    return group[0]!;
  });
}

/** Reuse signed image URLs from an already-loaded list when refetching without images. */
export function mergeProductListRowImages(
  rows: ProductListRow[],
  sourceRows: ProductListRow[],
  expandVariants: boolean
): ProductListRow[] {
  if (!sourceRows.length) return rows;

  const imageByItemId = new Map<string, string | null>();
  const imageByRowKey = new Map<string, string | null>();

  for (const row of sourceRows) {
    if (!row.image_url) continue;
    imageByItemId.set(row.id, row.image_url);
    imageByRowKey.set(productListRowKey(row, true), row.image_url);
    imageByRowKey.set(productListRowKey(row, false), row.image_url);
  }

  return rows.map((row) => {
    const merged =
      imageByRowKey.get(productListRowKey(row, expandVariants)) ??
      imageByItemId.get(row.id) ??
      row.image_url;
    return merged === row.image_url ? row : { ...row, image_url: merged };
  });
}

export function injectVariantParentRows(rows: ProductListRow[]): ProductListRow[] {
  const variantChildrenByItemId = new Map<string, ProductListRow[]>();
  for (const row of rows) {
    if (!isVariantChildListRow(row)) continue;
    const group = variantChildrenByItemId.get(row.id) ?? [];
    group.push(row);
    variantChildrenByItemId.set(row.id, group);
  }

  const result: ProductListRow[] = [];
  const seenParentIds = new Set<string>();

  for (const row of rows) {
    if (isVariantChildListRow(row) && !seenParentIds.has(row.id)) {
      seenParentIds.add(row.id);
      const children = variantChildrenByItemId.get(row.id) ?? [row];
      result.push(buildVariantParentListRow(children));
    }
    result.push(row);
  }

  return result;
}

/** Maps list row selection keys to parent item ids for item-level bulk RPCs. */
export function resolveBulkSelectionItemIds(
  selectedRowKeys: Iterable<string>,
  products: ProductListRow[],
  expandVariants: boolean
): string[] {
  const keys = [...selectedRowKeys];
  if (!expandVariants) {
    return [...new Set(keys)];
  }

  const rowKeyToItemId = new Map(
    products.map((row) => [productListRowKey(row, true), row.id] as const)
  );

  return [...new Set(keys.map((key) => rowKeyToItemId.get(key) ?? key))];
}

export function listVariantAttributeEntries(
  attributes: Record<string, unknown> | null | undefined
): Array<[string, string]> {
  if (!attributes || typeof attributes !== "object") return [];

  return Object.entries(attributes)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([key, value]) => [key, String(value)]);
}

export function formatVariantAttributesSubline(
  attributes: Record<string, unknown> | null | undefined
): string | null {
  const parts = listVariantAttributeEntries(attributes).map(([key, value]) => `${key}: ${value}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Resolves the SKU/code shown for a list row — variant SKU for variant rows, style code for parents. */
export function resolveProductListDisplaySku(
  product: Pick<ProductListRow, "default_sku" | "style_code">,
  rowKind: ProductListRowKind
): string | null {
  if (rowKind === "variant") {
    return product.default_sku?.trim() || null;
  }

  return product.style_code?.trim() || product.default_sku?.trim() || null;
}

export function isProductListRowInactive(row: ProductListRow, showVariants: boolean): boolean {
  if (!row.is_active) return true;
  if (showVariants && row.variant_id && row.variant_is_active === false) return true;
  return false;
}

export function resolveProductListRowActiveStatus(
  row: ProductListRow,
  showVariants: boolean
): boolean {
  if (!row.is_active) return false;
  if (showVariants && row.variant_id && row.variant_is_active === false) return false;
  return true;
}

/** Whether a list row matches the open drawer selection (item + optional variant). */
export function isProductListRowSelected(
  row: ProductListRow,
  selectedItemId: string | null,
  selectedVariantId: string | null,
  showVariants: boolean
): boolean {
  if (!selectedItemId || row.id !== selectedItemId) return false;
  if (!showVariants || !row.variant_id) return true;
  return (selectedVariantId ?? null) === row.variant_id;
}
