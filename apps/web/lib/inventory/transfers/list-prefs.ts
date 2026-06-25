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
import { TRANSFER_LIST_COLUMN_REGISTRY, type TransferListColumnId } from "@/lib/inventory/transfers/list-columns";
import {
  DEFAULT_TRANSFER_SORT_DIRECTION,
  DEFAULT_TRANSFER_SORT_FIELD,
  type TransferListSortDirection,
  type TransferListSortField,
} from "@/lib/inventory/transfers/list-sort";
import type { StockTransferStatus } from "@/lib/inventory/transfers/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { AUTO_LAYOUT_PREF } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:inventory-transfers-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type TransferListPrefs = {
  status: StockTransferStatus | "all";
  sourceLocationId: string | null;
  sortField: TransferListSortField;
  sortDirection: TransferListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<TransferListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultTransferListPrefs(): TransferListPrefs {
  return {
    status: "all",
    sourceLocationId: null,
    sortField: DEFAULT_TRANSFER_SORT_FIELD,
    sortDirection: DEFAULT_TRANSFER_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(TRANSFER_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getTransferColumnPrefsSlice(
  prefs: TransferListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<TransferListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setTransferColumnPrefsSlice(
  prefs: TransferListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<TransferListColumnId>
): TransferListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setTransferColumnPrefsSliceAllDevices(
  prefs: TransferListPrefs,
  slice: ListColumnPrefs<TransferListColumnId>
): TransferListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isTransferSortField(value: string): value is TransferListSortField {
  return (TRANSFER_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadTransferListPrefs(): TransferListPrefs {
  const defaults = getDefaultTransferListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(TRANSFER_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(
          TRANSFER_LIST_COLUMN_REGISTRY,
          legacyDesktop
        ),
      };
    }

    const parsed = JSON.parse(raw) as Partial<TransferListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isTransferSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      TRANSFER_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

    return {
      status: parsed.status ?? "all",
      sourceLocationId: parsed.sourceLocationId ?? null,
      sortField,
      sortDirection,
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function saveTransferListPrefs(prefs: TransferListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(
    TRANSFER_LIST_COLUMN_REGISTRY,
    getTransferColumnPrefsSlice(prefs, "desktop")
  );
}

export function setTransferColumnWidth(
  prefs: TransferListPrefs,
  deviceClass: DeviceClass,
  columnId: TransferListColumnId,
  width: number | null
): TransferListPrefs {
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
