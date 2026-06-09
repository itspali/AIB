import {
  getDefaultListColumnPrefs,
  getOrderedVisibleColumns as getOrderedVisibleListColumns,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { DEVICE_CLASSES, type DeviceClass } from "@/lib/layout/device-class";
import {
  getEntityCategoryListColumnRegistry,
  type EntityCategoryListColumnId,
} from "@/lib/entity-categories/list-columns";
import {
  DEFAULT_ENTITY_CATEGORY_LIST_SORT_DIRECTION,
  DEFAULT_ENTITY_CATEGORY_LIST_SORT_FIELD,
  isEntityCategoryListSortField,
  type EntityCategoryListSortDirection,
  type EntityCategoryListSortField,
} from "@/lib/entity-categories/list-sort";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

export type { DeviceClass } from "@/lib/layout/device-class";

export type EntityCategoryListViewMode = "tree" | "table" | "compact";

export const ENTITY_CATEGORY_TABLE_VIEW_MODES: EntityCategoryListViewMode[] = ["table", "compact"];

export function isEntityCategoryTableLikeViewMode(
  viewMode: EntityCategoryListViewMode
): boolean {
  return viewMode === "table" || viewMode === "compact";
}

export type EntityCategoryListFrozenColumnCount = 0 | 1 | 2 | 3;

export const AUTO_LAYOUT_PREF = "auto" as const;
export type FrozenColumnPref = EntityCategoryListFrozenColumnCount | typeof AUTO_LAYOUT_PREF;

export const ENTITY_CATEGORY_LIST_PREFS_VERSION = 1;

export type EntityCategoryTableViewMode = "table" | "compact";

export type EntityCategoryListColumnPrefsByContext = Record<
  EntityCategoryTableViewMode,
  Record<DeviceClass, ListColumnPrefs<EntityCategoryListColumnId>>
>;

export type EntityCategoryListPrefs = {
  prefsVersion: number;
  viewMode: EntityCategoryListViewMode;
  columnPrefs: EntityCategoryListColumnPrefsByContext;
  sortField: EntityCategoryListSortField;
  sortDirection: EntityCategoryListSortDirection;
  frozenColumnCount: FrozenColumnPref;
};

const TABLE_MOBILE_VISIBLE: EntityCategoryListColumnId[] = [
  "name",
  "parent_name",
  "is_active",
  "entity_count",
];

const TABLE_TABLET_VISIBLE: EntityCategoryListColumnId[] = [
  "name",
  "parent_name",
  "is_active",
  "entity_count",
  "updated_at",
];

function buildContextPrefs(
  workspace: EntityCategoryWorkspace,
  visibleIds: EntityCategoryListColumnId[]
): ListColumnPrefs<EntityCategoryListColumnId> {
  const registry = getEntityCategoryListColumnRegistry(workspace);
  const defaults = getDefaultListColumnPrefs(registry);
  const visibleSet = new Set(visibleIds);
  return normalizeListColumnPrefs(registry, {
    columnOrder: defaults.columnOrder,
    visibleColumns: defaults.columnOrder.filter((id) => visibleSet.has(id)),
  });
}

export function getAutoFrozenColumnCount(
  deviceClass: DeviceClass
): EntityCategoryListFrozenColumnCount {
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
  prefs: EntityCategoryListPrefs,
  deviceClass: DeviceClass
): EntityCategoryListFrozenColumnCount {
  if (deviceClass === "mobile") return 0;
  if (prefs.frozenColumnCount === AUTO_LAYOUT_PREF) {
    return getAutoFrozenColumnCount(deviceClass);
  }
  return prefs.frozenColumnCount;
}

function cloneColumnPrefsSlice(
  workspace: EntityCategoryWorkspace,
  slice: ListColumnPrefs<EntityCategoryListColumnId>
): ListColumnPrefs<EntityCategoryListColumnId> {
  const registry = getEntityCategoryListColumnRegistry(workspace);
  return normalizeListColumnPrefs(registry, {
    columnOrder: [...slice.columnOrder],
    visibleColumns: [...slice.visibleColumns],
    columnWidths: slice.columnWidths ? { ...slice.columnWidths } : undefined,
    columnWrapModes: slice.columnWrapModes ? { ...slice.columnWrapModes } : undefined,
  });
}

function cloneDeviceColumnPrefs(
  workspace: EntityCategoryWorkspace,
  source: Record<DeviceClass, ListColumnPrefs<EntityCategoryListColumnId>>
): Record<DeviceClass, ListColumnPrefs<EntityCategoryListColumnId>> {
  return {
    mobile: cloneColumnPrefsSlice(workspace, source.mobile),
    tablet: cloneColumnPrefsSlice(workspace, source.tablet),
    desktop: cloneColumnPrefsSlice(workspace, source.desktop),
  };
}

export function getDefaultEntityCategoryListColumnPrefsByContext(
  workspace: EntityCategoryWorkspace
): EntityCategoryListColumnPrefsByContext {
  const registry = getEntityCategoryListColumnRegistry(workspace);
  const desktopTable = getDefaultListColumnPrefs(registry);
  const table = {
    desktop: desktopTable,
    tablet: buildContextPrefs(workspace, TABLE_TABLET_VISIBLE),
    mobile: buildContextPrefs(workspace, TABLE_MOBILE_VISIBLE),
  };
  return {
    table,
    compact: cloneDeviceColumnPrefs(workspace, table),
  };
}

function parseFrozenColumnCount(value: unknown): FrozenColumnPref {
  if (value === AUTO_LAYOUT_PREF) return AUTO_LAYOUT_PREF;
  if (value === 1 || value === 2 || value === 3) return value;
  return AUTO_LAYOUT_PREF;
}

function parseViewMode(value: unknown): EntityCategoryListViewMode {
  if (value === "table" || value === "compact" || value === "tree") return value;
  if (value === "list") return "table";
  return "tree";
}

export function getDefaultEntityCategoryListPrefs(
  workspace: EntityCategoryWorkspace
): EntityCategoryListPrefs {
  return {
    prefsVersion: ENTITY_CATEGORY_LIST_PREFS_VERSION,
    viewMode: "tree",
    sortField: DEFAULT_ENTITY_CATEGORY_LIST_SORT_FIELD,
    sortDirection: DEFAULT_ENTITY_CATEGORY_LIST_SORT_DIRECTION,
    frozenColumnCount: AUTO_LAYOUT_PREF,
    columnPrefs: getDefaultEntityCategoryListColumnPrefsByContext(workspace),
  };
}

export function coerceEntityCategoryListPrefs(
  workspace: EntityCategoryWorkspace,
  raw: unknown
): EntityCategoryListPrefs {
  const defaults = getDefaultEntityCategoryListPrefs(workspace);
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Record<string, unknown>;

  const sortFieldRaw = record.sortField;
  const sortField =
    typeof sortFieldRaw === "string" && isEntityCategoryListSortField(sortFieldRaw)
      ? sortFieldRaw
      : defaults.sortField;

  const sortDirection = record.sortDirection === "desc" ? "desc" : defaults.sortDirection;

  let columnPrefs = defaults.columnPrefs;
  if (record.columnPrefs && typeof record.columnPrefs === "object") {
    columnPrefs = record.columnPrefs as EntityCategoryListColumnPrefsByContext;
  }

  return {
    prefsVersion: ENTITY_CATEGORY_LIST_PREFS_VERSION,
    viewMode: parseViewMode(record.viewMode),
    sortField,
    sortDirection,
    frozenColumnCount: parseFrozenColumnCount(record.frozenColumnCount),
    columnPrefs,
  };
}

export function loadEntityCategoryListPrefs(
  workspace: EntityCategoryWorkspace
): EntityCategoryListPrefs {
  if (typeof window === "undefined") return getDefaultEntityCategoryListPrefs(workspace);
  try {
    const storageKey = getEntityCategoryListColumnRegistry(workspace).storageKey;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return getDefaultEntityCategoryListPrefs(workspace);
    return coerceEntityCategoryListPrefs(workspace, JSON.parse(stored));
  } catch {
    return getDefaultEntityCategoryListPrefs(workspace);
  }
}

export function saveEntityCategoryListPrefs(
  workspace: EntityCategoryWorkspace,
  prefs: EntityCategoryListPrefs
): void {
  if (typeof window === "undefined") return;
  try {
    const storageKey = getEntityCategoryListColumnRegistry(workspace).storageKey;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...prefs, prefsVersion: ENTITY_CATEGORY_LIST_PREFS_VERSION })
    );
  } catch {
    /* ignore */
  }
}

