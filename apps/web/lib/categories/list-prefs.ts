import {
  getDefaultListColumnPrefs,
  getOrderedVisibleColumns as getOrderedVisibleListColumns,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { DEVICE_CLASSES, type DeviceClass } from "@/lib/layout/device-class";
import {
  CATEGORY_LIST_COLUMN_REGISTRY,
  type CategoryListColumnId,
} from "@/lib/categories/list-columns";
import {
  DEFAULT_CATEGORY_LIST_SORT_DIRECTION,
  DEFAULT_CATEGORY_LIST_SORT_FIELD,
  isCategoryListSortField,
  type CategoryListSortDirection,
  type CategoryListSortField,
} from "@/lib/categories/list-sort";

export type { DeviceClass } from "@/lib/layout/device-class";

export type CategoryListViewMode = "tree" | "table";

export const CATEGORY_TABLE_VIEW_MODES: CategoryListViewMode[] = ["table"];

export function isCategoryTableLikeViewMode(viewMode: CategoryListViewMode): boolean {
  return viewMode === "table";
}

export type CategoryListFrozenColumnCount = 0 | 1 | 2 | 3;

export const AUTO_LAYOUT_PREF = "auto" as const;
export type FrozenColumnPref = CategoryListFrozenColumnCount | typeof AUTO_LAYOUT_PREF;

export const CATEGORY_LIST_PREFS_VERSION = 4;

export type CategoryListColumnPrefsByContext = Record<
  "table",
  Record<DeviceClass, ListColumnPrefs<CategoryListColumnId>>
>;

export type CategoryListPrefs = {
  prefsVersion: number;
  viewMode: CategoryListViewMode;
  columnPrefs: CategoryListColumnPrefsByContext;
  sortField: CategoryListSortField;
  sortDirection: CategoryListSortDirection;
  frozenColumnCount: FrozenColumnPref;
};

const TABLE_MOBILE_VISIBLE: CategoryListColumnId[] = [
  "name",
  "parent_name",
  "is_active",
  "item_count",
];

const TABLE_TABLET_VISIBLE: CategoryListColumnId[] = [
  "name",
  "parent_name",
  "is_active",
  "item_count",
  "updated_at",
];

function buildContextPrefs(visibleIds: CategoryListColumnId[]): ListColumnPrefs<CategoryListColumnId> {
  const defaults = getDefaultListColumnPrefs(CATEGORY_LIST_COLUMN_REGISTRY);
  const visibleSet = new Set(visibleIds);
  return normalizeListColumnPrefs(CATEGORY_LIST_COLUMN_REGISTRY, {
    columnOrder: defaults.columnOrder,
    visibleColumns: defaults.columnOrder.filter((id) => visibleSet.has(id)),
  });
}

export function getAutoFrozenColumnCount(deviceClass: DeviceClass): CategoryListFrozenColumnCount {
  switch (deviceClass) {
    case "mobile":
      return 0;
    case "tablet":
      return 1;
    case "desktop":
      return 2;
  }
}

export function resolveFrozenColumnCount(
  prefs: CategoryListPrefs,
  deviceClass: DeviceClass
): CategoryListFrozenColumnCount {
  if (deviceClass === "mobile") return 0;
  if (prefs.frozenColumnCount === AUTO_LAYOUT_PREF) {
    return getAutoFrozenColumnCount(deviceClass);
  }
  return prefs.frozenColumnCount;
}

function cloneColumnPrefsSlice(
  slice: ListColumnPrefs<CategoryListColumnId>
): ListColumnPrefs<CategoryListColumnId> {
  return normalizeListColumnPrefs(CATEGORY_LIST_COLUMN_REGISTRY, {
    columnOrder: [...slice.columnOrder],
    visibleColumns: [...slice.visibleColumns],
    columnWidths: slice.columnWidths ? { ...slice.columnWidths } : undefined,
    columnWrapModes: slice.columnWrapModes ? { ...slice.columnWrapModes } : undefined,
  });
}

function cloneDeviceColumnPrefs(
  source: Record<DeviceClass, ListColumnPrefs<CategoryListColumnId>>
): Record<DeviceClass, ListColumnPrefs<CategoryListColumnId>> {
  return {
    mobile: cloneColumnPrefsSlice(source.mobile),
    tablet: cloneColumnPrefsSlice(source.tablet),
    desktop: cloneColumnPrefsSlice(source.desktop),
  };
}

export function getDefaultCategoryListColumnPrefsByContext(): CategoryListColumnPrefsByContext {
  const desktopTable = getDefaultListColumnPrefs(CATEGORY_LIST_COLUMN_REGISTRY);
  const table = {
    desktop: desktopTable,
    tablet: buildContextPrefs(TABLE_TABLET_VISIBLE),
    mobile: buildContextPrefs(TABLE_MOBILE_VISIBLE),
  };
  return { table };
}

function parseFrozenColumnCount(value: unknown): FrozenColumnPref {
  if (value === AUTO_LAYOUT_PREF) return AUTO_LAYOUT_PREF;
  if (value === 1 || value === 2 || value === 3) return value;
  return AUTO_LAYOUT_PREF;
}

function parseViewMode(value: unknown): CategoryListViewMode {
  if (value === "table" || value === "tree") return value;
  if (value === "compact" || value === "list") return "table";
  return "tree";
}

function normalizeStoredColumnPrefs(
  raw: unknown,
  defaults: CategoryListColumnPrefsByContext
): CategoryListColumnPrefsByContext {
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Partial<CategoryListColumnPrefsByContext> & {
    compact?: Record<DeviceClass, ListColumnPrefs<CategoryListColumnId>>;
  };
  if (record.table) {
    return { table: cloneDeviceColumnPrefs(record.table) };
  }
  if (record.compact) {
    return { table: cloneDeviceColumnPrefs(record.compact) };
  }
  return defaults;
}

export function getDefaultCategoryListPrefs(): CategoryListPrefs {
  return {
    prefsVersion: CATEGORY_LIST_PREFS_VERSION,
    viewMode: "tree",
    sortField: DEFAULT_CATEGORY_LIST_SORT_FIELD,
    sortDirection: DEFAULT_CATEGORY_LIST_SORT_DIRECTION,
    frozenColumnCount: AUTO_LAYOUT_PREF,
    columnPrefs: getDefaultCategoryListColumnPrefsByContext(),
  };
}

export function coerceCategoryListPrefs(raw: unknown): CategoryListPrefs {
  const defaults = getDefaultCategoryListPrefs();
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Record<string, unknown>;

  const sortFieldRaw = record.sortField;
  const sortField =
    typeof sortFieldRaw === "string" && isCategoryListSortField(sortFieldRaw)
      ? sortFieldRaw
      : defaults.sortField;

  const sortDirection =
    record.sortDirection === "desc" ? "desc" : defaults.sortDirection;

  const columnPrefs = normalizeStoredColumnPrefs(record.columnPrefs, defaults.columnPrefs);

  return {
    prefsVersion: CATEGORY_LIST_PREFS_VERSION,
    viewMode: parseViewMode(record.viewMode),
    sortField,
    sortDirection,
    frozenColumnCount: parseFrozenColumnCount(record.frozenColumnCount),
    columnPrefs,
  };
}

export function loadCategoryListPrefs(): CategoryListPrefs {
  if (typeof window === "undefined") return getDefaultCategoryListPrefs();
  try {
    const stored = localStorage.getItem(CATEGORY_LIST_COLUMN_REGISTRY.storageKey);
    if (!stored) return getDefaultCategoryListPrefs();
    return coerceCategoryListPrefs(JSON.parse(stored));
  } catch {
    return getDefaultCategoryListPrefs();
  }
}

export function saveCategoryListPrefs(prefs: CategoryListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      CATEGORY_LIST_COLUMN_REGISTRY.storageKey,
      JSON.stringify({ ...prefs, prefsVersion: CATEGORY_LIST_PREFS_VERSION })
    );
  } catch {
    /* ignore */
  }
}

