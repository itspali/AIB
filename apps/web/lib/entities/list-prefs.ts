import {
  getDefaultListColumnPrefs,
  getOrderedVisibleColumns as getOrderedVisibleListColumns,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  getEntityListColumnRegistry,
  type EntityListColumnId,
  type EntityListColumnRegistryKey,
} from "@/lib/entities/list-columns";
import {
  DEFAULT_ENTITY_LIST_SORT_DIRECTION,
  DEFAULT_ENTITY_LIST_SORT_FIELD,
  isEntityListSortField,
  type EntityListSortDirection,
  type EntityListSortField,
} from "@/lib/entities/list-sort";

export type { DeviceClass } from "@/lib/layout/device-class";

export type EntityListViewMode = "table" | "compact";

export const ENTITY_TABLE_VIEW_MODES: EntityListViewMode[] = ["table", "compact"];

export function isEntityTableLikeViewMode(viewMode: EntityListViewMode): boolean {
  return viewMode === "table" || viewMode === "compact";
}

export type EntityListFrozenColumnCount = 0 | 1 | 2 | 3;

export const AUTO_LAYOUT_PREF = "auto" as const;
export type FrozenColumnPref = EntityListFrozenColumnCount | typeof AUTO_LAYOUT_PREF;

export const ENTITY_LIST_PREFS_VERSION = 1;

export type EntityListColumnPrefsByContext = Record<
  EntityListViewMode,
  Record<DeviceClass, ListColumnPrefs<EntityListColumnId>>
>;

export type EntityListPrefs = {
  prefsVersion: number;
  viewMode: EntityListViewMode;
  columnPrefs: EntityListColumnPrefsByContext;
  sortField: EntityListSortField;
  sortDirection: EntityListSortDirection;
  frozenColumnCount: FrozenColumnPref;
};

const TABLE_MOBILE_VISIBLE: EntityListColumnId[] = [
  "name",
  "code",
  "primary_contact_name",
  "is_active",
];

const TABLE_TABLET_VISIBLE: EntityListColumnId[] = [
  "name",
  "code",
  "primary_contact_name",
  "payment_terms_days",
  "is_active",
  "updated_at",
];

function buildContextPrefs(
  registryKey: EntityListColumnRegistryKey,
  visibleIds: EntityListColumnId[]
): ListColumnPrefs<EntityListColumnId> {
  const registry = getEntityListColumnRegistry(registryKey);
  const defaults = getDefaultListColumnPrefs(registry);
  const visibleSet = new Set(visibleIds);
  return normalizeListColumnPrefs(registry, {
    columnOrder: defaults.columnOrder,
    visibleColumns: defaults.columnOrder.filter((id) => visibleSet.has(id)),
  });
}

export function getAutoFrozenColumnCount(deviceClass: DeviceClass): EntityListFrozenColumnCount {
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
  prefs: EntityListPrefs,
  deviceClass: DeviceClass
): EntityListFrozenColumnCount {
  if (deviceClass === "mobile") return 0;
  if (prefs.frozenColumnCount === AUTO_LAYOUT_PREF) {
    return getAutoFrozenColumnCount(deviceClass);
  }
  return prefs.frozenColumnCount;
}

function cloneColumnPrefsSlice(
  registryKey: EntityListColumnRegistryKey,
  slice: ListColumnPrefs<EntityListColumnId>
): ListColumnPrefs<EntityListColumnId> {
  const registry = getEntityListColumnRegistry(registryKey);
  return normalizeListColumnPrefs(registry, {
    columnOrder: [...slice.columnOrder],
    visibleColumns: [...slice.visibleColumns],
    columnWidths: slice.columnWidths ? { ...slice.columnWidths } : undefined,
    columnWrapModes: slice.columnWrapModes ? { ...slice.columnWrapModes } : undefined,
  });
}

function cloneDeviceColumnPrefs(
  registryKey: EntityListColumnRegistryKey,
  source: Record<DeviceClass, ListColumnPrefs<EntityListColumnId>>
): Record<DeviceClass, ListColumnPrefs<EntityListColumnId>> {
  return {
    mobile: cloneColumnPrefsSlice(registryKey, source.mobile),
    tablet: cloneColumnPrefsSlice(registryKey, source.tablet),
    desktop: cloneColumnPrefsSlice(registryKey, source.desktop),
  };
}

