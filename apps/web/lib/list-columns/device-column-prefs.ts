import {
  getDefaultListColumnPrefs,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs, ListColumnRegistry } from "@/lib/list-columns/types";
import { DEVICE_CLASSES, type DeviceClass } from "@/lib/layout/device-class";

export type TableColumnPrefsByDevice<TId extends string> = Record<
  DeviceClass,
  ListColumnPrefs<TId>
>;

function isDeviceColumnPrefsRecord<TId extends string>(
  value: unknown
): value is Partial<Record<DeviceClass, ListColumnPrefs<TId>>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return DEVICE_CLASSES.some((device) => device in value);
}

export function buildDefaultTableColumnPrefsByDevice<TId extends string>(
  registry: ListColumnRegistry<TId>,
  desktopSlice?: ListColumnPrefs<TId>
): TableColumnPrefsByDevice<TId> {
  const desktop = desktopSlice ?? getDefaultListColumnPrefs(registry);
  return {
    mobile: normalizeListColumnPrefs(registry, desktop),
    tablet: normalizeListColumnPrefs(registry, desktop),
    desktop: normalizeListColumnPrefs(registry, desktop),
  };
}

export function migrateFlatToDeviceColumnPrefs<TId extends string>(
  registry: ListColumnRegistry<TId>,
  flat: ListColumnPrefs<TId>
): TableColumnPrefsByDevice<TId> {
  return buildDefaultTableColumnPrefsByDevice(
    registry,
    normalizeListColumnPrefs(registry, flat)
  );
}

export function parseStoredTableColumnPrefsByDevice<TId extends string>(
  registry: ListColumnRegistry<TId>,
  raw: unknown,
  options: {
    minVersion: number;
    storedVersion: number;
    legacyFlat?: ListColumnPrefs<TId>;
  }
): TableColumnPrefsByDevice<TId> {
  if (
    options.storedVersion >= options.minVersion &&
    isDeviceColumnPrefsRecord<TId>(raw)
  ) {
    const fallback = options.legacyFlat ?? getDefaultListColumnPrefs(registry);
    return {
      mobile: normalizeListColumnPrefs(registry, raw.mobile ?? fallback),
      tablet: normalizeListColumnPrefs(registry, raw.tablet ?? fallback),
      desktop: normalizeListColumnPrefs(registry, raw.desktop ?? fallback),
    };
  }

  const flat = raw
    ? normalizeListColumnPrefs(registry, raw as ListColumnPrefs<TId>)
    : (options.legacyFlat ?? getDefaultListColumnPrefs(registry));
  return migrateFlatToDeviceColumnPrefs(registry, flat);
}

export function getTableColumnPrefsSlice<TId extends string>(
  store: TableColumnPrefsByDevice<TId>,
  device: DeviceClass
): ListColumnPrefs<TId> {
  return store[device];
}

export function setTableColumnPrefsSlice<TId extends string>(
  store: TableColumnPrefsByDevice<TId>,
  device: DeviceClass,
  slice: ListColumnPrefs<TId>
): TableColumnPrefsByDevice<TId> {
  return {
    ...store,
    [device]: slice,
  };
}

export function setTableColumnPrefsSliceAllDevices<TId extends string>(
  store: TableColumnPrefsByDevice<TId>,
  slice: ListColumnPrefs<TId>
): TableColumnPrefsByDevice<TId> {
  let next = store;
  for (const device of DEVICE_CLASSES) {
    next = setTableColumnPrefsSlice(next, device, slice);
  }
  return next;
}

export function setTableColumnWidthInDeviceStore<TId extends string>(
  store: TableColumnPrefsByDevice<TId>,
  device: DeviceClass,
  columnId: TId,
  width: number | null
): TableColumnPrefsByDevice<TId> {
  const slice = getTableColumnPrefsSlice(store, device);
  const columnWidths: Partial<Record<TId, number>> = { ...(slice.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId];
  } else {
    columnWidths[columnId] = width;
  }
  return setTableColumnPrefsSlice(store, device, {
    ...slice,
    columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
  });
}

/** Minimum prefsVersion once column prefs are stored per screen breakpoint. */
export const TABLE_COLUMN_PREFS_BY_DEVICE_VERSION = 3;
