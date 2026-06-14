import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import {
  SO_LIST_COLUMN_REGISTRY,
  type SalesOrderListColumnId,
} from "@/lib/sales/orders/list-columns";
import {
  DEFAULT_SO_SORT_DIRECTION,
  DEFAULT_SO_SORT_FIELD,
  type SalesOrderListSortDirection,
  type SalesOrderListSortField,
} from "@/lib/sales/orders/list-sort";
import type { SalesOrderStatus } from "@/lib/sales/orders/types";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:sales-so-list-prefs";
const PREFS_VERSION = 1;

export type SalesOrderListPrefs = {
  status: SalesOrderStatus | "all";
  locationId: string | null;
  sortField: SalesOrderListSortField;
  sortDirection: SalesOrderListSortDirection;
  columnPrefs: ListColumnPrefs<SalesOrderListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultSalesOrderListPrefs(): SalesOrderListPrefs {
  return {
    status: "all",
    locationId: null,
    sortField: DEFAULT_SO_SORT_FIELD,
    sortDirection: DEFAULT_SO_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(SO_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

function isSalesOrderSortField(value: string): value is SalesOrderListSortField {
  return (SO_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadSalesOrderListPrefs(): SalesOrderListPrefs {
  const defaults = getDefaultSalesOrderListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(SO_LIST_COLUMN_REGISTRY),
      };
    }

    const parsed = JSON.parse(raw) as Partial<SalesOrderListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isSalesOrderSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(SO_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(SO_LIST_COLUMN_REGISTRY);

    return {
      status: parsed.status ?? "all",
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

export function saveSalesOrderListPrefs(prefs: SalesOrderListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(SO_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setSalesOrderColumnWidth(
  prefs: SalesOrderListPrefs,
  columnId: SalesOrderListColumnId,
  width: number | null
): SalesOrderListPrefs {
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
