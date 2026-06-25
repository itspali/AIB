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
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  STOCK_ADJUSTMENT_COLUMN_REGISTRY,
  STOCK_BALANCE_COLUMN_REGISTRY,
  type StockAdjustmentColumnId,
  type StockBalanceColumnId,
} from "@/lib/inventory/stock/list-columns";
import {
  DEFAULT_STOCK_ADJUSTMENT_SORT_DIRECTION,
  DEFAULT_STOCK_ADJUSTMENT_SORT_FIELD,
  DEFAULT_STOCK_BALANCE_SORT_DIRECTION,
  DEFAULT_STOCK_BALANCE_SORT_FIELD,
  type StockAdjustmentSortField,
  type StockBalanceSortField,
  type StockListSortDirection,
} from "@/lib/inventory/stock/list-sort";
import {
  STOCK_LIST_VIEW_MODES,
  type StockListViewMode,
} from "@/lib/inventory/stock/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { AUTO_LAYOUT_PREF } from "@/lib/products/list-prefs";

export type StockListPrefs = {
  viewMode: StockListViewMode;
  locationId: string | null;
  balanceSortField: StockBalanceSortField;
  balanceSortDirection: StockListSortDirection;
  adjustmentSortField: StockAdjustmentSortField;
  adjustmentSortDirection: StockListSortDirection;
  balanceColumnPrefs: TableColumnPrefsByDevice<StockBalanceColumnId>;
  adjustmentColumnPrefs: TableColumnPrefsByDevice<StockAdjustmentColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib-stock-list-prefs";
const PREFS_VERSION = TABLE_COLUMN_PREFS_BY_DEVICE_VERSION;

function parseStockListViewMode(value: unknown): StockListViewMode {
  if (
    typeof value === "string" &&
    (STOCK_LIST_VIEW_MODES as readonly string[]).includes(value)
  ) {
    return value as StockListViewMode;
  }
  return "balances";
}

export function getDefaultStockListPrefs(): StockListPrefs {
  return {
    viewMode: "balances",
    locationId: null,
    balanceSortField: DEFAULT_STOCK_BALANCE_SORT_FIELD,
    balanceSortDirection: DEFAULT_STOCK_BALANCE_SORT_DIRECTION,
    adjustmentSortField: DEFAULT_STOCK_ADJUSTMENT_SORT_FIELD,
    adjustmentSortDirection: DEFAULT_STOCK_ADJUSTMENT_SORT_DIRECTION,
    balanceColumnPrefs: buildDefaultTableColumnPrefsByDevice(STOCK_BALANCE_COLUMN_REGISTRY),
    adjustmentColumnPrefs: buildDefaultTableColumnPrefsByDevice(STOCK_ADJUSTMENT_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
  };
}

export function getStockBalanceColumnPrefsSlice(
  prefs: StockListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<StockBalanceColumnId> {
  return getTableColumnPrefsSlice(prefs.balanceColumnPrefs, deviceClass);
}

export function setStockBalanceColumnPrefsSlice(
  prefs: StockListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<StockBalanceColumnId>
): StockListPrefs {
  return {
    ...prefs,
    balanceColumnPrefs: setTableColumnPrefsSlice(prefs.balanceColumnPrefs, deviceClass, slice),
  };
}

export function setStockBalanceColumnPrefsSliceAllDevices(
  prefs: StockListPrefs,
  slice: ListColumnPrefs<StockBalanceColumnId>
): StockListPrefs {
  return {
    ...prefs,
    balanceColumnPrefs: setTableColumnPrefsSliceAllDevices(prefs.balanceColumnPrefs, slice),
  };
}

export function getStockAdjustmentColumnPrefsSlice(
  prefs: StockListPrefs,
  deviceClass: DeviceClass
): ListColumnPrefs<StockAdjustmentColumnId> {
  return getTableColumnPrefsSlice(prefs.adjustmentColumnPrefs, deviceClass);
}

export function setStockAdjustmentColumnPrefsSlice(
  prefs: StockListPrefs,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<StockAdjustmentColumnId>
): StockListPrefs {
  return {
    ...prefs,
    adjustmentColumnPrefs: setTableColumnPrefsSlice(prefs.adjustmentColumnPrefs, deviceClass, slice),
  };
}

export function setStockAdjustmentColumnPrefsSliceAllDevices(
  prefs: StockListPrefs,
  slice: ListColumnPrefs<StockAdjustmentColumnId>
): StockListPrefs {
  return {
    ...prefs,
    adjustmentColumnPrefs: setTableColumnPrefsSliceAllDevices(prefs.adjustmentColumnPrefs, slice),
  };
}

function isStockBalanceSortField(value: string): value is StockBalanceSortField {
  return (STOCK_BALANCE_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

function isStockAdjustmentSortField(value: string): value is StockAdjustmentSortField {
  return (STOCK_ADJUSTMENT_COLUMN_REGISTRY.ids as readonly string[]).includes(value);
}

export function loadStockListPrefs(): StockListPrefs {
  const defaults = getDefaultStockListPrefs();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyBalanceDesktop = loadListColumnPrefs(STOCK_BALANCE_COLUMN_REGISTRY);
    const legacyAdjustmentDesktop = loadListColumnPrefs(STOCK_ADJUSTMENT_COLUMN_REGISTRY);
    if (!raw) {
      return {
        ...defaults,
        balanceColumnPrefs: buildDefaultTableColumnPrefsByDevice(
          STOCK_BALANCE_COLUMN_REGISTRY,
          legacyBalanceDesktop
        ),
        adjustmentColumnPrefs: buildDefaultTableColumnPrefsByDevice(
          STOCK_ADJUSTMENT_COLUMN_REGISTRY,
          legacyAdjustmentDesktop
        ),
      };
    }

    const parsed = JSON.parse(raw) as Partial<StockListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const viewMode = parseStockListViewMode(parsed.viewMode);
    const locationId =
      typeof parsed.locationId === "string" && parsed.locationId.trim()
        ? parsed.locationId.trim()
        : null;

    const balanceSortField =
      typeof parsed.balanceSortField === "string" &&
      isStockBalanceSortField(parsed.balanceSortField)
        ? parsed.balanceSortField
        : defaults.balanceSortField;
    const adjustmentSortField =
      typeof parsed.adjustmentSortField === "string" &&
      isStockAdjustmentSortField(parsed.adjustmentSortField)
        ? parsed.adjustmentSortField
        : defaults.adjustmentSortField;

    const balanceSortDirection =
      parsed.balanceSortDirection === "desc" ? "desc" : defaults.balanceSortDirection;
    const adjustmentSortDirection =
      parsed.adjustmentSortDirection === "desc" ? "desc" : defaults.adjustmentSortDirection;

    const balanceColumnPrefs = parseStoredTableColumnPrefsByDevice(
      STOCK_BALANCE_COLUMN_REGISTRY,
      parsed.balanceColumnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyBalanceDesktop,
      }
    );

    const adjustmentColumnPrefs = parseStoredTableColumnPrefsByDevice(
      STOCK_ADJUSTMENT_COLUMN_REGISTRY,
      parsed.adjustmentColumnPrefs,
      {
        minVersion: PREFS_VERSION,
        storedVersion: prefsVersion,
        legacyFlat: legacyAdjustmentDesktop,
      }
    );

    const frozenColumnCount = parseFrozenColumnPref(parsed.frozenColumnCount);

    return {
      viewMode,
      locationId,
      balanceSortField,
      balanceSortDirection,
      adjustmentSortField,
      adjustmentSortDirection,
      balanceColumnPrefs,
      adjustmentColumnPrefs,
      frozenColumnCount,
    };
  } catch {
    return defaults;
  }
}

export function saveStockListPrefs(prefs: StockListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
    );
    saveListColumnPrefs(
      STOCK_BALANCE_COLUMN_REGISTRY,
      getStockBalanceColumnPrefsSlice(prefs, "desktop")
    );
    saveListColumnPrefs(
      STOCK_ADJUSTMENT_COLUMN_REGISTRY,
      getStockAdjustmentColumnPrefsSlice(prefs, "desktop")
    );
  } catch {
    // ignore quota errors
  }
}

export function getStockSortPrefs(prefs: StockListPrefs): {
  field: StockBalanceSortField | StockAdjustmentSortField;
  direction: StockListSortDirection;
} {
  if (prefs.viewMode === "adjustments") {
    return {
      field: prefs.adjustmentSortField,
      direction: prefs.adjustmentSortDirection,
    };
  }
  return {
    field: prefs.balanceSortField,
    direction: prefs.balanceSortDirection,
  };
}

export function setStockSortPrefs(
  prefs: StockListPrefs,
  field: StockBalanceSortField | StockAdjustmentSortField,
  direction: StockListSortDirection
): StockListPrefs {
  if (prefs.viewMode === "adjustments") {
    return {
      ...prefs,
      adjustmentSortField: field as StockAdjustmentSortField,
      adjustmentSortDirection: direction,
    };
  }
  return {
    ...prefs,
    balanceSortField: field as StockBalanceSortField,
    balanceSortDirection: direction,
  };
}

export function getStockColumnPrefs(prefs: StockListPrefs, deviceClass: DeviceClass) {
  return prefs.viewMode === "adjustments"
    ? getStockAdjustmentColumnPrefsSlice(prefs, deviceClass)
    : getStockBalanceColumnPrefsSlice(prefs, deviceClass);
}

export function setStockColumnPrefs(
  prefs: StockListPrefs,
  deviceClass: DeviceClass,
  columnPrefs:
    | ListColumnPrefs<StockBalanceColumnId>
    | ListColumnPrefs<StockAdjustmentColumnId>
): StockListPrefs {
  if (prefs.viewMode === "adjustments") {
    return setStockAdjustmentColumnPrefsSlice(
      prefs,
      deviceClass,
      columnPrefs as ListColumnPrefs<StockAdjustmentColumnId>
    );
  }
  return setStockBalanceColumnPrefsSlice(
    prefs,
    deviceClass,
    columnPrefs as ListColumnPrefs<StockBalanceColumnId>
  );
}

export function setStockColumnWidth(
  prefs: StockListPrefs,
  deviceClass: DeviceClass,
  columnId: StockBalanceColumnId | StockAdjustmentColumnId,
  width: number | null
): StockListPrefs {
  if (prefs.viewMode === "adjustments") {
    return {
      ...prefs,
      adjustmentColumnPrefs: setTableColumnWidthInDeviceStore(
        prefs.adjustmentColumnPrefs,
        deviceClass,
        columnId as StockAdjustmentColumnId,
        width
      ),
    };
  }
  return {
    ...prefs,
    balanceColumnPrefs: setTableColumnWidthInDeviceStore(
      prefs.balanceColumnPrefs,
      deviceClass,
      columnId as StockBalanceColumnId,
      width
    ),
  };
}

export function getStockColumnRegistry(prefs: StockListPrefs) {
  return prefs.viewMode === "adjustments"
    ? STOCK_ADJUSTMENT_COLUMN_REGISTRY
    : STOCK_BALANCE_COLUMN_REGISTRY;
}
