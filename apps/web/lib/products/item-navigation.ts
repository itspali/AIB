import type { ProductFormMode } from "@/lib/products/use-product-form";
import {
  buildModuleHref,
  LEGACY_ITEM_LIST_SELECTION_PARAM,
  moduleDrawerCreateHref,
  moduleDrawerEditHref,
  moduleDrawerPeekHref,
  type PreservedQueryParams,
} from "@/lib/layout/module-drawer-url";

export const ITEMS_HREF = "/inventory/items";

export const ITEM_CATALOG_ORIGIN_PARAM = "from";
export const ITEM_CATALOG_ORIGIN_VALUE = "catalog";

/** @deprecated Use `id` query param — kept for imports that reference the legacy name. */
export const ITEM_LIST_SELECTION_PARAM = LEGACY_ITEM_LIST_SELECTION_PARAM;

export function isCatalogPopOutOrigin(searchParams: Pick<URLSearchParams, "get">): boolean {
  return searchParams.get(ITEM_CATALOG_ORIGIN_PARAM) === ITEM_CATALOG_ORIGIN_VALUE;
}

export function itemPeekHref(
  itemId: string,
  preserveParams?: URLSearchParams | PreservedQueryParams
): string {
  return moduleDrawerPeekHref(ITEMS_HREF, itemId, preserveParams);
}

export function itemEditHref(
  itemId: string,
  preserveParams?: URLSearchParams | PreservedQueryParams
): string {
  return moduleDrawerEditHref(ITEMS_HREF, itemId, preserveParams);
}

export function itemCreateHref(
  preserveParams?: URLSearchParams | PreservedQueryParams
): string {
  return moduleDrawerCreateHref(ITEMS_HREF, preserveParams);
}

export function itemListReturnHref(itemId?: string | null): string {
  return buildModuleHref(ITEMS_HREF, { recordId: itemId ?? null });
}

export function itemFullPageHref(
  mode: ProductFormMode,
  itemId?: string | null,
  options?: { fromCatalog?: boolean }
): string {
  let path = ITEMS_HREF;

  if (mode === "create") {
    return itemCreateHref();
  }
  if (itemId) {
    if (mode === "edit") {
      path = itemEditHref(itemId);
    } else {
      path = itemPeekHref(itemId);
    }
  }

  if (!options?.fromCatalog) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${ITEM_CATALOG_ORIGIN_PARAM}=${ITEM_CATALOG_ORIGIN_VALUE}`;
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
    return itemPeekHref(itemId);
  }
  return ITEMS_HREF;
}

export function resolveItemFormBackLabel(fromCatalog: boolean, mode: ProductFormMode): string {
  if (fromCatalog) return "Back to items";
  if (mode === "edit") return "Back to item";
  return "Back";
}