export function getColumnPrefsSlice(
  prefs: CategoryListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<CategoryListColumnId> {
  return prefs.columnPrefs.table[deviceClass];
}

export function setColumnPrefsSlice(
  prefs: CategoryListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<CategoryListColumnId>
): CategoryListPrefs {
  return {
    ...prefs,
    columnPrefs: {
      table: {
        ...prefs.columnPrefs.table,
        [deviceClass]: slice,
      },
    },
  };
}

/** Applies the same column prefs to every device breakpoint (split-feed unified columns). */
export function setColumnPrefsSliceAllDevices(
  prefs: CategoryListPrefs,
  slice: ListColumnPrefs<CategoryListColumnId>
): CategoryListPrefs {
  let next = prefs;
  for (const deviceClass of DEVICE_CLASSES) {
    next = setColumnPrefsSlice(next, deviceClass, slice);
  }
  return next;
}

export function getOrderedVisibleColumns(
  prefs: CategoryListPrefs,
  deviceClass: DeviceClass
): CategoryListColumnId[] {
  return getOrderedVisibleListColumns(getColumnPrefsSlice(prefs, deviceClass));
}

export function setColumnWidthSlice(
  prefs: CategoryListPrefs,
  deviceClass: DeviceClass,
  columnId: CategoryListColumnId,
  width: number | null
): CategoryListPrefs {
  const slice = getColumnPrefsSlice(prefs, deviceClass);
  const columnWidths = { ...(slice.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId];
  } else {
    columnWidths[columnId] = width;
  }
  return setColumnPrefsSlice(prefs, deviceClass, {
    ...slice,
    columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
  });
}

export const CATEGORY_LIST_PREFS_STORAGE_KEY = CATEGORY_LIST_COLUMN_REGISTRY.storageKey;
