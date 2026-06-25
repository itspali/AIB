import {
  getDefaultListColumnPrefs,
  getOrderedVisibleColumns as getOrderedVisibleListColumns,
  normalizeListColumnPrefs,
} from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { DEVICE_CLASSES, type DeviceClass } from "@/lib/layout/device-class";
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

const LEGACY_CARD_LAYOUT_STORAGE_KEY = "aib-card-layout-preview";

export type { DeviceClass } from "@/lib/layout/device-class";

export type ProductListViewMode = "table" | "compact" | "card";

export const PRODUCT_LIST_VIEW_MODES: ProductListViewMode[] = ["table", "compact", "card"];

export function isCardViewMode(viewMode: ProductListViewMode): boolean {
  return viewMode === "card";
}

/** Primary images are needed on first paint for card grid and table image column. */
export function shouldIncludeListImages(prefs: ProductListPrefs | null | undefined): boolean {
  if (!prefs) return false;
  const coerced = coerceProductListPrefs(prefs);
  if (isCardViewMode(coerced.viewMode)) return true;
  if (!isTableLikeViewMode(coerced.viewMode)) return false;
  const slice = getColumnPrefsSlice(
    coerced,
    coerced.viewMode,
    "desktop",
    isCardViewMode(coerced.viewMode)
      ? { cardLayout: coerced.cardLayout, cardOrientation: coerced.cardOrientation }
      : undefined
  );
  return getOrderedVisibleListColumns(slice).includes("image");
}

/** Card grid tile style: detailed structured tiles or shop catalog grid. */
export type ProductCardLayout = "v2" | "shop";

export const PRODUCT_CARD_LAYOUTS: ProductCardLayout[] = ["v2", "shop"];

export function isShopCardLayout(layout: ProductCardLayout): boolean {
  return layout === "shop";
}

export function parseProductCardLayout(value: unknown): ProductCardLayout {
  if (value === "shop") return "shop";
  return "v2";
}

/** Detail card tile orientation (shop tiles stay vertical). */
export type ProductCardOrientation = "vertical" | "horizontal";

export const PRODUCT_CARD_ORIENTATIONS: ProductCardOrientation[] = ["vertical", "horizontal"];

export function parseProductCardOrientation(value: unknown): ProductCardOrientation {
  return value === "horizontal" ? "horizontal" : "vertical";
}

/** Footer meta on horizontal/detail cards: full labels or compact icons. */
export type ProductCardMetaDisplay = "labels" | "icons";

export const PRODUCT_CARD_META_DISPLAYS: ProductCardMetaDisplay[] = ["labels", "icons"];

export function parseProductCardMetaDisplay(value: unknown): ProductCardMetaDisplay {
  return value === "icons" ? "icons" : "labels";
}

export function isTableLikeViewMode(viewMode: ProductListViewMode): boolean {
  return viewMode === "table" || viewMode === "compact";
}

/** User-facing Items list layouts (toolbar + column settings). */
export type ProductListDisplayPreset = "list" | "horizontal" | "shop";

export const PRODUCT_LIST_DISPLAY_PRESETS: ProductListDisplayPreset[] = [
  "list",
  "horizontal",
  "shop",
];

export function getProductListDisplayPreset(prefs: ProductListPrefs): ProductListDisplayPreset {
  if (prefs.viewMode === "table" || prefs.viewMode === "compact") return "list";
  if (prefs.cardLayout === "shop") return "shop";
  return "horizontal";
}

export function isProductListDisplayPresetActive(
  prefs: ProductListPrefs,
  preset: ProductListDisplayPreset
): boolean {
  return getProductListDisplayPreset(prefs) === preset;
}

export function applyProductListDisplayPreset(
  prefs: ProductListPrefs,
  preset: ProductListDisplayPreset
): ProductListPrefs {
  switch (preset) {
    case "list":
      return { ...prefs, viewMode: "table" };
    case "horizontal":
      return {
        ...prefs,
        viewMode: "card",
        cardLayout: "v2",
        cardOrientation: "horizontal",
      };
    case "shop":
      return { ...prefs, viewMode: "card", cardLayout: "shop" };
  }
}

