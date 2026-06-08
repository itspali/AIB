import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import { resolveStockStatus } from "@/lib/products/stock-status";
import type { ProductListRow } from "@/lib/products/types";
import { productListHasVariantsBadgeLabel } from "@/lib/products/variant-strategy";

export const CARD_CONTEXT_SEGMENT_CAP = 3;
export const CARD_DETAIL_ROW_CAP = 4;

const HERO_CONTEXT_ORDER: ProductListColumnId[] = [
  "default_sku",
  "category_name",
  "barcode",
];

const CARD_FOOTER_RAIL_ORDER: ProductListColumnId[] = [
  "default_sku",
  "has_variants",
  "stock_on_hand",
  "category_name",
];

const METRIC_ORDER: ProductListColumnId[] = [
  "stock_on_hand",
  "selling_price",
  "purchase_price",
];

const DETAIL_ORDER: ProductListColumnId[] = [
  "base_unit_of_measure",
  "hsn_sac_code",
  "default_tax_category",
];

const FLAG_ORDER: ProductListColumnId[] = [
  "is_purchasable",
  "is_salable",
  "is_returnable",
  "has_variants",
];

const META_ORDER: ProductListColumnId[] = ["created_at", "updated_at", "supplier_name"];

export type CardLayoutDetailField = {
  columnId: ProductListColumnId;
  label: string;
  value: string;
};

export type CardSellingPriceParts = {
  amount: string;
  uom: string | null;
};

export type CardLayoutMetricField = {
  columnId: ProductListColumnId;
  label: string;
  value: string;
  /** Base UOM suffix when selling price is split from the amount. */
  unitSuffix?: string | null;
};

export type CardLayoutFlagField = {
  columnId: ProductListColumnId;
  label: string;
  enabled: boolean;
};

export type CardContextSegment = {
  text: string;
  mono?: boolean;
};

export type CardLayoutFooterItem = {
  columnId: ProductListColumnId;
  label: string;
  value: string;
};

export type CardLayoutPlan = {
  hero: {
    showImage: boolean;
    showTitle: boolean;
    showDescription: boolean;
    showHeroSku: boolean;
    heroSkuLabel: string | null;
    contextSegments: CardContextSegment[];
    contextOverflowCount: number;
    attributeSubline: string | null;
    variantSkuLine: string | null;
  };
  chrome: {
    showStatus: boolean;
    statusActive: boolean;
  };
  metrics: CardLayoutMetricField[];
  details: CardLayoutDetailField[];
  detailOverflow: CardLayoutDetailField[];
  flags: CardLayoutFlagField[];
  footerRail: CardLayoutFooterItem[];
  metaLine: string | null;
  shop: {
    category: string | null;
    showCategory: boolean;
    sellingPriceAmount: string | null;
    sellingPriceUom: string | null;
    showSellingPrice: boolean;
    mrpPrice: string | null;
    showMrp: boolean;
    stockLabel: string | null;
    stockStatus: "in_stock" | "low_stock" | "out_of_stock" | null;
    showStock: boolean;
    skuLine: string | null;
    showSku: boolean;
  };
  regions: {
    metrics: boolean;
    details: boolean;
    flags: boolean;
    meta: boolean;
    heroContext: boolean;
    description: boolean;
    footerRail: boolean;
    heroSku: boolean;
  };
};

function columnVisible(columns: ProductListColumnId[], id: ProductListColumnId): boolean {
  return columns.includes(id);
}

function shouldInlineBaseUomWithSellingPrice(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): boolean {
  return (
    columnVisible(columns, "selling_price") &&
    columnVisible(columns, "base_unit_of_measure") &&
    cardFieldHasDisplayValue("selling_price", product, showVariants)
  );
}

export function buildSellingPriceParts(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): CardSellingPriceParts | null {
  if (!columnVisible(columns, "selling_price")) return null;
  if (!cardFieldHasDisplayValue("selling_price", product, showVariants)) return null;

  const amount = formatCardFieldValue("selling_price", product, showVariants);
  if (!amount) return null;

  const uom = shouldInlineBaseUomWithSellingPrice(columns, product, showVariants)
    ? product.base_unit_of_measure?.trim() || null
    : null;

  return { amount, uom };
}

