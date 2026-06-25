import {
  loadListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  buildDefaultTableColumnPrefsByDevice,
  getTableColumnPrefsSlice,
  parseStoredTableColumnPrefsByDevice,
  setTableColumnPrefsSlice,
  setTableColumnPrefsSliceAllDevices,
  TABLE_COLUMN_PREFS_BY_DEVICE_VERSION,
  type TableColumnPrefsByDevice,
} from "@/lib/list-columns/device-column-prefs";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  LOCATION_LIST_COLUMN_REGISTRY,
  type LocationListColumnId,
} from "@/lib/locations/list-columns";

export const LOCATION_LIST_PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type LocationListPrefs = {
  prefsVersion: number;
  columnPrefs: TableColumnPrefsByDevice<LocationListColumnId>;
};

export function getDefaultLocationListPrefs(): LocationListPrefs {
  return {
    prefsVersion: LOCATION_LIST_PREFS_VERSION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(LOCATION_LIST_COLUMN_REGISTRY),
  };
}

export function getLocationColumnPrefsSlice(
  prefs: LocationListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<LocationListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setLocationColumnPrefsSlice(
  prefs: LocationListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<LocationListColumnId>
): LocationListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setLocationColumnPrefsSliceAllDevices(
  prefs: LocationListPrefs,
  slice: ListColumnPrefs<LocationListColumnId>
): LocationListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

export function coerceLocationListPrefs(raw: unknown): LocationListPrefs {
  const defaults = getDefaultLocationListPrefs();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<LocationListPrefs> &
    Partial<ListColumnPrefs<LocationListColumnId>> & { prefsVersion?: number };
  const prefsVersion =
    typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
      ? parsed.prefsVersion
      : 0;
  const legacyDesktop = loadListColumnPrefs(LOCATION_LIST_COLUMN_REGISTRY);

  const columnPrefsSource =
    parsed.columnPrefs ??
    ("columnOrder" in parsed || "visibleColumns" in parsed || "columnChipDisplay" in parsed
      ? parsed
      : undefined);

  const columnPrefs = parseStoredTableColumnPrefsByDevice(
    LOCATION_LIST_COLUMN_REGISTRY,
    columnPrefsSource,
    {
      minVersion: LOCATION_LIST_PREFS_VERSION,
      storedVersion: prefsVersion,
      legacyFlat: legacyDesktop,
    }
  );

  return {
    prefsVersion: LOCATION_LIST_PREFS_VERSION,
    columnPrefs,
  };
}

export function loadLocationListPrefs(): LocationListPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCATION_LIST_COLUMN_REGISTRY.storageKey);
    if (!raw) return null;
    return coerceLocationListPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocationListPrefs(prefs: LocationListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCATION_LIST_COLUMN_REGISTRY.storageKey,
      JSON.stringify({
        ...prefs,
        prefsVersion: LOCATION_LIST_PREFS_VERSION,
      })
    );
    saveListColumnPrefs(
      LOCATION_LIST_COLUMN_REGISTRY,
      getLocationColumnPrefsSlice(prefs, "desktop")
    );
  } catch {
    /* ignore quota errors */
  }
}
