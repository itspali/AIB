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
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type GoodsReceiptListPrefs = {
  locationId: string | null;
  sortField: GoodsReceiptListSortField;
  sortDirection: GoodsReceiptListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<GoodsReceiptListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultGoodsReceiptListPrefs(): GoodsReceiptListPrefs {
  return {
    locationId: null,
    sortField: DEFAULT_GRN_SORT_FIELD,
    sortDirection: DEFAULT_GRN_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(GRN_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getGoodsReceiptColumnPrefsSlice(
  prefs: GoodsReceiptListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<GoodsReceiptListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setGoodsReceiptColumnPrefsSlice(
  prefs: GoodsReceiptListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<GoodsReceiptListColumnId>
): GoodsReceiptListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setGoodsReceiptColumnPrefsSliceAllDevices(
  prefs: GoodsReceiptListPrefs,
  slice: ListColumnPrefs<GoodsReceiptListColumnId>
): GoodsReceiptListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
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
    const legacyDesktop = loadListColumnPrefs(GRN_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(GRN_LIST_COLUMN_REGISTRY, legacyDesktop),
      };
    }

    const parsed = JSON.parse(raw) as Partial<GoodsReceiptListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isGoodsReceiptSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      GRN_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

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
  saveListColumnPrefs(
    GRN_LIST_COLUMN_REGISTRY,
    getGoodsReceiptColumnPrefsSlice(prefs, "desktop")
  );
}

export function setGoodsReceiptColumnWidth(
  prefs: GoodsReceiptListPrefs,
  deviceClass: DeviceClass,
  columnId: GoodsReceiptListColumnId,
  width: number | null
): GoodsReceiptListPrefs {
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
