import {
  getDefaultListColumnPrefs,
  getOrderedVisibleColumns as getOrderedVisibleListColumns,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  PRODUCT_LIST_COLUMN_REGISTRY,
  type ProductListColumnId,
} from "@/lib/products/list-columns";
import {
  DEFAULT_PRODUCT_LIST_SORT_DIRECTION,
  DEFAULT_PRODUCT_LIST_SORT_FIELD,
  isProductListSortField,
  type ProductListSortDirection,
  type ProductListSortField,
} from "@/lib/products/list-sort";

export type ProductListViewMode = "table" | "compact";
export type DeviceClass = "mobile" | "tablet" | "desktop";
export type CardGridColumnCount = 1 | 2 | 3 | 4;

export type ProductListFrozenColumnCount = 0 | 1 | 2 | 3;

export const PRODUCT_LIST_PREFS_VERSION = 3;

const DEVICE_CLASSES: readonly DeviceClass[] = ["mobile", "tablet", "desktop"];

export type ProductListColumnPrefsByContext = Record<
  ProductListViewMode,
  Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>
>;

export type CardGridColumnsByDevice = Record<DeviceClass, CardGridColumnCount>;

export type ProductListPrefs = {
  prefsVersion: number;
  clientRevision: number;
  viewMode: ProductListViewMode;
  columnPrefs: ProductListColumnPrefsByContext;
  cardGridColumns: CardGridColumnsByDevice;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  frozenColumnCount: ProductListFrozenColumnCount;
};

const TABLE_MOBILE_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "category_name",
  "is_active",
  "updated_at",
];

const TABLE_TABLET_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "category_name",
  "classification",
  "is_active",
  "updated_at",
];

const COMPACT_DESKTOP_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "classification",
  "category_name",
  "is_active",
  "updated_at",
];

const COMPACT_TABLET_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "category_name",
  "is_active",
  "updated_at",
];

const COMPACT_MOBILE_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "is_active",
];

function buildContextPrefs(visibleIds: ProductListColumnId[]): ListColumnPrefs<ProductListColumnId> {
  const defaults = getDefaultListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY);
  const visibleSet = new Set(visibleIds);
  return normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, {
    columnOrder: defaults.columnOrder,
    visibleColumns: defaults.columnOrder.filter((id) => visibleSet.has(id)),
  });
}

export function getDefaultCardGridColumns(): CardGridColumnsByDevice {
  return {
    mobile: 1,
    tablet: 2,
    desktop: 2,
  };
}

export function getMaxCardGridColumns(deviceClass: DeviceClass): CardGridColumnCount {
  switch (deviceClass) {
    case "mobile":
      return 1;
    case "tablet":
      return 2;
    case "desktop":
      return 4;
  }
}

export function resolveCardGridColumns(
  prefs: ProductListPrefs,
  deviceClass: DeviceClass
): CardGridColumnCount {
  const max = getMaxCardGridColumns(deviceClass);
  const requested = prefs.cardGridColumns[deviceClass];
  return (Math.min(requested, max) as CardGridColumnCount) || 1;
}

function parseCardGridColumnCount(value: unknown, fallback: CardGridColumnCount): CardGridColumnCount {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return fallback;
}

export function clampCardGridColumns(prefs: ProductListPrefs): ProductListPrefs {
  const defaults = getDefaultCardGridColumns();
  const cardGridColumns = {} as CardGridColumnsByDevice;

  for (const deviceClass of DEVICE_CLASSES) {
    const max = getMaxCardGridColumns(deviceClass);
    const raw = prefs.cardGridColumns?.[deviceClass] ?? defaults[deviceClass];
    cardGridColumns[deviceClass] = parseCardGridColumnCount(
      Math.min(raw, max),
      defaults[deviceClass]
    );
  }

  return { ...prefs, cardGridColumns };
}

export function getDefaultProductListColumnPrefsByContext(): ProductListColumnPrefsByContext {
  const desktopTable = getDefaultListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY);
  return {
    table: {
      desktop: desktopTable,
      tablet: buildContextPrefs(TABLE_TABLET_VISIBLE),
      mobile: buildContextPrefs(TABLE_MOBILE_VISIBLE),
    },
    compact: {
      desktop: buildContextPrefs(COMPACT_DESKTOP_VISIBLE),
      tablet: buildContextPrefs(COMPACT_TABLET_VISIBLE),
      mobile: buildContextPrefs(COMPACT_MOBILE_VISIBLE),
    },
  };
}

function parseFrozenColumnCount(value: unknown): ProductListFrozenColumnCount {
  if (value === 1 || value === 2 || value === 3) return value;
  return 0;
}

export function getDefaultProductListPrefs(): ProductListPrefs {
  return clampCardGridColumns({
    prefsVersion: PRODUCT_LIST_PREFS_VERSION,
    clientRevision: 0,
    viewMode: "table",
    sortField: DEFAULT_PRODUCT_LIST_SORT_FIELD,
    sortDirection: DEFAULT_PRODUCT_LIST_SORT_DIRECTION,
    frozenColumnCount: 0,
    columnPrefs: getDefaultProductListColumnPrefsByContext(),
    cardGridColumns: getDefaultCardGridColumns(),
  });
}