function shouldShowStrikethroughMrp(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): boolean {
  if (!columnVisible(columns, "mrp")) return false;
  if (!cardFieldHasDisplayValue("mrp", product, showVariants)) return false;
  if (!columnVisible(columns, "selling_price")) return true;
  if (!cardFieldHasDisplayValue("selling_price", product, showVariants)) return true;

  const selling = Number(product.selling_price);
  const mrp = Number(product.mrp);
  if (!Number.isFinite(selling) || !Number.isFinite(mrp)) return true;
  return mrp > selling;
}

export function cardFieldHasDisplayValue(
  columnId: ProductListColumnId,
  product: ProductListRow,
  showVariants: boolean
): boolean {
  const presentation = resolveProductListRowPresentation(product, showVariants);

  switch (columnId) {
    case "image":
    case "name":
    case "is_active":
    case "is_purchasable":
    case "is_salable":
    case "is_returnable":
      return true;
    case "has_variants":
      return presentation.showHasVariantsIndicator;
    case "default_sku":
      return !presentation.isExpandedVariantRow;
    case "barcode":
      return Boolean(product.barcode?.trim());
    case "category_name":
      return Boolean(product.category_name?.trim());
    case "description":
      return Boolean(product.description?.trim());
    case "hsn_sac_code":
      return Boolean(product.hsn_sac_code?.trim());
    case "supplier_name":
      return Boolean(product.supplier_name?.trim());
    case "selling_price":
      return Boolean(product.selling_price?.trim()) && Number.isFinite(Number(product.selling_price));
    case "mrp":
      return Boolean(product.mrp?.trim()) && Number.isFinite(Number(product.mrp)) && Number(product.mrp) > 0;
    case "purchase_price":
      return Boolean(product.purchase_price?.trim()) && Number.isFinite(Number(product.purchase_price));
    case "stock_on_hand":
      return product.stock_on_hand != null && product.stock_on_hand.trim() !== "";
    case "base_unit_of_measure":
    case "classification":
    case "default_tax_category":
    case "created_at":
    case "updated_at":
      return true;
    default:
      return false;
  }
}

function formatCardFieldValue(
  columnId: ProductListColumnId,
  product: ProductListRow,
  showVariants: boolean
): string | null {
  const presentation = resolveProductListRowPresentation(product, showVariants);

  switch (columnId) {
    case "default_sku": {
      const sku = presentation.displaySku?.trim();
      if (presentation.isExpandedVariantRow) return sku || null;
      return sku || "No SKU";
    }
    case "category_name":
      return product.category_name?.trim() || null;
    case "classification":
      return classificationLabel(product.classification);
    case "barcode":
      return product.barcode?.trim() || null;
    case "base_unit_of_measure":
      return product.base_unit_of_measure;
    case "hsn_sac_code":
      return product.hsn_sac_code?.trim() || null;
    case "default_tax_category":
      return taxCategoryLabel(product.default_tax_category);
    case "supplier_name":
      return product.supplier_name?.trim() || null;
    case "selling_price":
      return Number.isFinite(Number(product.selling_price))
        ? formatCurrency(Number(product.selling_price))
        : null;
    case "mrp":
      return Number.isFinite(Number(product.mrp)) ? formatCurrency(Number(product.mrp)) : null;
    case "purchase_price":
      return Number.isFinite(Number(product.purchase_price))
        ? formatCurrency(Number(product.purchase_price))
        : null;
    case "stock_on_hand": {
      const qty = product.stock_on_hand;
      if (qty == null || qty.trim() === "") return null;
      const parsed = Number(qty);
      return Number.isFinite(parsed) ? parsed.toLocaleString() : qty;
    }
    case "created_at":
      return formatDate(product.created_at);
    case "updated_at":
      return formatDate(product.updated_at);
    default:
      return null;
  }
}

function buildContextSegments(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean,
  options?: { omitColumnIds?: ProductListColumnId[] }
): { visible: CardContextSegment[]; overflowCount: number } {
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const omit = new Set(options?.omitColumnIds ?? []);

  if (presentation.isExpandedVariantRow) {
    return { visible: [], overflowCount: 0 };
  }

  const all: CardContextSegment[] = [];
  for (const columnId of HERO_CONTEXT_ORDER) {
    if (omit.has(columnId)) continue;
    if (!columnVisible(columns, columnId)) continue;
    if (!cardFieldHasDisplayValue(columnId, product, showVariants)) continue;
    const value = formatCardFieldValue(columnId, product, showVariants);
    if (!value) continue;
    all.push({ text: value, mono: columnId === "default_sku" });
  }

  const visible = all.slice(0, CARD_CONTEXT_SEGMENT_CAP);
  const overflowCount = Math.max(0, all.length - visible.length);
  return { visible, overflowCount };
}