export function getDefaultEntityListColumnPrefsByContext(
  registryKey: EntityListColumnRegistryKey
): EntityListColumnPrefsByContext {
  const registry = getEntityListColumnRegistry(registryKey);
  const desktopTable = getDefaultListColumnPrefs(registry);
  const table = {
    desktop: desktopTable,
    tablet: buildContextPrefs(registryKey, TABLE_TABLET_VISIBLE),
    mobile: buildContextPrefs(registryKey, TABLE_MOBILE_VISIBLE),
  };
  return {
    table,
    compact: cloneDeviceColumnPrefs(registryKey, table),
  };
}

function parseFrozenColumnCount(value: unknown): FrozenColumnPref {
  if (value === AUTO_LAYOUT_PREF) return AUTO_LAYOUT_PREF;
  if (value === 1 || value === 2 || value === 3) return value;
  return AUTO_LAYOUT_PREF;
}

function parseViewMode(value: unknown): EntityListViewMode {
  if (value === "table" || value === "compact") return value;
  if (value === "list") return "table";
  return "table";
}

export function getDefaultEntityListPrefs(
  registryKey: EntityListColumnRegistryKey
): EntityListPrefs {
  return {
    prefsVersion: ENTITY_LIST_PREFS_VERSION,
    viewMode: "table",
    sortField: DEFAULT_ENTITY_LIST_SORT_FIELD,
    sortDirection: DEFAULT_ENTITY_LIST_SORT_DIRECTION,
    frozenColumnCount: AUTO_LAYOUT_PREF,
    columnPrefs: getDefaultEntityListColumnPrefsByContext(registryKey),
  };
}

export function coerceEntityListPrefs(
  registryKey: EntityListColumnRegistryKey,
  raw: unknown
): EntityListPrefs {
  const defaults = getDefaultEntityListPrefs(registryKey);
  if (!raw || typeof raw !== "object") return defaults;
  const record = raw as Record<string, unknown>;

  const sortFieldRaw = record.sortField;
  const sortField =
    typeof sortFieldRaw === "string" && isEntityListSortField(sortFieldRaw)
      ? sortFieldRaw
      : defaults.sortField;

  const sortDirection =
    record.sortDirection === "desc" ? "desc" : defaults.sortDirection;

  let columnPrefs = defaults.columnPrefs;
  if (record.columnPrefs && typeof record.columnPrefs === "object") {
    columnPrefs = record.columnPrefs as EntityListColumnPrefsByContext;
  }

  return {
    prefsVersion: ENTITY_LIST_PREFS_VERSION,
    viewMode: parseViewMode(record.viewMode),
    sortField,
    sortDirection,
    frozenColumnCount: parseFrozenColumnCount(record.frozenColumnCount),
    columnPrefs,
  };
}

export function loadEntityListPrefs(registryKey: EntityListColumnRegistryKey): EntityListPrefs {
  const registry = getEntityListColumnRegistry(registryKey);
  if (typeof window === "undefined") return getDefaultEntityListPrefs(registryKey);
  try {
    const stored = localStorage.getItem(registry.storageKey);
    if (!stored) return getDefaultEntityListPrefs(registryKey);
    return coerceEntityListPrefs(registryKey, JSON.parse(stored));
  } catch {
    return getDefaultEntityListPrefs(registryKey);
  }
}

export function saveEntityListPrefs(
  registryKey: EntityListColumnRegistryKey,
  prefs: EntityListPrefs
): void {
  const registry = getEntityListColumnRegistry(registryKey);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      registry.storageKey,
      JSON.stringify({ ...prefs, prefsVersion: ENTITY_LIST_PREFS_VERSION })
    );
  } catch {
    /* ignore */
  }
}

export function getColumnPrefsSlice(
  prefs: EntityListPrefs,
  viewMode: EntityListViewMode,
  deviceClass: DeviceClass
): ListColumnPrefs<EntityListColumnId> {
  return prefs.columnPrefs[viewMode][deviceClass];
}

export function setColumnPrefsSlice(
  prefs: EntityListPrefs,
  viewMode: EntityListViewMode,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<EntityListColumnId>
): EntityListPrefs {
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
  prefs: EntityListPrefs,
  viewMode: EntityListViewMode,
  deviceClass: DeviceClass
): EntityListColumnId[] {
  return getOrderedVisibleListColumns(getColumnPrefsSlice(prefs, viewMode, deviceClass));
}

export function setColumnWidthSlice(
  prefs: EntityListPrefs,
  viewMode: EntityListViewMode,
  deviceClass: DeviceClass,
  columnId: EntityListColumnId,
  width: number | null
): EntityListPrefs {
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

export function getEntityListPrefsStorageKey(
  registryKey: EntityListColumnRegistryKey
): string {
  return getEntityListColumnRegistry(registryKey).storageKey;
}
