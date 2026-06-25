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
  QC_QUEUE_LIST_COLUMN_REGISTRY,
  type QcQueueListColumnId,
} from "@/lib/procurement/quality-inspection/list-columns";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

export type QcQueueListSortField =
  | "item"
  | "grn_number"
  | "purchase_order"
  | "location"
  | "on_hold"
  | "received";

export type QcQueueListSortDirection = "asc" | "desc";

export type QcQueueListPrefs = {
  locationId: string | null;
  sortField: QcQueueListSortField;
  sortDirection: QcQueueListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<QcQueueListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib:procurement-qc-queue-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export function getDefaultQcQueueListPrefs(): QcQueueListPrefs {
  return {
    locationId: null,
    sortField: "received",
    sortDirection: "desc",
    columnPrefs: buildDefaultTableColumnPrefsByDevice(QC_QUEUE_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getQcQueueColumnPrefsSlice(
  prefs: QcQueueListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<QcQueueListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setQcQueueColumnPrefsSlice(
  prefs: QcQueueListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<QcQueueListColumnId>
): QcQueueListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setQcQueueColumnPrefsSliceAllDevices(
  prefs: QcQueueListPrefs,
  slice: ListColumnPrefs<QcQueueListColumnId>
): QcQueueListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isQcQueueSortField(value: string): value is QcQueueListSortField {
  return (QC_QUEUE_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadQcQueueListPrefs(): QcQueueListPrefs {
  const defaults = getDefaultQcQueueListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(
          QC_QUEUE_LIST_COLUMN_REGISTRY,
          legacyDesktop
        ),
      };
    }

    const parsed = JSON.parse(raw) as Partial<QcQueueListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isQcQueueSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      QC_QUEUE_LIST_COLUMN_REGISTRY,
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
    return {
      ...defaults,
      columnPrefs: buildDefaultTableColumnPrefsByDevice(
        QC_QUEUE_LIST_COLUMN_REGISTRY,
        loadListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY)
      ),
    };
  }
}

export function saveQcQueueListPrefs(prefs: QcQueueListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(
    QC_QUEUE_LIST_COLUMN_REGISTRY,
    getQcQueueColumnPrefsSlice(prefs, "desktop")
  );
}

export function setQcQueueColumnWidth(
  prefs: QcQueueListPrefs,
  deviceClass: DeviceClass,
  columnId: QcQueueListColumnId,
  width: number | null
): QcQueueListPrefs {
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