function buildDetailFields(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): { visible: CardLayoutDetailField[]; overflow: CardLayoutDetailField[] } {
  const all: CardLayoutDetailField[] = [];

  for (const columnId of DETAIL_ORDER) {
    if (!columnVisible(columns, columnId)) continue;
    if (
      columnId === "base_unit_of_measure" &&
      shouldInlineBaseUomWithSellingPrice(columns, product, showVariants)
    ) {
      continue;
    }
    if (!cardFieldHasDisplayValue(columnId, product, showVariants)) continue;
    const value = formatCardFieldValue(columnId, product, showVariants);
    if (!value) continue;
    all.push({
      columnId,
      label: getColumnDef(columnId).label,
      value,
    });
  }

  return {
    visible: all.slice(0, CARD_DETAIL_ROW_CAP),
    overflow: all.slice(CARD_DETAIL_ROW_CAP),
  };
}

function buildFlagFields(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): CardLayoutFlagField[] {
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const flags: CardLayoutFlagField[] = [];

  for (const columnId of FLAG_ORDER) {
    if (!columnVisible(columns, columnId)) continue;
    if (columnId === "has_variants") {
      if (presentation.isExpandedVariantRow) continue;
      if (!presentation.showHasVariantsIndicator) continue;
      flags.push({
        columnId,
        label: getColumnDef(columnId).label,
        enabled: true,
      });
      continue;
    }
    flags.push({
      columnId,
      label: getColumnDef(columnId).label,
      enabled:
        columnId === "is_purchasable"
          ? product.is_purchasable
          : columnId === "is_salable"
            ? product.is_salable
            : product.is_returnable,
    });
  }

  return flags;
}

