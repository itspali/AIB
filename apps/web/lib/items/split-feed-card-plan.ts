import { cardFieldHasDisplayValue } from "@/lib/products/card-layout-plan";
import { getProductListCellDisplayTexts } from "@/lib/products/list-column-display-text";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import type { ProductListRow } from "@/lib/products/types";
import { productListHasVariantsBadgeLabel } from "@/lib/products/variant-strategy";

/** Always rendered on split-feed cards (column toggles locked in settings). */
export const SPLIT_FEED_PINNED_COLUMNS = ["default_sku", "name"] as const satisfies readonly ProductListColumnId[];

export type SplitFeedPinnedColumnId = (typeof SPLIT_FEED_PINNED_COLUMNS)[number];

export const ITEMS_WORKSPACE_PINNED_COLUMNS: ProductListColumnId[] = [...SPLIT_FEED_PINNED_COLUMNS];

/** Hidden from items workspace lists; inactive state uses row styling instead. */
export const ITEMS_WORKSPACE_DISABLED_COLUMNS = ["is_active"] as const satisfies readonly ProductListColumnId[];

const ITEMS_WORKSPACE_DISABLED_COLUMN_SET = new Set<ProductListColumnId>(
  ITEMS_WORKSPACE_DISABLED_COLUMNS
);

export function withoutItemsWorkspaceDisabledColumns(
  columns: readonly ProductListColumnId[]
): ProductListColumnId[] {
  return columns.filter((columnId) => !ITEMS_WORKSPACE_DISABLED_COLUMN_SET.has(columnId));
}

/** First matching visible column wins the top-right value slot. */
export const SPLIT_FEED_TOP_RIGHT_ORDER = [
  "selling_price",
  "mrp",
  "purchase_price",
  "stock_on_hand",
] as const satisfies readonly ProductListColumnId[];

/** Max optional fields on the split-feed meta line (excludes pinned SKU/name and top-right value). */
export const SPLIT_FEED_META_SEGMENT_CAP = 5;

/** Split feed renders these as name-row icons when the column is visible (matrix keeps table cells). */
export const SPLIT_FEED_CAPABILITY_ICON_COLUMNS = [
  "has_variants",
  "is_returnable",
] as const satisfies readonly ProductListColumnId[];

export type SplitFeedCapabilityIconColumnId =
  (typeof SPLIT_FEED_CAPABILITY_ICON_COLUMNS)[number];

const SPLIT_FEED_CAPABILITY_ICON_COLUMN_SET = new Set<ProductListColumnId>(
  SPLIT_FEED_CAPABILITY_ICON_COLUMNS
);

const SPLIT_FEED_FLAG_COLUMNS = new Set<ProductListColumnId>([
  "is_purchasable",
  "is_salable",
]);

export type SplitFeedMetaSegment = {
  text: string;
  /** When set, segment uses compact-card flag styling (✓ / — prefix). */
  flagEnabled?: boolean;
};

export type SplitFeedCapabilityIcon = {
  columnId: SplitFeedCapabilityIconColumnId;
  enabled: boolean;
  label: string;
  tooltip: string;
};

export type SplitFeedCardPlan = {
  sku: string;
  name: string;
  showImage: boolean;
  topRightValue: string | null;
  capabilityIcons: SplitFeedCapabilityIcon[];
  metaSegments: SplitFeedMetaSegment[];
};

function isPinnedColumn(columnId: ProductListColumnId): columnId is SplitFeedPinnedColumnId {
  return (SPLIT_FEED_PINNED_COLUMNS as readonly string[]).includes(columnId);
}

function resolveFlagEnabled(
  columnId: ProductListColumnId,
  product: ProductListRow,
  showVariants: boolean
): boolean | null {
  if (columnId === "is_purchasable") return product.is_purchasable;
  if (columnId === "is_salable") return product.is_salable;
  return null;
}

function formatSplitFeedFlagSegment(
  columnId: ProductListColumnId,
  product: ProductListRow,
  showVariants: boolean
): SplitFeedMetaSegment | null {
  const enabled = resolveFlagEnabled(columnId, product, showVariants);
  if (enabled === null) return null;
  const label = getColumnDef(columnId).label;
  return {
    text: `${enabled ? "✓" : "—"} ${label}`,
    flagEnabled: enabled,
  };
}

function formatSplitFeedCellSegment(
  columnId: ProductListColumnId,
  product: ProductListRow,
  showVariants: boolean
): SplitFeedMetaSegment | null {
  if (SPLIT_FEED_FLAG_COLUMNS.has(columnId)) {
    return formatSplitFeedFlagSegment(columnId, product, showVariants);
  }

  if (!cardFieldHasDisplayValue(columnId, product, showVariants)) return null;

  const [primary] = getProductListCellDisplayTexts(columnId, product, { showVariants });
  if (!primary || primary === "—") return null;
  return { text: primary };
}

