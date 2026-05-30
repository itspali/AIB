import { columnSupportsWrapControl, isTextWrapMode, type TextWrapMode } from "@/lib/display/text-wrap";
import type { ListColumnPrefs, ListColumnRegistry } from "@/lib/list-columns/types";
import {
  getColumnDef,
  getDefaultColumnOrder,
  getDefaultVisibleColumns,
  isColumnId,
} from "@/lib/list-columns/types";

function normalizeColumnWrapModes<TId extends string>(
  registry: ListColumnRegistry<TId>,
  raw?: Partial<Record<TId, string>> | null
): Partial<Record<TId, TextWrapMode>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const result: Partial<Record<TId, TextWrapMode>> = {};
  for (const [columnId, mode] of Object.entries(raw) as [TId, string][]) {
    if (!isColumnId(registry, columnId) || !isTextWrapMode(mode)) continue;
    const column = getColumnDef(registry, columnId);
    if (!columnSupportsWrapControl(column.valueKind)) continue;
    result[columnId] = mode;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

const USER_COLUMN_WIDTH_MIN_PX = 48;
const USER_COLUMN_WIDTH_MAX_PX = 640;

function normalizeColumnWidths<TId extends string>(
  registry: ListColumnRegistry<TId>,
  raw?: Partial<Record<TId, number>> | null
): Partial<Record<TId, number>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const result: Partial<Record<TId, number>> = {};
  for (const [columnId, width] of Object.entries(raw) as [TId, number][]) {
    if (!isColumnId(registry, columnId)) continue;
    if (typeof width !== "number" || !Number.isFinite(width)) continue;
    result[columnId] = Math.round(
      Math.max(USER_COLUMN_WIDTH_MIN_PX, Math.min(width, USER_COLUMN_WIDTH_MAX_PX))
    );
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function getDefaultListColumnPrefs<TId extends string>(
  registry: ListColumnRegistry<TId>
): ListColumnPrefs<TId> {
  return {
    columnOrder: getDefaultColumnOrder(registry),
    visibleColumns: getDefaultVisibleColumns(registry),
  };
}

export function normalizeListColumnPrefs<TId extends string>(
  registry: ListColumnRegistry<TId>,
  prefs?: Partial<ListColumnPrefs<TId>> | null
): ListColumnPrefs<TId> {
  const defaults = getDefaultListColumnPrefs(registry);
  const columnOrder = (prefs?.columnOrder ?? defaults.columnOrder).filter((id) =>
    isColumnId(registry, id)
  );
  const visibleColumns = (prefs?.visibleColumns ?? defaults.visibleColumns).filter((id) =>
    isColumnId(registry, id)
  );

  const orderSet = new Set(columnOrder);
  for (const id of registry.ids) {
    if (!orderSet.has(id)) columnOrder.push(id);
  }

  return {
    columnOrder,
    visibleColumns: visibleColumns.length ? visibleColumns : defaults.visibleColumns,
    columnWrapModes: normalizeColumnWrapModes(registry, prefs?.columnWrapModes),
    columnWidths: normalizeColumnWidths(registry, prefs?.columnWidths),
  };
}

export function loadListColumnPrefs<TId extends string>(
  registry: ListColumnRegistry<TId>
): ListColumnPrefs<TId> {
  const defaults = getDefaultListColumnPrefs(registry);
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(registry.storageKey);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as Partial<ListColumnPrefs<TId>>;
    return normalizeListColumnPrefs(registry, parsed);
  } catch {
    return defaults;
  }
}

export function saveListColumnPrefs<TId extends string>(
  registry: ListColumnRegistry<TId>,
  prefs: ListColumnPrefs<TId>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(registry.storageKey, JSON.stringify(prefs));
  } catch {
    /* ignore quota errors */
  }
}

export function getOrderedVisibleColumns<TId extends string>(
  prefs: ListColumnPrefs<TId>
): TId[] {
  const visible = new Set(prefs.visibleColumns);
  return prefs.columnOrder.filter((id) => visible.has(id));
}