function buildMetaLine(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean
): string | null {
  const parts: string[] = [];

  for (const columnId of META_ORDER) {
    if (!columnVisible(columns, columnId)) continue;
    if (!cardFieldHasDisplayValue(columnId, product, showVariants)) continue;
    const value = formatCardFieldValue(columnId, product, showVariants);
    if (!value) continue;
    const prefix =
      columnId === "created_at" ? "Created" : columnId === "updated_at" ? "Updated" : "Supplier";
    parts.push(`${prefix} ${value}`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

function buildFooterRail(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean,
  showHeroSku: boolean
): CardLayoutFooterItem[] {
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const items: CardLayoutFooterItem[] = [];

  for (const columnId of CARD_FOOTER_RAIL_ORDER) {
    if (!columnVisible(columns, columnId)) continue;
    if (columnId === "default_sku" && showHeroSku) continue;

    if (columnId === "has_variants") {
      if (presentation.isExpandedVariantRow) continue;
      if (!presentation.showHasVariantsIndicator) continue;
      items.push({
        columnId,
        label: getColumnDef(columnId).label,
        value: productListHasVariantsBadgeLabel(product.sellable_variant_count),
      });
      continue;
    }

    if (!cardFieldHasDisplayValue(columnId, product, showVariants)) continue;
    const value = formatCardFieldValue(columnId, product, showVariants);
    if (!value) continue;

    items.push({
      columnId,
      label: getColumnDef(columnId).label,
      value,
    });
  }

  return items;
}

function buildShopBlock(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean,
  presentation: ReturnType<typeof resolveProductListRowPresentation>
) {
  const showCategory = columnVisible(columns, "category_name");
  const showSelling = columnVisible(columns, "selling_price");
  const sellingParts = showSelling
    ? buildSellingPriceParts(columns, product, showVariants)
    : null;
  const showMrp = shouldShowStrikethroughMrp(columns, product, showVariants);
  const showStock = columnVisible(columns, "stock_on_hand");
  const showSku = columnVisible(columns, "default_sku");

  const stock = showStock
    ? resolveStockStatus({
        stockOnHand: product.stock_on_hand,
        reorderPoint: product.reorder_point,
        belowReorder: product.below_reorder,
      })
    : null;
  const skuRaw =
    presentation.isExpandedVariantRow && presentation.displaySku?.trim()
      ? presentation.displaySku.trim()
      : showSku
        ? formatCardFieldValue("default_sku", product, showVariants)
        : null;

  return {
    category: showCategory ? formatCardFieldValue("category_name", product, showVariants) : null,
    showCategory,
    sellingPriceAmount: sellingParts?.amount ?? null,
    sellingPriceUom: sellingParts?.uom ?? null,
    showSellingPrice: Boolean(sellingParts),
    mrpPrice: showMrp ? formatCardFieldValue("mrp", product, showVariants) : null,
    showMrp,
    stockLabel: stock?.label ?? null,
    stockStatus: stock?.status ?? null,
    showStock,
    skuLine: skuRaw,
    showSku: showSku && Boolean(skuRaw),
  };
}

export function buildCardLayoutPlan(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean,
  options?: { rowActive?: boolean }
): CardLayoutPlan {
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const showHeroSku =
    columnVisible(columns, "default_sku") &&
    cardFieldHasDisplayValue("default_sku", product, showVariants);
  const heroSkuLabel = showHeroSku
    ? formatCardFieldValue("default_sku", product, showVariants)
    : null;
  const contextOmit: ProductListColumnId[] = [];
  if (showHeroSku) contextOmit.push("default_sku");
  for (const columnId of CARD_FOOTER_RAIL_ORDER) {
    if (columnVisible(columns, columnId)) {
      if (columnId === "default_sku" && showHeroSku) continue;
      contextOmit.push(columnId);
    }
  }

  const { visible: contextSegments, overflowCount: contextOverflowCount } = buildContextSegments(
    columns,
    product,
    showVariants,
    { omitColumnIds: contextOmit }
  );

  const metrics: CardLayoutMetricField[] = [];
  for (const columnId of METRIC_ORDER) {
    if (!columnVisible(columns, columnId)) continue;
    if (!cardFieldHasDisplayValue(columnId, product, showVariants)) continue;
    if (columnId === "selling_price") {
      const parts = buildSellingPriceParts(columns, product, showVariants);
      if (!parts) continue;
      metrics.push({
        columnId,
        label: getColumnDef(columnId).label,
        value: parts.amount,
        unitSuffix: parts.uom,
      });
      continue;
    }

    const value = formatCardFieldValue(columnId, product, showVariants);
    if (!value) continue;
    metrics.push({
      columnId,
      label: getColumnDef(columnId).label,
      value,
    });
  }

  const { visible: details, overflow: detailOverflow } = buildDetailFields(
    columns,
    product,
    showVariants
  );
  const flags = buildFlagFields(columns, product, showVariants);
  const footerRail = buildFooterRail(columns, product, showVariants, showHeroSku);
  const metaLine = buildMetaLine(columns, product, showVariants);

  const showDescription =
    columnVisible(columns, "description") &&
    cardFieldHasDisplayValue("description", product, showVariants);

  const variantSkuLine =
    presentation.isExpandedVariantRow && presentation.displaySku?.trim()
      ? presentation.displaySku.trim()
      : null;

  return {
    hero: {
      showImage: columnVisible(columns, "image"),
      showTitle: columnVisible(columns, "name"),
      showDescription,
      showHeroSku,
      heroSkuLabel,
      contextSegments,
      contextOverflowCount,
      attributeSubline: presentation.attributeSubline,
      variantSkuLine,
    },
    chrome: {
      showStatus: columnVisible(columns, "is_active"),
      statusActive: options?.rowActive ?? product.is_active,
    },
    metrics,
    details,
    detailOverflow,
    flags,
    footerRail,
    metaLine,
    shop: buildShopBlock(columns, product, showVariants, presentation),
    regions: {
      metrics: metrics.length > 0,
      details: details.length > 0 || detailOverflow.length > 0,
      flags: flags.length > 0,
      meta: metaLine != null,
      heroContext: contextSegments.length > 0 || contextOverflowCount > 0,
      description: showDescription,
      footerRail: footerRail.length > 0,
      heroSku: showHeroSku && Boolean(heroSkuLabel),
    },
  };
}