function formatSplitFeedCellText(
  columnId: ProductListColumnId,
  product: ProductListRow,
  showVariants: boolean
): string | null {
  return formatSplitFeedCellSegment(columnId, product, showVariants)?.text ?? null;
}

function resolvePinnedSku(product: ProductListRow, showVariants: boolean): string {
  const formatted = formatSplitFeedCellText("default_sku", product, showVariants);
  if (formatted) return formatted;
  const presentation = resolveProductListRowPresentation(product, showVariants);
  return presentation.displaySku?.trim() || product.id.slice(0, 8).toUpperCase();
}

function resolvePinnedName(product: ProductListRow): string {
  return product.name?.trim() || "—";
}

function buildSplitFeedCapabilityIcons(
  optionalOrdered: readonly ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): SplitFeedCapabilityIcon[] {
  const icons: SplitFeedCapabilityIcon[] = [];

  for (const columnId of SPLIT_FEED_CAPABILITY_ICON_COLUMNS) {
    if (!optionalOrdered.includes(columnId)) continue;

    if (columnId === "has_variants") {
      const presentation = resolveProductListRowPresentation(product, showVariants);
      if (presentation.isExpandedVariantRow) continue;
      const label = getColumnDef(columnId).label;
      const enabled = presentation.showHasVariantsIndicator;
      icons.push({
        columnId,
        enabled,
        label,
        tooltip: enabled
          ? productListHasVariantsBadgeLabel(product.sellable_variant_count)
          : `No ${label.toLowerCase()}`,
      });
      continue;
    }

    if (columnId === "is_returnable") {
      const label = getColumnDef(columnId).label;
      const enabled = product.is_returnable;
      icons.push({
        columnId,
        enabled,
        label,
        tooltip: enabled ? label : `Not ${label.toLowerCase()}`,
      });
    }
  }

  return icons;
}

/** Ensures pinned columns stay visible while preserving column order. */
export function withPinnedVisibleColumns(
  orderedVisible: readonly ProductListColumnId[],
  columnOrder: readonly ProductListColumnId[],
  pinned: readonly ProductListColumnId[] = ITEMS_WORKSPACE_PINNED_COLUMNS
): ProductListColumnId[] {
  const visibleSet = new Set<ProductListColumnId>(orderedVisible);
  for (const columnId of pinned) {
    visibleSet.add(columnId);
  }

  const order = columnOrder.length > 0 ? columnOrder : orderedVisible;
  const result: ProductListColumnId[] = [];

  for (const columnId of order) {
    if (visibleSet.has(columnId)) {
      result.push(columnId);
      visibleSet.delete(columnId);
    }
  }

  for (const columnId of visibleSet) {
    result.push(columnId);
  }

  return result;
}

export function buildSplitFeedCardPlan(
  visibleColumns: readonly ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): SplitFeedCardPlan {
  const optionalOrdered: ProductListColumnId[] = visibleColumns.filter(
    (columnId) => !isPinnedColumn(columnId) && columnId !== "image"
  );

  let topRightValue: string | null = null;
  const consumed = new Set<ProductListColumnId>();

  for (const columnId of SPLIT_FEED_TOP_RIGHT_ORDER) {
    if (!optionalOrdered.includes(columnId)) continue;
    const value = formatSplitFeedCellText(columnId, product, showVariants);
    if (!value) continue;
    topRightValue = value;
    consumed.add(columnId);
    break;
  }

  const capabilityIcons = buildSplitFeedCapabilityIcons(optionalOrdered, product, showVariants);
  for (const icon of capabilityIcons) {
    consumed.add(icon.columnId);
  }

  const metaSegments: SplitFeedMetaSegment[] = [];
  for (const columnId of optionalOrdered) {
    if (consumed.has(columnId)) continue;
    if (ITEMS_WORKSPACE_DISABLED_COLUMN_SET.has(columnId)) continue;
    if (SPLIT_FEED_CAPABILITY_ICON_COLUMN_SET.has(columnId)) continue;
    if (metaSegments.length >= SPLIT_FEED_META_SEGMENT_CAP) break;
    const segment = formatSplitFeedCellSegment(columnId, product, showVariants);
    if (!segment) continue;
    metaSegments.push(segment);
  }

  return {
    sku: resolvePinnedSku(product, showVariants),
    name: resolvePinnedName(product),
    showImage: visibleColumns.includes("image"),
    topRightValue,
    capabilityIcons,
    metaSegments,
  };
}