export function getColumnPrefsContextForDisplayPreset(
  preset: ProductListDisplayPreset
): ColumnPrefsCardContext | undefined {
  if (preset === "list") return undefined;
  if (preset === "shop") return { cardLayout: "shop", cardOrientation: "vertical" };
  return { cardLayout: "v2", cardOrientation: "horizontal" };
}

export function normalizeProductListDisplayPrefs(prefs: ProductListPrefs): ProductListPrefs {
  let normalized = prefs;
  if (normalized.viewMode === "compact") {
    normalized = { ...normalized, viewMode: "table" };
  }
  if (normalized.viewMode === "card" && normalized.cardLayout === "v2") {
    if (normalized.cardOrientation === "vertical") {
      normalized = { ...normalized, cardOrientation: "horizontal" };
    }
  }
  return normalized;
}
export const CARD_GRID_COLUMN_VALUES = [1, 2, 3, 4, 5, 6] as const;

export type CardGridColumnCount = (typeof CARD_GRID_COLUMN_VALUES)[number];

export function isCardGridColumnCount(value: number): value is CardGridColumnCount {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

export type ProductListFrozenColumnCount = 0 | 1 | 2 | 3;

export const AUTO_LAYOUT_PREF = "auto" as const;
export type CardGridColumnPref = CardGridColumnCount | typeof AUTO_LAYOUT_PREF;
export type FrozenColumnPref = ProductListFrozenColumnCount | typeof AUTO_LAYOUT_PREF;

export const PRODUCT_LIST_PREFS_VERSION = 10;

/** Variants list toggle defaults off on every load; not restored from storage. */
export const DEFAULT_SHOW_VARIANTS = false;

export type ProductListColumnPrefsByContext = Record<
  ProductListViewMode,
  Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>
>;

/** Per card tile style — column selections do not bleed across Shop / Detail layouts. */
export type CardColumnVariant = "shop" | "v2Vertical" | "v2Horizontal";

export type CardVariantColumnPrefs = Record<
  CardColumnVariant,
  Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>
>;

export type ColumnPrefsCardContext = {
  cardLayout: ProductCardLayout;
  cardOrientation: ProductCardOrientation;
};

export type CardGridColumnsByDevice = Record<DeviceClass, CardGridColumnPref>;

export type ProductListPrefs = {
  prefsVersion: number;
  clientRevision: number;
  viewMode: ProductListViewMode;
  columnPrefs: ProductListColumnPrefsByContext;
  cardGridColumns: CardGridColumnsByDevice;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  /** When true, table view lists one row per variant for multi-variant items. */
  showVariants: boolean;
  /** Tile style when viewMode is card. */
  cardLayout: ProductCardLayout;
  /** Detail card row layout (ignored for shop tiles). */
  cardOrientation: ProductCardOrientation;
  /** Footer meta density on detail cards. */
  cardMetaDisplay: ProductCardMetaDisplay;
  /** Column prefs for each card tile variant (shop, detail vertical, detail horizontal). */
  cardVariantColumnPrefs: CardVariantColumnPrefs;
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

const CARD_DESKTOP_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "classification",
  "category_name",
  "is_active",
  "updated_at",
];

const CARD_TABLET_VISIBLE: ProductListColumnId[] = [
  "image",
  "name",
  "default_sku",
  "category_name",
  "is_active",
  "updated_at",
];

const CARD_MOBILE_VISIBLE: ProductListColumnId[] = [
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
    mobile: AUTO_LAYOUT_PREF,
    tablet: AUTO_LAYOUT_PREF,
    desktop: AUTO_LAYOUT_PREF,
  };
}

export function getAutoCardGridColumns(deviceClass: DeviceClass): CardGridColumnCount {
  switch (deviceClass) {
    case "mobile":
      return 1;
    case "tablet":
      return 2;
    case "desktop":
      return 2;
  }
}

export function getAutoFrozenColumnCount(deviceClass: DeviceClass): ProductListFrozenColumnCount {
  switch (deviceClass) {
    case "mobile":
      return 0;
    case "tablet":
      return 1;
    case "desktop":
      return 2;
  }
}

