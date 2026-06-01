import type { ProductFormMode } from "@/lib/products/use-product-form";

export const ITEMS_HREF = "/inventory/items";

export const ITEM_CATALOG_ORIGIN_PARAM = "from";
export const ITEM_CATALOG_ORIGIN_VALUE = "catalog";
export const ITEM_LIST_SELECTION_PARAM = "item";

export function isCatalogPopOutOrigin(searchParams: Pick<URLSearchParams, "get">): boolean {
  return searchParams.get(ITEM_CATALOG_ORIGIN_PARAM) === ITEM_CATALOG_ORIGIN_VALUE;
}

export function itemListReturnHref(itemId?: string | null): string {
  if (itemId) {
    return `${ITEMS_HREF}?${ITEM_LIST_SELECTION_PARAM}=${encodeURIComponent(itemId)}`;
  }
  return ITEMS_HREF;
}

export function itemFullPageHref(
  mode: ProductFormMode,
  itemId?: string | null,
  options?: { fromCatalog?: boolean }
): string {
  let path = ITEMS_HREF;

  if (mode === "create") {
    path = `${ITEMS_HREF}/new`;
  } else if (itemId) {
    path = mode === "edit" ? `${ITEMS_HREF}/${itemId}/edit` : `${ITEMS_HREF}/${itemId}`;
  }

  if (!options?.fromCatalog) return path;
  return `${path}?${ITEM_CATALOG_ORIGIN_PARAM}=${ITEM_CATALOG_ORIGIN_VALUE}`;
}

export function resolveItemFormBackHref(
  mode: ProductFormMode,
  itemId: string | undefined,
  fromCatalog: boolean
): string {
  if (fromCatalog) {
    return itemListReturnHref(itemId);
  }
  if (mode === "edit" && itemId) {
    return `${ITEMS_HREF}/${itemId}`;
  }
  return ITEMS_HREF;
}

export function resolveItemFormBackLabel(fromCatalog: boolean, mode: ProductFormMode): string {
  if (fromCatalog) return "Back to items";
  if (mode === "edit") return "Back to item";
  return "Back";
}
