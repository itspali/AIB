import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
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
const PREFS_VERSION = 2;

export type PurchaseOrderListPrefs = {
  status: PurchaseOrderStatus | "all";
  locationId: string | null;
  sortField: PurchaseOrderListSortField;
  sortDirection: PurchaseOrderListSortDirection;
  columnPrefs: ListColumnPrefs<PurchaseOrderListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

export function getDefaultPurchaseOrderListPrefs(): PurchaseOrderListPrefs {
  return {
    status: "all",
    locationId: null,
    sortField: DEFAULT_PO_SORT_FIELD,
    sortDirection: DEFAULT_PO_SORT_DIRECTION,
    columnPrefs: getDefaultListColumnPrefs(PO_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(PO_LIST_COLUMN_REGISTRY),
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

    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(PO_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(PO_LIST_COLUMN_REGISTRY);

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
  saveListColumnPrefs(PO_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setPurchaseOrderColumnWidth(
  prefs: PurchaseOrderListPrefs,
  columnId: PurchaseOrderListColumnId,
  width: number | null
): PurchaseOrderListPrefs {
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