export function getMaxCardGridColumns(deviceClass: DeviceClass): CardGridColumnCount {
  switch (deviceClass) {
    case "mobile":
      return 2;
    case "tablet":
      return 4;
    case "desktop":
      return 6;
  }
}

export function resolveCardGridColumns(
  prefs: ProductListPrefs,
  deviceClass: DeviceClass
): CardGridColumnCount {
  const max = getMaxCardGridColumns(deviceClass);
  const requested = prefs.cardGridColumns[deviceClass];
  const resolved =
    requested === AUTO_LAYOUT_PREF ? getAutoCardGridColumns(deviceClass) : requested;
  return (Math.min(resolved, max) as CardGridColumnCount) || 1;
}

export function resolveFrozenColumnCount(
  prefs: ProductListPrefs,
  deviceClass: DeviceClass
): ProductListFrozenColumnCount {
  if (deviceClass === "mobile") return 0;
  if (prefs.frozenColumnCount === AUTO_LAYOUT_PREF) {
    return getAutoFrozenColumnCount(deviceClass);
  }
  return prefs.frozenColumnCount;
}

export function supportsProductListVariantExpansion(
  viewMode: ProductListViewMode
): boolean {
  return isTableLikeViewMode(viewMode) || isCardViewMode(viewMode);
}

export function resolveProductListExpandVariants(
  showVariants: boolean,
  viewMode: ProductListViewMode
): boolean {
  return showVariants && supportsProductListVariantExpansion(viewMode);
}

function parseCardGridColumnPref(
  value: unknown,
  fallback: CardGridColumnPref
): CardGridColumnPref {
  if (value === AUTO_LAYOUT_PREF) return AUTO_LAYOUT_PREF;
  if (typeof value === "number" && isCardGridColumnCount(value)) return value;
  return fallback;
}

export function clampCardGridColumns(prefs: ProductListPrefs): ProductListPrefs {
  const defaults = getDefaultCardGridColumns();
  const cardGridColumns = {} as CardGridColumnsByDevice;

  for (const deviceClass of DEVICE_CLASSES) {
    const max = getMaxCardGridColumns(deviceClass);
    const raw = prefs.cardGridColumns?.[deviceClass] ?? defaults[deviceClass];
    if (raw === AUTO_LAYOUT_PREF) {
      cardGridColumns[deviceClass] = AUTO_LAYOUT_PREF;
      continue;
    }
    cardGridColumns[deviceClass] = parseCardGridColumnPref(
      Math.min(raw, max),
      defaults[deviceClass] === AUTO_LAYOUT_PREF
        ? getAutoCardGridColumns(deviceClass)
        : (defaults[deviceClass] as CardGridColumnCount)
    );
  }

  return { ...prefs, cardGridColumns };
}

function cloneColumnPrefsSlice(
  slice: ListColumnPrefs<ProductListColumnId>
): ListColumnPrefs<ProductListColumnId> {
  return normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, {
    columnOrder: [...slice.columnOrder],
    visibleColumns: [...slice.visibleColumns],
    columnWidths: slice.columnWidths ? { ...slice.columnWidths } : undefined,
    columnWrapModes: slice.columnWrapModes ? { ...slice.columnWrapModes } : undefined,
    columnChipDisplay: slice.columnChipDisplay
      ? JSON.parse(JSON.stringify(slice.columnChipDisplay))
      : undefined,
  });
}

function cloneDeviceColumnPrefs(
  source: Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>
): Record<DeviceClass, ListColumnPrefs<ProductListColumnId>> {
  return {
    mobile: cloneColumnPrefsSlice(source.mobile),
    tablet: cloneColumnPrefsSlice(source.tablet),
    desktop: cloneColumnPrefsSlice(source.desktop),
  };
}

export function resolveCardColumnVariant(
  cardLayout: ProductCardLayout,
  cardOrientation: ProductCardOrientation
): CardColumnVariant {
  if (cardLayout === "shop") return "shop";
  return cardOrientation === "horizontal" ? "v2Horizontal" : "v2Vertical";
}

export function getDefaultCardVariantColumnPrefs(): CardVariantColumnPrefs {
  const cardDefaults = getDefaultProductListColumnPrefsByContext().card;
  return {
    shop: cloneDeviceColumnPrefs(cardDefaults),
    v2Vertical: cloneDeviceColumnPrefs(cardDefaults),
    v2Horizontal: cloneDeviceColumnPrefs(cardDefaults),
  };
}

