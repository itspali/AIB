import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

export const CARD_CONTEXT_SEGMENT_CAP = 3;
export const CARD_DETAIL_ROW_CAP = 4;

const HERO_CONTEXT_ORDER: ProductListColumnId[] = [
  "default_sku",
  "category_name",
  "classification",
  "barcode",
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

export type CardLayoutMetricField = {
  columnId: ProductListColumnId;
  label: string;
  value: string;
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

export type CardLayoutPlan = {
  hero: {
    showImage: boolean;
    showTitle: boolean;
    showDescription: boolean;
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
  metaLine: string | null;
  shop: {
    category: string | null;
    showCategory: boolean;
    sellingPrice: string | null;
    showSellingPrice: boolean;
    comparePrice: string | null;
    showComparePrice: boolean;
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
  };
};

function columnVisible(columns: ProductListColumnId[], id: ProductListColumnId): boolean {
  return columns.includes(id);
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
  showVariants: boolean
): { visible: CardContextSegment[]; overflowCount: number } {
  const presentation = resolveProductListRowPresentation(product, showVariants);

  if (presentation.isExpandedVariantRow) {
    return { visible: [], overflowCount: 0 };
  }

  const all: CardContextSegment[] = [];
  for (const columnId of HERO_CONTEXT_ORDER) {
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

function resolveStockStatus(
  qty: string | null | undefined
): { label: string; status: "in_stock" | "low_stock" | "out_of_stock" } | null {
  if (qty == null || qty.trim() === "") return null;
  const parsed = Number(qty);
  if (!Number.isFinite(parsed)) return { label: qty, status: "in_stock" };
  if (parsed <= 0) return { label: "Out of stock", status: "out_of_stock" };
  if (parsed <= 5) return { label: `${parsed.toLocaleString()} in stock`, status: "low_stock" };
  return { label: `${parsed.toLocaleString()} in stock`, status: "in_stock" };
}

function buildShopBlock(
  columns: ProductListColumnId[],
  product: ProductListRow,
  showVariants: boolean,
  presentation: ReturnType<typeof resolveProductListRowPresentation>
) {
  const showCategory = columnVisible(columns, "category_name");
  const showSelling = columnVisible(columns, "selling_price");
  const showCompare = columnVisible(columns, "purchase_price");
  const showStock = columnVisible(columns, "stock_on_hand");
  const showSku = columnVisible(columns, "default_sku");

  const stock = showStock ? resolveStockStatus(product.stock_on_hand) : null;
  const skuRaw =
    presentation.isExpandedVariantRow && presentation.displaySku?.trim()
      ? presentation.displaySku.trim()
      : showSku
        ? formatCardFieldValue("default_sku", product, showVariants)
        : null;

  return {
    category: showCategory ? formatCardFieldValue("category_name", product, showVariants) : null,
    showCategory,
    sellingPrice: showSelling
      ? formatCardFieldValue("selling_price", product, showVariants)
      : null,
    showSellingPrice: showSelling,
    comparePrice: showCompare
      ? formatCardFieldValue("purchase_price", product, showVariants)
      : null,
    showComparePrice: showCompare,
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
  const { visible: contextSegments, overflowCount: contextOverflowCount } = buildContextSegments(
    columns,
    product,
    showVariants
  );

  const metrics: CardLayoutMetricField[] = [];
  for (const columnId of METRIC_ORDER) {
    if (!columnVisible(columns, columnId)) continue;
    if (!cardFieldHasDisplayValue(columnId, product, showVariants)) continue;
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
    metaLine,
    shop: buildShopBlock(columns, product, showVariants, presentation),
    regions: {
      metrics: metrics.length > 0,
      details: details.length > 0 || detailOverflow.length > 0,
      flags: flags.length > 0,
      meta: metaLine != null,
      heroContext: contextSegments.length > 0 || contextOverflowCount > 0,
      description: showDescription,
    },
  };
}
