import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
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
import type { StockListViewMode } from "@/lib/inventory/stock/types";
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
  balanceColumnPrefs: ListColumnPrefs<StockBalanceColumnId>;
  adjustmentColumnPrefs: ListColumnPrefs<StockAdjustmentColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib-stock-list-prefs";
const PREFS_VERSION = 3;

export function getDefaultStockListPrefs(): StockListPrefs {
  return {
    viewMode: "balances",
    locationId: null,
    balanceSortField: DEFAULT_STOCK_BALANCE_SORT_FIELD,
    balanceSortDirection: DEFAULT_STOCK_BALANCE_SORT_DIRECTION,
    adjustmentSortField: DEFAULT_STOCK_ADJUSTMENT_SORT_FIELD,
    adjustmentSortDirection: DEFAULT_STOCK_ADJUSTMENT_SORT_DIRECTION,
    balanceColumnPrefs: getDefaultListColumnPrefs(STOCK_BALANCE_COLUMN_REGISTRY),
    adjustmentColumnPrefs: getDefaultListColumnPrefs(STOCK_ADJUSTMENT_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        balanceColumnPrefs: loadListColumnPrefs(STOCK_BALANCE_COLUMN_REGISTRY),
        adjustmentColumnPrefs: loadListColumnPrefs(STOCK_ADJUSTMENT_COLUMN_REGISTRY),
      };
    }

    const parsed = JSON.parse(raw) as Partial<StockListPrefs> & { prefsVersion?: number };
    const prefsVersion =
      typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
        ? parsed.prefsVersion
        : 0;
    const viewMode = parsed.viewMode === "adjustments" ? "adjustments" : "balances";
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

    const balanceColumnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.balanceColumnPrefs
        ? normalizeListColumnPrefs(STOCK_BALANCE_COLUMN_REGISTRY, parsed.balanceColumnPrefs)
        : loadListColumnPrefs(STOCK_BALANCE_COLUMN_REGISTRY);

    const adjustmentColumnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.adjustmentColumnPrefs
        ? normalizeListColumnPrefs(STOCK_ADJUSTMENT_COLUMN_REGISTRY, parsed.adjustmentColumnPrefs)
        : loadListColumnPrefs(STOCK_ADJUSTMENT_COLUMN_REGISTRY);

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
    saveListColumnPrefs(STOCK_BALANCE_COLUMN_REGISTRY, prefs.balanceColumnPrefs);
    saveListColumnPrefs(STOCK_ADJUSTMENT_COLUMN_REGISTRY, prefs.adjustmentColumnPrefs);
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

export function getStockColumnPrefs(prefs: StockListPrefs) {
  return prefs.viewMode === "adjustments"
    ? prefs.adjustmentColumnPrefs
    : prefs.balanceColumnPrefs;
}

export function setStockColumnPrefs(
  prefs: StockListPrefs,
  columnPrefs: ListColumnPrefs<StockBalanceColumnId> | ListColumnPrefs<StockAdjustmentColumnId>
): StockListPrefs {
  if (prefs.viewMode === "adjustments") {
    return {
      ...prefs,
      adjustmentColumnPrefs: columnPrefs as ListColumnPrefs<StockAdjustmentColumnId>,
    };
  }
  return {
    ...prefs,
    balanceColumnPrefs: columnPrefs as ListColumnPrefs<StockBalanceColumnId>,
  };
}

export function setStockColumnWidth(
  prefs: StockListPrefs,
  columnId: StockBalanceColumnId | StockAdjustmentColumnId,
  width: number | null
): StockListPrefs {
  const slice = getStockColumnPrefs(prefs);
  const columnWidths = { ...(slice.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId as keyof typeof columnWidths];
  } else {
    (columnWidths as Record<string, number>)[columnId] = width;
  }
  return setStockColumnPrefs(prefs, {
    ...slice,
    columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
  });
}

export function getStockColumnRegistry(prefs: StockListPrefs) {
  return prefs.viewMode === "adjustments"
    ? STOCK_ADJUSTMENT_COLUMN_REGISTRY
    : STOCK_BALANCE_COLUMN_REGISTRY;
}