export function getDefaultProductListColumnPrefsByContext(): ProductListColumnPrefsByContext {
  const desktopTable = getDefaultListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY);
  const table = {
    desktop: desktopTable,
    tablet: buildContextPrefs(TABLE_TABLET_VISIBLE),
    mobile: buildContextPrefs(TABLE_MOBILE_VISIBLE),
  };
  return {
    table,
    compact: cloneDeviceColumnPrefs(table),
    card: {
      desktop: buildContextPrefs(CARD_DESKTOP_VISIBLE),
      tablet: buildContextPrefs(CARD_TABLET_VISIBLE),
      mobile: buildContextPrefs(CARD_MOBILE_VISIBLE),
    },
  };
}

function parseFrozenColumnCount(value: unknown): FrozenColumnPref {
  if (value === AUTO_LAYOUT_PREF) return AUTO_LAYOUT_PREF;
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
    frozenColumnCount: AUTO_LAYOUT_PREF,
    columnPrefs: getDefaultProductListColumnPrefsByContext(),
    cardGridColumns: getDefaultCardGridColumns(),
    showVariants: DEFAULT_SHOW_VARIANTS,
    cardLayout: "v2",
    cardOrientation: "horizontal",
    cardMetaDisplay: "labels",
    cardVariantColumnPrefs: getDefaultCardVariantColumnPrefs(),
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
    parsed.prefsVersion !== 3 &&
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
    card: {
      desktop: legacy,
      tablet: defaults.card.tablet,
      mobile: defaults.card.mobile,
    },
    compact: cloneDeviceColumnPrefs(defaults.table),
  };
}

function migrateV5ColumnPrefsToV6(
  raw: Partial<ProductListColumnPrefsByContext>
): ProductListColumnPrefsByContext {
  const defaults = getDefaultProductListColumnPrefsByContext();
  const tableSource = raw.table ?? defaults.table;
  const cardSource = raw.card ?? raw.compact ?? defaults.card;
  const compactSource = raw.compact && raw.card ? raw.compact : null;

  const result = {} as ProductListColumnPrefsByContext;

  for (const viewMode of PRODUCT_LIST_VIEW_MODES) {
    result[viewMode] = {} as Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>;
    const source =
      viewMode === "table"
        ? tableSource
        : viewMode === "card"
          ? cardSource
          : compactSource ?? tableSource;

    for (const deviceClass of DEVICE_CLASSES) {
      result[viewMode][deviceClass] = normalizeListColumnPrefs(
        PRODUCT_LIST_COLUMN_REGISTRY,
        source[deviceClass] ?? defaults[viewMode][deviceClass]
      );
    }
  }

  if (!compactSource) {
    result.compact = cloneDeviceColumnPrefs(result.table);
  }

  return result;
}

function migrateV2ColumnPrefs(
  raw: Partial<ProductListColumnPrefsByContext>
): ProductListColumnPrefsByContext {
  const defaults = getDefaultProductListColumnPrefsByContext();
  const legacy = {} as ProductListColumnPrefsByContext;

  for (const viewMode of ["table", "compact"] as const) {
    legacy[viewMode] = {} as Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>;
    const v2Slice = raw[viewMode] as
      | Partial<Record<"mobile" | "desktop", ListColumnPrefs<ProductListColumnId>>>
      | undefined;

    for (const deviceClass of DEVICE_CLASSES) {
      const slice = v2Slice?.[deviceClass as "mobile" | "desktop"];
      if (slice) {
        legacy[viewMode][deviceClass] = normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, slice);
      } else if (deviceClass === "tablet") {
        const fallback =
          v2Slice?.desktop ?? v2Slice?.mobile ?? defaults[viewMode === "compact" ? "card" : viewMode][deviceClass];
        legacy[viewMode][deviceClass] = normalizeListColumnPrefs(
          PRODUCT_LIST_COLUMN_REGISTRY,
          fallback
        );
      } else {
        legacy[viewMode][deviceClass] = normalizeListColumnPrefs(
          PRODUCT_LIST_COLUMN_REGISTRY,
          v2Slice?.[deviceClass as "mobile" | "desktop"] ??
            defaults[viewMode === "compact" ? "card" : viewMode][deviceClass]
        );
      }
    }
  }

  return migrateV5ColumnPrefsToV6(legacy);
}

