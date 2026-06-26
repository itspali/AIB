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
  setTableColumnWidthInDeviceStore,
  TABLE_COLUMN_PREFS_BY_DEVICE_VERSION,
  type TableColumnPrefsByDevice,
} from "@/lib/list-columns/device-column-prefs";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import type { DeviceClass } from "@/lib/layout/device-class";
import { UOM_LIST_COLUMN_REGISTRY, isUomFamilyFilter, type UomListColumnId } from "@/lib/uom/list-columns";
import {
  DEFAULT_UOM_SORT_DIRECTION,
  DEFAULT_UOM_SORT_FIELD,
  type UomListSortDirection,
  type UomListSortField,
} from "@/lib/uom/list-sort";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";
import type { UomFamily } from "@/lib/uom/types";

export type UomActiveStatusFilter = "all" | "active" | "inactive";
export type UomFamilyFilter = UomFamily | "all";

export type UomListPrefs = {
  sortField: UomListSortField;
  sortDirection: UomListSortDirection;
  activeStatusFilter: UomActiveStatusFilter;
  familyFilter: UomFamilyFilter;
  columnPrefs: TableColumnPrefsByDevice<UomListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib-uom-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export function getDefaultUomListPrefs(): UomListPrefs {
  return {
    sortField: DEFAULT_UOM_SORT_FIELD,
    sortDirection: DEFAULT_UOM_SORT_DIRECTION,
    activeStatusFilter: "all",
    familyFilter: "all",
    columnPrefs: buildDefaultTableColumnPrefsByDevice(UOM_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getUomColumnPrefsSlice(
  prefs: UomListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<UomListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setUomColumnPrefsSlice(
  prefs: UomListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<UomListColumnId>
): UomListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setUomColumnPrefsSliceAllDevices(
  prefs: UomListPrefs,
  slice: ListColumnPrefs<UomListColumnId>
): UomListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isUomSortField(value: string): value is UomListSortField {
  return (UOM_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

function parseActiveStatusFilter(value: unknown): UomActiveStatusFilter {
  if (value === "active" || value === "inactive") return value;
  return "all";
}

function parseFamilyFilter(value: unknown): UomFamilyFilter {
  if (typeof value === "string" && isUomFamilyFilter(value)) return value;
  return "all";
}

export function loadUomListPrefs(): UomListPrefs {
  const defaults = getDefaultUomListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(UOM_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(UOM_LIST_COLUMN_REGISTRY, legacyDesktop),
      };
    }

    const parsed = JSON.parse(raw) as Partial<UomListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;

    const sortField =
      typeof parsed.sortField === "string" && isUomSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection =
      parsed.sortDirection === "desc" ? "desc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      UOM_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

    return {
      sortField,
      sortDirection,
      activeStatusFilter: parseActiveStatusFilter(parsed.activeStatusFilter),
      familyFilter: parseFamilyFilter(parsed.familyFilter),
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function saveUomListPrefs(prefs: UomListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
    );
    saveListColumnPrefs(
      UOM_LIST_COLUMN_REGISTRY,
      getUomColumnPrefsSlice(prefs, "desktop")
    );
  } catch {
    // ignore quota errors
  }
}

export function setUomColumnWidth(
  prefs: UomListPrefs,
  deviceClass: DeviceClass,
  columnId: UomListColumnId,
  width: number | null
): UomListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnWidthInDeviceStore(
      prefs.columnPrefs,
      deviceClass,
      columnId,
      width
    ),
  };
}