type LegacyFlatProductListPrefs = Partial<ProductListPrefs> & {
  columnOrder?: unknown;
  visibleColumns?: unknown;
  cardGridColumns?: unknown;
  clientRevision?: unknown;
};

function parseClientRevision(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  return 0;
}

function isLegacyFlatPrefs(parsed: LegacyFlatProductListPrefs): boolean {
  return (
    parsed.prefsVersion !== PRODUCT_LIST_PREFS_VERSION &&
    parsed.prefsVersion !== 2 &&
    (Array.isArray(parsed.columnOrder) || Array.isArray(parsed.visibleColumns))
  );
}

function migrateLegacyFlatPrefs(
  parsed: LegacyFlatProductListPrefs
): ProductListColumnPrefsByContext {
  const legacy = normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, {
    columnOrder: Array.isArray(parsed.columnOrder)
      ? (parsed.columnOrder as ProductListColumnId[])
      : undefined,
    visibleColumns: Array.isArray(parsed.visibleColumns)
      ? (parsed.visibleColumns as ProductListColumnId[])
      : undefined,
  });
  const defaults = getDefaultProductListColumnPrefsByContext();
  return {
    table: {
      desktop: legacy,
      tablet: defaults.table.tablet,
      mobile: defaults.table.mobile,
    },
    compact: {
      desktop: legacy,
      tablet: defaults.compact.tablet,
      mobile: defaults.compact.mobile,
    },
  };
}

function migrateV2ColumnPrefs(
  raw: Partial<ProductListColumnPrefsByContext>
): ProductListColumnPrefsByContext {
  const defaults = getDefaultProductListColumnPrefsByContext();
  const viewModes: ProductListViewMode[] = ["table", "compact"];
  const result = {} as ProductListColumnPrefsByContext;

  for (const viewMode of viewModes) {
    result[viewMode] = {} as Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>;
    const v2Slice = raw[viewMode] as
      | Partial<Record<"mobile" | "desktop", ListColumnPrefs<ProductListColumnId>>>
      | undefined;

    for (const deviceClass of DEVICE_CLASSES) {
      const slice = v2Slice?.[deviceClass as "mobile" | "desktop"];
      if (slice) {
        result[viewMode][deviceClass] = normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, slice);
      } else if (deviceClass === "tablet") {
        const fallback =
          v2Slice?.desktop ?? v2Slice?.mobile ?? defaults[viewMode][deviceClass];
        result[viewMode][deviceClass] = normalizeListColumnPrefs(
          PRODUCT_LIST_COLUMN_REGISTRY,
          fallback
        );
      } else {
        result[viewMode][deviceClass] = normalizeListColumnPrefs(
          PRODUCT_LIST_COLUMN_REGISTRY,
          v2Slice?.[deviceClass as "mobile" | "desktop"] ?? defaults[viewMode][deviceClass]
        );
      }
    }
  }

  return result;
}

function parseColumnPrefsByContext(raw: unknown): ProductListColumnPrefsByContext | null {
  if (!raw || typeof raw !== "object") return null;

  const parsed = raw as Partial<ProductListColumnPrefsByContext>;
  const hasTablet = Boolean(parsed.table?.tablet || parsed.compact?.tablet);

  if (!hasTablet) {
    return migrateV2ColumnPrefs(parsed);
  }

  const defaults = getDefaultProductListColumnPrefsByContext();
  const viewModes: ProductListViewMode[] = ["table", "compact"];
  const result = {} as ProductListColumnPrefsByContext;

  for (const viewMode of viewModes) {
    result[viewMode] = {} as Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>;
    for (const deviceClass of DEVICE_CLASSES) {
      const slice = parsed[viewMode]?.[deviceClass];
      result[viewMode][deviceClass] = normalizeListColumnPrefs(
        PRODUCT_LIST_COLUMN_REGISTRY,
        slice ?? defaults[viewMode][deviceClass]
      );
    }
  }

  return result;
}

function parseCardGridColumns(raw: unknown): CardGridColumnsByDevice {
  const defaults = getDefaultCardGridColumns();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<CardGridColumnsByDevice>;
  return {
    mobile: 1,
    tablet: parseCardGridColumnCount(parsed.tablet, defaults.tablet),
    desktop: parseCardGridColumnCount(parsed.desktop, defaults.desktop),
  };
}

