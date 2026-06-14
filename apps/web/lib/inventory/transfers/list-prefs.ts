import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { TRANSFER_LIST_COLUMN_REGISTRY, type TransferListColumnId } from "@/lib/inventory/transfers/list-columns";
import {
  DEFAULT_TRANSFER_SORT_DIRECTION,
  DEFAULT_TRANSFER_SORT_FIELD,
  type TransferListSortDirection,
  type TransferListSortField,
} from "@/lib/inventory/transfers/list-sort";
import type { StockTransferStatus } from "@/lib/inventory/transfers/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { AUTO_LAYOUT_PREF } from "@/lib/products/list-prefs";

const STORAGE_KEY = "aib:inventory-transfers-list-prefs";
const PREFS_VERSION = 3;

export type TransferListPrefs = {
  status: StockTransferStatus | "all";
  sourceLocationId: string | null;
  sortField: TransferListSortField;
  sortDirection: TransferListSortDirection;
  columnPrefs: ListColumnPrefs<TransferListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultTransferListPrefs(): TransferListPrefs {
  return {
    status: "all",
    sourceLocationId: null,
    sortField: DEFAULT_TRANSFER_SORT_FIELD,
    sortDirection: DEFAULT_TRANSFER_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(TRANSFER_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(TRANSFER_LIST_COLUMN_REGISTRY),
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

    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(TRANSFER_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(TRANSFER_LIST_COLUMN_REGISTRY);

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
  saveListColumnPrefs(TRANSFER_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setTransferColumnWidth(
  prefs: TransferListPrefs,
  columnId: TransferListColumnId,
  width: number | null
): TransferListPrefs {
  const columnWidths = { ...(prefs.columnPrefs.columnWidths ?? {}) };
  if (width == null) {
    delete columnWidths[columnId];
  } else {
    columnWidths[columnId] = width;
  }
  return {
    ...prefs,
    columnPrefs: {
      ...prefs.columnPrefs,
      columnWidths: Object.keys(columnWidths).length > 0 ? columnWidths : undefined,
    },
  };
}
