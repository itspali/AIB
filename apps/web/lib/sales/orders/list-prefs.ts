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
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type SalesOrderListPrefs = {
  status: SalesOrderStatus | "all";
  locationId: string | null;
  sortField: SalesOrderListSortField;
  sortDirection: SalesOrderListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<SalesOrderListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultSalesOrderListPrefs(): SalesOrderListPrefs {
  return {
    status: "all",
    locationId: null,
    sortField: DEFAULT_SO_SORT_FIELD,
    sortDirection: DEFAULT_SO_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(SO_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getSalesOrderColumnPrefsSlice(
  prefs: SalesOrderListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<SalesOrderListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setSalesOrderColumnPrefsSlice(
  prefs: SalesOrderListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<SalesOrderListColumnId>
): SalesOrderListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setSalesOrderColumnPrefsSliceAllDevices(
  prefs: SalesOrderListPrefs,
  slice: ListColumnPrefs<SalesOrderListColumnId>
): SalesOrderListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
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
    const legacyDesktop = loadListColumnPrefs(SO_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(SO_LIST_COLUMN_REGISTRY, legacyDesktop),
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

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      SO_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

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
  saveListColumnPrefs(
    SO_LIST_COLUMN_REGISTRY,
    getSalesOrderColumnPrefsSlice(prefs, "desktop")
  );
}

export function setSalesOrderColumnWidth(
  prefs: SalesOrderListPrefs,
  deviceClass: DeviceClass,
  columnId: SalesOrderListColumnId,
  width: number | null
): SalesOrderListPrefs {
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
