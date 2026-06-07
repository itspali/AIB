import { normalizeCatalogQuantityField } from "@/lib/products/catalog-reserved-fields";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type StockStatusResult = {
  label: string;
  status: StockStatus;
};

export type ResolveStockStatusInput = {
  stockOnHand: string | null | undefined;
  reorderPoint?: string | null | undefined;
  belowReorder?: boolean | null | undefined;
};

function parseNonNegativeQty(value: string | null | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function isBelowReorderThreshold(
  stockOnHand: string | number | null | undefined,
  reorderPoint: string | null | undefined
): boolean {
  const stock = parseNonNegativeQty(stockOnHand == null ? null : String(stockOnHand));
  const reorder = parseNonNegativeQty(normalizeCatalogQuantityField(reorderPoint ?? ""));
  if (stock == null || reorder == null || reorder <= 0) return false;
  return stock > 0 && stock <= reorder;
}

export function valuationsBelowReorder(
  valuations: ReadonlyArray<{ total_quantity_on_hand: string }>,
  reorderPoint: string | null | undefined
): boolean {
  const reorder = parseNonNegativeQty(normalizeCatalogQuantityField(reorderPoint ?? ""));
  if (reorder == null || reorder <= 0) return false;
  return valuations.some((row) => {
    const onHand = parseNonNegativeQty(row.total_quantity_on_hand);
    return onHand != null && onHand > 0 && onHand <= reorder;
  });
}

export function resolveStockStatus(input: ResolveStockStatusInput): StockStatusResult | null {
  const qty = input.stockOnHand;
  if (qty == null || qty.trim() === "") return null;

  const parsed = Number(qty);
  if (!Number.isFinite(parsed)) {
    return { label: qty, status: "in_stock" };
  }

  if (parsed <= 0) {
    return { label: "Out of stock", status: "out_of_stock" };
  }

  const belowFromView = input.belowReorder === true;
  const belowFromReorder =
    input.belowReorder == null && isBelowReorderThreshold(parsed, input.reorderPoint);

  if (belowFromView || belowFromReorder) {
    return {
      label: `${parsed.toLocaleString()} in stock`,
      status: "low_stock",
    };
  }

  return {
    label: `${parsed.toLocaleString()} in stock`,
    status: "in_stock",
  };
}
