import {
  getDefaultListColumnPrefs,
  loadListColumnPrefs,
  normalizeListColumnPrefs,
  saveListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { parseFrozenColumnPref } from "@/lib/list-columns/use-frozen-list-columns";
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
  columnPrefs: ListColumnPrefs<QcQueueListColumnId>;
  frozenColumnCount: FrozenColumnPref;
};

const STORAGE_KEY = "aib:procurement-qc-queue-list-prefs";
const PREFS_VERSION = 1;

export function getDefaultQcQueueListPrefs(): QcQueueListPrefs {
  return {
    locationId: null,
    sortField: "received",
    sortDirection: "desc",
    columnPrefs: getDefaultListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY),
    frozenColumnCount: AUTO_LAYOUT_PREF,
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
    if (!raw) {
      return {
        ...defaults,
        columnPrefs: loadListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY),
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
    const columnPrefs =
      prefsVersion >= PREFS_VERSION && parsed.columnPrefs
        ? normalizeListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY, parsed.columnPrefs)
        : loadListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY);

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
      columnPrefs: loadListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY),
    };
  }
}

export function saveQcQueueListPrefs(prefs: QcQueueListPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...prefs, prefsVersion: PREFS_VERSION })
  );
  saveListColumnPrefs(QC_QUEUE_LIST_COLUMN_REGISTRY, prefs.columnPrefs);
}

export function setQcQueueColumnWidth(
  prefs: QcQueueListPrefs,
  columnId: QcQueueListColumnId,
  width: number | null
): QcQueueListPrefs {
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
      columnWidths,
    },
  };
}
