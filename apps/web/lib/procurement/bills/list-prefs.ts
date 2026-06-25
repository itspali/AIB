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
  BILL_LIST_COLUMN_REGISTRY,
  type PurchaseBillListColumnId,
} from "@/lib/procurement/bills/list-columns";
import {
  DEFAULT_BILL_SORT_DIRECTION,
  DEFAULT_BILL_SORT_FIELD,
  type PurchaseBillListSortDirection,
  type PurchaseBillListSortField,
} from "@/lib/procurement/bills/list-sort";
import type { BillMatchStatus } from "@/lib/procurement/bills/three-way-match";
import { AUTO_LAYOUT_PREF, type FrozenColumnPref } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:procurement-bill-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

export type PurchaseBillListPrefs = {
  supplierId: string | null;
  matchStatus: BillMatchStatus | "all";
  paidFilter: "all" | "paid" | "unpaid";
  /** Inclusive start date (YYYY-MM-DD) for created_at filter. */
  createdFrom: string | null;
  /** Inclusive end date (YYYY-MM-DD) for created_at filter. */
  createdTo: string | null;
  sortField: PurchaseBillListSortField;
  sortDirection: PurchaseBillListSortDirection;
  columnPrefs: TableColumnPrefsByDevice<PurchaseBillListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultPurchaseBillListPrefs(): PurchaseBillListPrefs {
  return {
    supplierId: null,
    matchStatus: "all",
    paidFilter: "all",
    createdFrom: null,
    createdTo: null,
    sortField: DEFAULT_BILL_SORT_FIELD,
    sortDirection: DEFAULT_BILL_SORT_DIRECTION,
    columnPrefs: buildDefaultTableColumnPrefsByDevice(BILL_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getPurchaseBillColumnPrefsSlice(
  prefs: PurchaseBillListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<PurchaseBillListColumnId> {
  return getTableColumnPrefsSlice(prefs.columnPrefs, deviceClass);
}

export function setPurchaseBillColumnPrefsSlice(
  prefs: PurchaseBillListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<PurchaseBillListColumnId>
): PurchaseBillListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSlice(prefs.columnPrefs, deviceClass, slice),
  };
}

export function setPurchaseBillColumnPrefsSliceAllDevices(
  prefs: PurchaseBillListPrefs,
  slice: ListColumnPrefs<PurchaseBillListColumnId>
): PurchaseBillListPrefs {
  return {
    ...prefs,
    columnPrefs: setTableColumnPrefsSliceAllDevices(prefs.columnPrefs, slice),
  };
}

function isPurchaseBillSortField(value: string): value is PurchaseBillListSortField {
  return (BILL_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadPurchaseBillListPrefs(): PurchaseBillListPrefs {
  const defaults = getDefaultPurchaseBillListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyDesktop = loadListColumnPrefs(BILL_LIST_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: buildDefaultTableColumnPrefsByDevice(BILL_LIST_COLUMN_REGISTRY, legacyDesktop),
      };
    }

    const parsed = JSON.parse(raw) as Partial<PurchaseBillListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const sortField =
      typeof parsed.sortField === "string" && isPurchaseBillSortField(parsed.sortField)
        ? parsed.sortField
        : defaults.sortField;
    const sortDirection = parsed.sortDirection === "asc" ? "asc" : defaults.sortDirection;

    const columnPrefs = parseStoredTableColumnPrefsByDevice(
      BILL_LIST_COLUMN_REGISTRY,
      parsed.columnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyDesktop,
      }
    );

    return {
      supplierId: parsed.supplierId ?? null,
      matchStatus: parsed.matchStatus ?? "all",
      paidFilter: parsed.paidFilter ?? "all",
      createdFrom: parsed.createdFrom ?? null,
      createdTo: parsed.createdTo ?? null,
      sortField,
      sortDirection,
      columnPrefs,
      frozenColumnCount: parseFrozenColumnPref(parsed.frozenColumnCount),
    };
  } catch {
    return defaults;
  }
}

export function savePurchaseBillListPrefs(prefs: PurchaseBillListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(
    BILL_LIST_COLUMN_REGISTRY,
    getPurchaseBillColumnPrefsSlice(prefs, "desktop")
  );
}

export function setPurchaseBillColumnWidth(
  prefs: PurchaseBillListPrefs,
  deviceClass: DeviceClass,
  columnId: PurchaseBillListColumnId,
  width: number | null
): PurchaseBillListPrefs {
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