function parseColumnPrefsByContext(raw: unknown): ProductListColumnPrefsByContext | null {
  if (!raw || typeof raw !== "object") return null;

  const parsed = raw as Partial<ProductListColumnPrefsByContext>;
  const hasTablet = Boolean(parsed.table?.tablet || parsed.compact?.tablet || parsed.card?.tablet);

  if (!hasTablet) {
    return migrateV2ColumnPrefs(parsed);
  }

  if (!parsed.card) {
    return migrateV5ColumnPrefsToV6(parsed);
  }

  const defaults = getDefaultProductListColumnPrefsByContext();
  const result = {} as ProductListColumnPrefsByContext;

  for (const viewMode of PRODUCT_LIST_VIEW_MODES) {
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

function parseCardVariantColumnPrefs(
  raw: unknown,
  legacyCard: Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>,
  prefsVersion: number
): CardVariantColumnPrefs {
  const defaults = getDefaultCardVariantColumnPrefs();

  if (prefsVersion >= PRODUCT_LIST_PREFS_VERSION && raw && typeof raw === "object") {
    const parsed = raw as Partial<CardVariantColumnPrefs>;
    const result = {} as CardVariantColumnPrefs;

    for (const variant of ["shop", "v2Vertical", "v2Horizontal"] as const) {
      result[variant] = {} as Record<DeviceClass, ListColumnPrefs<ProductListColumnId>>;
      for (const deviceClass of DEVICE_CLASSES) {
        const slice = parsed[variant]?.[deviceClass];
        result[variant][deviceClass] = normalizeListColumnPrefs(
          PRODUCT_LIST_COLUMN_REGISTRY,
          slice ?? defaults[variant][deviceClass]
        );
      }
    }

    return result;
  }

  return {
    shop: cloneDeviceColumnPrefs(legacyCard),
    v2Vertical: cloneDeviceColumnPrefs(legacyCard),
    v2Horizontal: cloneDeviceColumnPrefs(legacyCard),
  };
}

function parseViewMode(value: unknown, prefsVersion: number): ProductListViewMode {
  if (prefsVersion >= 10) {
    if (value === "table" || value === "card") return value;
    return "table";
  }
  if (prefsVersion >= 8) {
    if (value === "table" || value === "compact" || value === "card") return value;
    return "table";
  }
  // v5 and below: persisted "compact" meant card grid.
  if (value === "compact") return "card";
  return "table";
}

function parseCardGridColumns(raw: unknown): CardGridColumnsByDevice {
  const defaults = getDefaultCardGridColumns();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<CardGridColumnsByDevice>;
  return {
    mobile: parseCardGridColumnPref(parsed.mobile, defaults.mobile),
    tablet: parseCardGridColumnPref(parsed.tablet, defaults.tablet),
    desktop: parseCardGridColumnPref(parsed.desktop, defaults.desktop),
  };
}

export function coerceProductListPrefs(raw: unknown): ProductListPrefs {
  const defaults = getDefaultProductListPrefs();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as LegacyFlatProductListPrefs;
  const rawVersion =
    typeof parsed.prefsVersion === "number" && Number.isFinite(parsed.prefsVersion)
      ? parsed.prefsVersion
      : 0;
  const viewMode = parseViewMode(parsed.viewMode, rawVersion);
  const sortField = isProductListSortField(parsed.sortField ?? "")
    ? (parsed.sortField as ProductListSortField)
    : defaults.sortField;
  const sortDirection = parsed.sortDirection === "desc" ? "desc" : "asc";
  const frozenColumnCount = parseFrozenColumnCount(parsed.frozenColumnCount);

  const columnPrefs = isLegacyFlatPrefs(parsed)
    ? migrateLegacyFlatPrefs(parsed)
    : parseColumnPrefsByContext(parsed.columnPrefs) ?? defaults.columnPrefs;

  const cardGridColumns =
    rawVersion >= 8
      ? parseCardGridColumns(parsed.cardGridColumns)
      : getDefaultCardGridColumns();
  const showVariants = parsed.showVariants === true;
  const partial = parsed as Partial<ProductListPrefs>;
  const cardLayout = parseProductCardLayout(partial.cardLayout);
  const cardOrientation =
    rawVersion >= 8
      ? parseProductCardOrientation(partial.cardOrientation)
      : defaults.cardOrientation;
  const cardMetaDisplay =
    rawVersion >= 8
      ? parseProductCardMetaDisplay(partial.cardMetaDisplay)
      : defaults.cardMetaDisplay;
  const cardVariantColumnPrefs = parseCardVariantColumnPrefs(
    partial.cardVariantColumnPrefs,
    columnPrefs.card,
    rawVersion
  );

  return normalizeProductListDisplayPrefs(
    clampCardGridColumns({
      prefsVersion: PRODUCT_LIST_PREFS_VERSION,
      clientRevision: parseClientRevision(parsed.clientRevision),
      viewMode,
      sortField,
      sortDirection,
      frozenColumnCount,
      columnPrefs,
      cardGridColumns,
      showVariants,
      cardLayout,
      cardOrientation,
      cardMetaDisplay,
      cardVariantColumnPrefs,
    })
  );
}

function readLegacyCardLayoutPreviewStorage(): ProductCardLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LEGACY_CARD_LAYOUT_STORAGE_KEY);
    // Legacy preview stored "v2" when the UI label was Shop.
    if (stored === "v2") return "shop";
    if (stored === "shop") return "shop";
    if (stored === "legacy") return "v2";
    return null;
  } catch {
    return null;
  }
}

function clearLegacyCardLayoutPreviewStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_CARD_LAYOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function applyLegacyCardLayoutStorageMigration(prefs: ProductListPrefs): ProductListPrefs {
  if (typeof window === "undefined") return prefs;

  const legacy = readLegacyCardLayoutPreviewStorage();
  if (!legacy) return prefs;
  clearLegacyCardLayoutPreviewStorage();
  if (prefs.cardLayout === legacy) return prefs;
  return { ...prefs, cardLayout: legacy };
}

export function loadProductListPrefs(): ProductListPrefs | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(PRODUCT_LIST_COLUMN_REGISTRY.storageKey);
    if (!raw) return null;

    return applyLegacyCardLayoutStorageMigration(coerceProductListPrefs(JSON.parse(raw)));
  } catch {
    return null;
  }
}

export function applyShowVariantsDefault(prefs: ProductListPrefs): ProductListPrefs {
  return { ...prefs, showVariants: DEFAULT_SHOW_VARIANTS };
}

export function saveProductListPrefs(prefs: ProductListPrefs): void {
  if (typeof window === "undefined") return;
  try {
    const normalized = clampCardGridColumns({
      ...prefs,
      showVariants: DEFAULT_SHOW_VARIANTS,
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

function resolveCardContext(
  prefs: ProductListPrefs,
  cardContext?: ColumnPrefsCardContext
): ColumnPrefsCardContext {
  return {
    cardLayout: cardContext?.cardLayout ?? prefs.cardLayout,
    cardOrientation: cardContext?.cardOrientation ?? prefs.cardOrientation,
  };
}

export function getColumnPrefsSlice(
  prefs: ProductListPrefs,
  viewMode: ProductListViewMode,
  deviceClass: DeviceClass,
  cardContext?: ColumnPrefsCardContext
): ListColumnPrefs<ProductListColumnId> {
  if (viewMode === "card") {
    const variant = resolveCardColumnVariant(
      resolveCardContext(prefs, cardContext).cardLayout,
      resolveCardContext(prefs, cardContext).cardOrientation
    );
    return prefs.cardVariantColumnPrefs[variant][deviceClass];
  }
  return prefs.columnPrefs[viewMode][deviceClass];
}

export function setColumnPrefsSlice(
  prefs: ProductListPrefs,
  viewMode: ProductListViewMode,
  deviceClass: DeviceClass,
  slice: ListColumnPrefs<ProductListColumnId>,
  cardContext?: ColumnPrefsCardContext
): ProductListPrefs {
  if (viewMode === "card") {
    const variant = resolveCardColumnVariant(
      resolveCardContext(prefs, cardContext).cardLayout,
      resolveCardContext(prefs, cardContext).cardOrientation
    );
    return {
      ...prefs,
      cardVariantColumnPrefs: {
        ...prefs.cardVariantColumnPrefs,
        [variant]: {
          ...prefs.cardVariantColumnPrefs[variant],
          [deviceClass]: slice,
        },
      },
    };
  }

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

/** Applies the same column prefs to every device breakpoint (split-feed unified columns). */
export function setColumnPrefsSliceAllDevices(
  prefs: ProductListPrefs,
  viewMode: ProductListViewMode,
  slice: ListColumnPrefs<ProductListColumnId>,
  cardContext?: ColumnPrefsCardContext
): ProductListPrefs {
  let next = prefs;
  for (const deviceClass of DEVICE_CLASSES) {
    next = setColumnPrefsSlice(next, viewMode, deviceClass, slice, cardContext);
  }
  return next;
}

export function setCardGridColumnsSlice(
  prefs: ProductListPrefs,
  deviceClass: DeviceClass,
  columns: CardGridColumnPref
): ProductListPrefs {
  if (columns === AUTO_LAYOUT_PREF) {
    return {
      ...prefs,
      cardGridColumns: {
        ...prefs.cardGridColumns,
        [deviceClass]: AUTO_LAYOUT_PREF,
      },
    };
  }

  const max = getMaxCardGridColumns(deviceClass);
  const clamped = parseCardGridColumnPref(
    Math.min(columns, max),
    getAutoCardGridColumns(deviceClass)
  ) as CardGridColumnCount;
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
  deviceClass: DeviceClass,
  cardContext?: ColumnPrefsCardContext
): ProductListColumnId[] {
  return getOrderedVisibleListColumns(
    getColumnPrefsSlice(prefs, viewMode, deviceClass, cardContext)
  );
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
  if (!server && local) return applyShowVariantsDefault(local);
  if (server && !local) return applyShowVariantsDefault(server);

  const resolvedLocal = local!;
  const resolvedServer = server!;
  const localRevision = resolvedLocal.clientRevision ?? 0;
  const serverRevision = resolvedServer.clientRevision ?? 0;

  if (localRevision > serverRevision) return applyShowVariantsDefault(resolvedLocal);
  return applyShowVariantsDefault(resolvedServer);
}

export function mergeInitialProductListPrefs(
  serverPrefs: ProductListPrefs | null | undefined,
  localPrefs: ProductListPrefs | null | undefined
): ProductListPrefs {
  return resolvePrefsOnMount(serverPrefs, localPrefs ?? null);
}

export function isShowVariantsOnlyPrefChange(
  previous: ProductListPrefs,
  next: ProductListPrefs
): boolean {
  if (previous.showVariants === next.showVariants) return false;
  const { showVariants: _prev, ...prevRest } = previous;
  const { showVariants: _next, ...nextRest } = next;
  return JSON.stringify(prevRest) === JSON.stringify(nextRest);
}

export function shouldPersistPrefsImmediately(
  previous: ProductListPrefs,
  next: ProductListPrefs
): boolean {
  if (previous.viewMode !== next.viewMode) return true;
  if (previous.showVariants !== next.showVariants && !isShowVariantsOnlyPrefChange(previous, next)) {
    return true;
  }
  if (previous.cardLayout !== next.cardLayout) return true;
  if (previous.cardOrientation !== next.cardOrientation) return true;
  if (previous.cardMetaDisplay !== next.cardMetaDisplay) return true;
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
  if (
    JSON.stringify(previous.cardVariantColumnPrefs) !==
    JSON.stringify(next.cardVariantColumnPrefs)
  ) {
    return true;
  }
  if (JSON.stringify(previous.cardGridColumns) !== JSON.stringify(next.cardGridColumns)) {
    return true;
  }
  if (previous.cardLayout !== next.cardLayout) return true;
  if (previous.cardOrientation !== next.cardOrientation) return true;
  if (previous.cardMetaDisplay !== next.cardMetaDisplay) return true;
  return false;
}