export function coerceProductListPrefs(raw: unknown): ProductListPrefs {
  const defaults = getDefaultProductListPrefs();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as LegacyFlatProductListPrefs;
  const viewMode = parsed.viewMode === "compact" ? "compact" : "table";
  const sortField = isProductListSortField(parsed.sortField ?? "")
    ? (parsed.sortField as ProductListSortField)
    : defaults.sortField;
  const sortDirection = parsed.sortDirection === "desc" ? "desc" : "asc";
  const frozenColumnCount = parseFrozenColumnCount(parsed.frozenColumnCount);

  const columnPrefs = isLegacyFlatPrefs(parsed)
    ? migrateLegacyFlatPrefs(parsed)
    : parseColumnPrefsByContext(parsed.columnPrefs) ?? defaults.columnPrefs;

  const cardGridColumns =
    parsed.prefsVersion === PRODUCT_LIST_PREFS_VERSION
      ? parseCardGridColumns(parsed.cardGridColumns)
      : getDefaultCardGridColumns();

  return clampCardGridColumns({
    prefsVersion: PRODUCT_LIST_PREFS_VERSION,
    clientRevision: parseClientRevision(parsed.clientRevision),
    viewMode,
    sortField,
    sortDirection,
    frozenColumnCount,
    columnPrefs,
    cardGridColumns,
  });
}

export function loadProductListPrefs(): ProductListPrefs | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(PRODUCT_LIST_COLUMN_REGISTRY.storageKey);
    if (!raw) return null;

    return coerceProductListPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveProductListPrefs(prefs: ProductListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = clampCardGridColumns({
      ...prefs,
      prefsVersion: PRODUCT_LIST_PREFS_VERSION,
    });
    localStorage.setItem(
      PRODUCT_LIST_COLUMN_REGISTRY.storageKey,
      JSON.stringify(normalized)
    );
  } catch {
    /* ignore quota errors */
  }
}

export function getColumnPrefsSlice(
  prefs: ProductListPrefs,
  viewMode: ProductListViewMode,
  deviceClass: DeviceClass
): ListColumnPrefs<ProductListColumnId> {
  return prefs.columnPrefs[viewMode][deviceClass];
}

export function setColumnPrefsSlice(
  prefs: ProductListPrefs,
  viewMode: ProductListViewMode,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<ProductListColumnId>
): ProductListPrefs {
  return {
    ...prefs,
    columnPrefs: {
      ...prefs.columnPrefs,
      [viewMode]: {
        ...prefs.columnPrefs[viewMode],
        [deviceClass]: slice,
      },
    },
  };
}

export function setCardGridColumnsSlice(
  prefs: ProductListPrefs,
  deviceClass: DeviceClass,
  columns: CardGridColumnCount
): ProductListPrefs {
  const max = getMaxCardGridColumns(deviceClass);
  const clamped = parseCardGridColumnCount(Math.min(columns, max), 1);
  return clampCardGridColumns({
    ...prefs,
    cardGridColumns: {
      ...prefs.cardGridColumns,
      [deviceClass]: clamped,
    },
  });
}

export function getOrderedVisibleColumns(
  prefs: ProductListPrefs,
  viewMode: ProductListViewMode,
  deviceClass: DeviceClass
): ProductListColumnId[] {
  return getOrderedVisibleListColumns(getColumnPrefsSlice(prefs, viewMode, deviceClass));
}

export function bumpProductListPrefsRevision(prefs: ProductListPrefs): ProductListPrefs {
  return {
    ...prefs,
    clientRevision: (prefs.clientRevision ?? 0) + 1,
  };
}

export function resolvePrefsOnMount(
  serverPrefs: ProductListPrefs | null | undefined,
  localPrefs: ProductListPrefs | null | undefined
): ProductListPrefs {
  const server = serverPrefs ? coerceProductListPrefs(serverPrefs) : null;
  const local = localPrefs ? coerceProductListPrefs(localPrefs) : null;

  if (!server && !local) return getDefaultProductListPrefs();
  if (!server && local) return local;
  if (server && !local) return server;

  const resolvedLocal = local!;
  const resolvedServer = server!;
  const localRevision = resolvedLocal.clientRevision ?? 0;
  const serverRevision = resolvedServer.clientRevision ?? 0;

  if (localRevision > serverRevision) return resolvedLocal;
  return resolvedServer;
}

export function mergeInitialProductListPrefs(
  serverPrefs: ProductListPrefs | null | undefined,
  localPrefs: ProductListPrefs | null | undefined
): ProductListPrefs {
  return resolvePrefsOnMount(serverPrefs, localPrefs ?? null);
}

export function shouldPersistPrefsImmediately(
  previous: ProductListPrefs,
  next: ProductListPrefs
): boolean {
  if (previous.viewMode !== next.viewMode) return true;
  if (previous.frozenColumnCount !== next.frozenColumnCount) return true;
  if (previous.sortField !== next.sortField || previous.sortDirection !== next.sortDirection) {
    return true;
  }
  if (JSON.stringify(previous.cardGridColumns) !== JSON.stringify(next.cardGridColumns)) {
    return true;
  }
  return false;
}

export function didColumnSettingsChange(
  previous: ProductListPrefs,
  next: ProductListPrefs
): boolean {
  if (previous.frozenColumnCount !== next.frozenColumnCount) return true;
  if (JSON.stringify(previous.columnPrefs) !== JSON.stringify(next.columnPrefs)) return true;
  if (JSON.stringify(previous.cardGridColumns) !== JSON.stringify(next.cardGridColumns)) {
    return true;
  }
  return false;
}
