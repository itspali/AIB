import {
  getDefaultListColumnPrefs,
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
  PO_LIST_COLUMN_REGISTRY,
  type PurchaseOrderListColumnId,
} from "@/lib/procurement/purchase-orders/list-columns";
import {
  DEFAULT_PO_SORT_DIRECTION,
  DEFAULT_PO_SORT_FIELD,
  type PurchaseOrderListSortDirection,
  type PurchaseOrderListSortField,
} from "@/lib/procurement/purchase-orders/list-sort";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:procurement-po-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type PurchaseOrderListPrefs = {
  status: PurchaseOrderStatus | "all";
  locationId: string | null;
  sortField: PurchaseOrderListSortField;
  sortDirection: PurchaseOrderListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<PurchaseOrderListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultPurchaseOrderListPrefs(): PurchaseOrderListPrefs {
  return {
    status: "all",
    locationId: null,
    sortField: DEFAULT_PO_SORT_FIELD,
    sortDirection: DEFAULT_PO_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(PO_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getPurchaseOrderColumnPrefsSlice(
  prefs: PurchaseOrderListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<PurchaseOrderListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setPurchaseOrderColumnPrefsSlice(
  prefs: PurchaseOrderListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<PurchaseOrderListColumnId>
): PurchaseOrderListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setPurchaseOrderColumnPrefsSliceAllDevices(
  prefs: PurchaseOrderListPrefs,
  slice: ListColumnPrefs<PurchaseOrderListColumnId>
): PurchaseOrderListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isPurchaseOrderSortField(value: string): value is PurchaseOrderListSortField {
  return (PO_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadPurchaseOrderListPrefs(): PurchaseOrderListPrefs {
  const defaults = getDefaultPurchaseOrderListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(PO_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(PO_LIST_COLUMN_REGISTRY, legacyDesktop),
      };
    }

    const parsed = JSON.parse(raw) as Partial<PurchaseOrderListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isPurchaseOrderSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      PO_LIST_COLUMN_REGISTRY,
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

export function savePurchaseOrderListPrefs(prefs: PurchaseOrderListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(
    PO_LIST_COLUMN_REGISTRY,
    getPurchaseOrderColumnPrefsSlice(prefs, "desktop")
  );
}

export function setPurchaseOrderColumnWidth(
  prefs: PurchaseOrderListPrefs,
  deviceClass: DeviceClass,
  columnId: PurchaseOrderListColumnId,
  width: number | null
): PurchaseOrderListPrefs {
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
