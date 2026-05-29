import {
  getDefaultColumnOrder,
  getDefaultVisibleColumns,
  PRODUCT_LIST_COLUMN_IDS,
  type ProductListColumnId,
} from "@/lib/products/list-columns";

const STORAGE_KEY = "aib-product-list-prefs";

export type ProductListViewMode = "table" | "compact";

export type ProductListPrefs = {
  viewMode: ProductListViewMode;
  columnOrder: ProductListColumnId[];
  visibleColumns: ProductListColumnId[];
};

function isColumnId(value: string): value is ProductListColumnId {
  return (PRODUCT_LIST_COLUMN_IDS as readonly string[]).includes(value);
}

export function getDefaultProductListPrefs(): ProductListPrefs {
  return {
    viewMode: "table",
    columnOrder: getDefaultColumnOrder(),
    visibleColumns: getDefaultVisibleColumns(),
  };
}

export function loadProductListPrefs(): ProductListPrefs {
  const defaults = getDefaultProductListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<ProductListPrefs>;
    const columnOrder = (parsed.columnOrder ?? defaults.columnOrder).filter(isColumnId);
    const visibleColumns = (parsed.visibleColumns ?? defaults.visibleColumns).filter(isColumnId);
    const viewMode = parsed.viewMode === "compact" ? "compact" : "table";

    const orderSet = new Set(columnOrder);
    for (const id of PRODUCT_LIST_COLUMN_IDS) {
      if (!orderSet.has(id)) columnOrder.push(id);
    }

    return {
      viewMode,
      columnOrder,
      visibleColumns: visibleColumns.length ? visibleColumns : defaults.visibleColumns,
    };
  } catch {
    return defaults;
  }
}

export function saveProductListPrefs(prefs: ProductListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

export function getOrderedVisibleColumns(prefs: ProductListPrefs): ProductListColumnId[] {
  const visible = new Set(prefs.visibleColumns);
  return prefs.columnOrder.filter((id) => visible.has(id));
}