export function getColumnPrefsSlice(
  prefs: EntityCategoryListPrefs,
  viewMode: EntityCategoryTableViewMode,
  deviceClass: DeviceClass
): ListColumnPrefs<EntityCategoryListColumnId> {
  return prefs.columnPrefs[viewMode][deviceClass];
}

export function setColumnPrefsSlice(
  prefs: EntityCategoryListPrefs,
  viewMode: EntityCategoryTableViewMode,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<EntityCategoryListColumnId>
): EntityCategoryListPrefs {
  return {
    ...prefs,
    columnPrefs: {
      ...prefs.columnPrefs,
      [viewMode]: {
        ...prefs.columnPrefs[viewMode],
        [deviceClass]: slice,
      },
    },
  };
}

export function getOrderedVisibleColumns(
  workspace: EntityCategoryWorkspace,
  prefs: EntityCategoryListPrefs,
  viewMode: EntityCategoryTableViewMode,
  deviceClass: DeviceClass
): EntityCategoryListColumnId[] {
  return getOrderedVisibleListColumns(getColumnPrefsSlice(prefs, viewMode, deviceClass));
}

export function setColumnWidthSlice(
  prefs: EntityCategoryListPrefs,
  viewMode: EntityCategoryTableViewMode,
  deviceClass: DeviceClass,
  columnId: EntityCategoryListColumnId,
  width: number | null
): EntityCategoryListPrefs {
  const slice = getColumnPrefsSlice(prefs, viewMode, deviceClass);
  const columnWidths = { ...(slice.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId];
  } else {
    columnWidths[columnId] = width;
  }
  return setColumnPrefsSlice(prefs, viewMode, deviceClass, {
    ...slice,
    columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
  });
}

export { DEVICE_CLASSES };
