import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import {
  GRN_LIST_COLUMN_REGISTRY,
  type GoodsReceiptListColumnId,
} from "@/lib/procurement/goods-receipts/list-columns";
import {
  DEFAULT_GRN_SORT_DIRECTION,
  DEFAULT_GRN_SORT_FIELD,
  type GoodsReceiptListSortDirection,
  type GoodsReceiptListSortField,
} from "@/lib/procurement/goods-receipts/list-sort";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:procurement-grn-list-prefs";
const PREFS_VERSION = 2;

export type GoodsReceiptListPrefs = {
  locationId: string | null;
  sortField: GoodsReceiptListSortField;
  sortDirection: GoodsReceiptListSortDirection;
  columnPrefs: ListColumnPrefs<GoodsReceiptListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultGoodsReceiptListPrefs(): GoodsReceiptListPrefs {
  return {
    locationId: null,
    sortField: DEFAULT_GRN_SORT_FIELD,
    sortDirection: DEFAULT_GRN_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(GRN_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

function isGoodsReceiptSortField(value: string): value is GoodsReceiptListSortField {
  return (GRN_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadGoodsReceiptListPrefs(): GoodsReceiptListPrefs {
  const defaults = getDefaultGoodsReceiptListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(GRN_LIST_COLUMN_REGISTRY),
      };
    }

    const parsed = JSON.parse(raw) as Partial<GoodsReceiptListPrefs> & { prefsVersion?: number };
    const sortField =
      typeof parsed.sortField === "string" && isGoodsReceiptSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs =
      parsed.prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(GRN_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(GRN_LIST_COLUMN_REGISTRY);

    return {
      locationId: parsed.locationId ?? null,
      sortField,
      sortDirection,
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function saveGoodsReceiptListPrefs(prefs: GoodsReceiptListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(GRN_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setGoodsReceiptColumnWidth(
  prefs: GoodsReceiptListPrefs,
  columnId: GoodsReceiptListColumnId,
  width: number | null
): GoodsReceiptListPrefs {
  const columnWidths = { ...(prefs.columnPrefs.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId];
  } else {
    columnWidths[columnId] = width;
  }
  return {
    ...prefs,
    columnPrefs: {
      ...prefs.columnPrefs,
      columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
    },
  };
}
