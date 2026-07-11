"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { saveProductListUserPrefs, fetchMoreProductListRows, hydrateProductListImageUrls } from "@/app/items/actions";
import { ListWorkspaceLayoutToggle } from "@/components/layout/list-workspace-layout-toggle";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useDeviceClass } from "@/hooks/use-device-class";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { useListWorkspace } from "@/lib/layout/list-workspace";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { resolveListPaneLayoutOverrides } from "@/lib/products/list-pane-layout";
import {
  AUTO_LAYOUT_PREF,
  bumpProductListPrefsRevision,
  coerceProductListPrefs,
  didColumnSettingsChange,
  getColumnPrefsSlice,
  isTableLikeViewMode,
  loadProductListPrefs,
  resolveCardGridColumns,
  resolveFrozenColumnCount,
  resolvePrefsOnMount,
  resolveProductListExpandVariants,
  saveProductListPrefs,
  setColumnPrefsSlice,
  shouldPersistPrefsImmediately,
  supportsProductListVariantExpansion,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";
import { resolveColumnWrapModes, resolveVisibleColumns } from "@/lib/products/resolve-list-columns";
import {
  ITEMS_WORKSPACE_PINNED_COLUMNS,
  withPinnedVisibleColumns,
  withoutItemsWorkspaceDisabledColumns,
} from "@/lib/items/split-feed-card-plan";
import { filterSkuGrainExportRows } from "@/lib/products/list-sku-export";
import {
  listHasExpandedVariantRows,
  mergeProductListRowImages,
} from "@/lib/products/list-row-key";
import {
  countDisplayedProductListRows,
  shapeDisplayedProductListRows,
} from "@/lib/products/shape-displayed-product-list";
import type { ProductListSortDirection, ProductListSortField } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import { ITEMS_HREF } from "@/lib/products/item-navigation";
import { isItemsRouteSessionActive } from "@/lib/products/items-route-generation";
import { applyProductListStructuralFilters } from "@/lib/products/resolve-structural-list-filter";

const ProductListToolbarCount = lazyClientExport(
  () => import("@/components/products/product-list-toolbar"),
  "ProductListToolbarCount"
);

const ProductListToolbarControls = lazyClientExport(
  () => import("@/components/products/product-list-toolbar"),
  "ProductListToolbarControls"
);

const PREFS_SAVE_DEBOUNCE_MS = 500;
const LIST_IMAGE_HYDRATION_MAX = 500;
const LIST_IMAGE_HYDRATION_DEFER_MS = 200;

export type ProductListWorkspaceTableContext = {
  displayedProducts: ProductListRow[];
  visibleColumns: ProductListColumnId[];
  columnWrapModes: Partial<Record<ProductListColumnId, TextWrapMode>>;
  columnChipDisplay: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  columnWidths: Partial<Record<ProductListColumnId, number>> | undefined;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  onSortChange: (sortField: ProductListSortField, sortDirection: ProductListSortDirection) => void;
  onColumnWidthChange: (columnId: ProductListColumnId, width: number | null) => void;
  effectiveExpandVariants: boolean;
  listDisplayDeviceClass: ReturnType<typeof useDeviceClass>["deviceClass"];
  frozenColumnCount: ReturnType<typeof resolveListPaneLayoutOverrides>["frozenColumnCount"];
  freezeColumnsAuto: boolean;
  prefsHydrated: boolean;
  isExpandVariantsSyncing: boolean;
  filteredCount: number;
  categoryFilter: string;
  totalCount: number;
};

export type ProductListWorkspaceHostProps = {
  products: ProductListRow[];
  totalCount: number;
  categories: CategoryRow[];
  fieldPermissions: ProductFieldPermissions;
  initialListPrefs: ProductListPrefs | null;
  expandVariants: boolean;
  onExpandVariantsChange: (nextExpandVariants: boolean, source?: "sync" | "user") => void;
  detailPaneOpen?: boolean;
  listCountPending?: boolean;
  itemsRouteSession?: number;
  ssrListReady?: boolean;
  structuralFilterResolved?: boolean;
  /** Width of the list pane when peek detail is open — drives column layout. */
  listPaneWidth?: number;
  initialListImagesIncluded?: boolean;
  onImagesHydrated?: (imageUrls: Record<string, string | null>) => void;
  onListIncludeImagesChange?: (includeImages: boolean) => void;
  children: (ctx: {
    table: ProductListWorkspaceTableContext;
    toolbarCount: ReactNode;
    toolbarControls: ReactNode;
    resolveExportRows: () => Promise<ProductListRow[]>;
    exportRowCount: number;
    exportColumnIds: ProductListColumnId[];
  }) => ReactNode;
};

export function ProductListWorkspaceHost({
  products,
  totalCount,
  categories,
  fieldPermissions,
  initialListPrefs,
  expandVariants,
  onExpandVariantsChange,
  detailPaneOpen = false,
  listCountPending = false,
  itemsRouteSession = 0,
  ssrListReady = false,
  structuralFilterResolved = false,
  listPaneWidth,
  initialListImagesIncluded = false,
  onImagesHydrated,
  onListIncludeImagesChange,
  children,
}: ProductListWorkspaceHostProps) {
  const { layout, setLayout } = useListWorkspace();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const isOnItemsRoute = useCallback(() => {
    const current = pathnameRef.current;
    return current === ITEMS_HREF || current.startsWith(`${ITEMS_HREF}/`);
  }, []);

  const omnibar = useOptionalOmnibarContext();
  const { deviceClass } = useDeviceClass();

  const [categoryFilter, setCategoryFilter] = useState(
    () => resolvePrefsOnMount(initialListPrefs, loadProductListPrefs()).categoryFilterId
  );
  const initialListPrefsRef = useRef(initialListPrefs);
  const hydratedRef = useRef(false);
  const [prefs, setPrefs] = useState<ProductListPrefs>(() =>
    resolvePrefsOnMount(initialListPrefs, loadProductListPrefs())
  );
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSavingColumnPrefs, setIsSavingColumnPrefs] = useState(false);
  const savingColumnPrefsRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPrefsRef = useRef(prefs);
  const suppressPrefsPersistRef = useRef(ssrListReady);
  const userEditedPrefsRef = useRef(false);
  const onExpandVariantsChangeRef = useRef(onExpandVariantsChange);
  onExpandVariantsChangeRef.current = onExpandVariantsChange;

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const localPrefs = loadProductListPrefs();
    const hydrated = resolvePrefsOnMount(initialListPrefsRef.current, localPrefs);
    prevPrefsRef.current = hydrated;
    suppressPrefsPersistRef.current = true;
    setPrefs(hydrated);
    setCategoryFilter(hydrated.categoryFilterId);
    setPrefsHydrated(true);
    onExpandVariantsChangeRef.current?.(
      resolveProductListExpandVariants(hydrated.showVariants, "table"),
      "sync"
    );
  }, []);

  const persistToServer = useCallback(
    async (nextPrefs: ProductListPrefs) => {
      if (!isOnItemsRoute() || !isItemsRouteSessionActive(itemsRouteSession)) return;
      setIsSavingPrefs(true);
      setIsSavingColumnPrefs(savingColumnPrefsRef.current);
      saveProductListPrefs(nextPrefs);
      try {
        const result = await saveProductListUserPrefs(nextPrefs);
        if (!isItemsRouteSessionActive(itemsRouteSession)) return;
        if ("error" in result) {
          toast.error(result.error ?? "Unable to save list layout preferences.");
        }
      } finally {
        setIsSavingPrefs(false);
        setIsSavingColumnPrefs(false);
        savingColumnPrefsRef.current = false;
      }
    },
    [isOnItemsRoute, itemsRouteSession]
  );

  useEffect(() => {
    if (!prefsHydrated) return;
    if (suppressPrefsPersistRef.current) {
      suppressPrefsPersistRef.current = false;
      prevPrefsRef.current = prefs;
      return;
    }
    if (ssrListReady && !userEditedPrefsRef.current) {
      prevPrefsRef.current = prefs;
      return;
    }
    const previous = prevPrefsRef.current;
    if (previous === prefs) return;
    prevPrefsRef.current = prefs;
    saveProductListPrefs(prefs);
    savingColumnPrefsRef.current = didColumnSettingsChange(previous, prefs);
    if (shouldPersistPrefsImmediately(previous, prefs)) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persistToServer(prefs);
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persistToServer(prefs);
    }, PREFS_SAVE_DEBOUNCE_MS);
  }, [persistToServer, prefs, prefsHydrated, ssrListReady]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handlePrefsChange = useCallback(
    (next: ProductListPrefs | ((current: ProductListPrefs) => ProductListPrefs)) => {
      userEditedPrefsRef.current = true;
      setPrefs((current) => {
        const resolved = typeof next === "function" ? next(current) : next;
        return bumpProductListPrefsRevision(resolved);
      });
    },
    []
  );

  const displayViewMode = "table" as const;
  const supportsVariantExpansion = supportsProductListVariantExpansion(displayViewMode);
  const effectiveExpandVariants = supportsVariantExpansion && expandVariants;
  const isExpandVariantsSyncing =
    supportsVariantExpansion && prefs.showVariants !== expandVariants;

  useEffect(() => {
    if (omnibar?.scopePinnedToAll) {
      setCategoryFilter("all");
      handlePrefsChange((current) =>
        current.categoryFilterId === "all"
          ? current
          : { ...current, categoryFilterId: "all" }
      );
    }
  }, [handlePrefsChange, omnibar?.scopePinnedToAll, omnibar?.moduleFilterRevision]);

  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories);
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  const redactedProducts = useMemo(
    () => products.map((row) => redactProductListRow(row, fieldPermissions.allowedFields)),
    [fieldPermissions.allowedFields, products]
  );

  const filteredProducts = useMemo(() => {
    let rows = redactedProducts;
    if (categoryFilter !== "all") {
      rows = rows.filter((product) => product.category_id === categoryFilter);
    }
    rows = applyProductListStructuralFilters(rows, {
      appliedQuery: omnibar?.appliedQuery ?? "",
      activeAst: omnibar?.activeAst ?? [],
      filteredItemIds: omnibar?.filteredItemIds,
      residualText: omnibar?.residualText,
      inlinePreviewText: omnibar?.inlinePreviewText,
      structuralFilterResolved,
    });
    return rows;
  }, [
    redactedProducts,
    categoryFilter,
    omnibar?.appliedQuery,
    omnibar?.filteredItemIds,
    omnibar?.activeAst,
    omnibar?.residualText,
    omnibar?.inlinePreviewText,
    structuralFilterResolved,
  ]);

  const displayedProducts = useMemo(
    () =>
      shapeDisplayedProductListRows(filteredProducts, {
        showVariants: effectiveExpandVariants,
        sortField: prefs.sortField,
        sortDirection: prefs.sortDirection,
        activeAst: omnibar?.activeAst,
      }),
    [
      effectiveExpandVariants,
      filteredProducts,
      omnibar?.activeAst,
      prefs.sortDirection,
      prefs.sortField,
    ]
  );

  const displayedRowCount = useMemo(
    () => countDisplayedProductListRows(displayedProducts, effectiveExpandVariants),
    [displayedProducts, effectiveExpandVariants]
  );

  const baseCardGridColumns = useMemo(
    () => resolveCardGridColumns(prefs, deviceClass),
    [deviceClass, prefs]
  );
  const baseFrozenColumnCount = useMemo(
    () => resolveFrozenColumnCount(prefs, deviceClass),
    [deviceClass, prefs]
  );
  const listPaneLayout = useMemo(
    () =>
      resolveListPaneLayoutOverrides({
        viewportDeviceClass: deviceClass,
        listPaneWidth: layout === "split" ? undefined : listPaneWidth,
        detailPaneOpen: layout === "split" ? false : detailPaneOpen,
        frozenColumnCount: baseFrozenColumnCount,
        cardGridColumns: baseCardGridColumns,
        freezeColumnsAuto: prefs.frozenColumnCount === AUTO_LAYOUT_PREF,
      }),
    [
      baseCardGridColumns,
      baseFrozenColumnCount,
      detailPaneOpen,
      deviceClass,
      layout,
      listPaneWidth,
      prefs.frozenColumnCount,
    ]
  );

  const visibleColumns = useMemo(() => {
    const slice = getColumnPrefsSlice(prefs, displayViewMode, listPaneLayout.deviceClass);
    const orderedVisible = resolveVisibleColumns({
      prefs,
      viewMode: displayViewMode,
      deviceClass: listPaneLayout.deviceClass,
      allowedFields: fieldPermissions.allowedFields,
    });
    return withoutItemsWorkspaceDisabledColumns(
      withPinnedVisibleColumns(
        orderedVisible,
        slice.columnOrder,
        ITEMS_WORKSPACE_PINNED_COLUMNS
      )
    );
  }, [displayViewMode, fieldPermissions.allowedFields, listPaneLayout.deviceClass, prefs]);

  const displayColumns = visibleColumns;

  const shouldHydrateImages = useMemo(
    () => visibleColumns.includes("image"),
    [visibleColumns]
  );

  const imageHydrationRequestedRef = useRef(new Set<string>());
  const imageHydrationFlightRef = useRef(0);
  const productsRef = useRef(products);
  productsRef.current = products;

  useEffect(() => {
    onListIncludeImagesChange?.(shouldHydrateImages);
  }, [onListIncludeImagesChange, shouldHydrateImages]);

  useEffect(() => {
    if (!isOnItemsRoute() || initialListImagesIncluded || !onImagesHydrated) {
      return;
    }

    let cancelled = false;
    const flightId = imageHydrationFlightRef.current + 1;
    imageHydrationFlightRef.current = flightId;

    const deferTimer = window.setTimeout(() => {
      if (
        cancelled ||
        imageHydrationFlightRef.current !== flightId ||
        !isOnItemsRoute() ||
        !isItemsRouteSessionActive(itemsRouteSession) ||
        !prefsHydrated ||
        !shouldHydrateImages
      ) {
        return;
      }

      const pendingIds = productsRef.current
        .filter((row) => !row.image_url && !imageHydrationRequestedRef.current.has(row.id))
        .map((row) => row.id);
      if (!pendingIds.length) return;

      const batch = pendingIds.slice(0, LIST_IMAGE_HYDRATION_MAX);
      for (const id of batch) {
        imageHydrationRequestedRef.current.add(id);
      }

      void hydrateProductListImageUrls(batch).then((result) => {
        if (
          cancelled ||
          imageHydrationFlightRef.current !== flightId ||
          !isItemsRouteSessionActive(itemsRouteSession)
        ) {
          return;
        }
        onImagesHydrated(result.imageUrls);
      });
    }, LIST_IMAGE_HYDRATION_DEFER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(deferTimer);
    };
  }, [
    initialListImagesIncluded,
    isOnItemsRoute,
    itemsRouteSession,
    onImagesHydrated,
    prefsHydrated,
    products,
    shouldHydrateImages,
  ]);

  const columnWrapModes = useMemo(() => {
    const slice = getColumnPrefsSlice(prefs, displayViewMode, listPaneLayout.deviceClass);
    return resolveColumnWrapModes(displayColumns, slice, displayViewMode);
  }, [displayColumns, displayViewMode, listPaneLayout.deviceClass, prefs]);

  const columnChipDisplay = useMemo(() => {
    return getColumnPrefsSlice(prefs, displayViewMode, listPaneLayout.deviceClass).columnChipDisplay;
  }, [displayViewMode, listPaneLayout.deviceClass, prefs]);

  const columnWidths = useMemo(() => {
    if (!isTableLikeViewMode(displayViewMode)) return undefined;
    return getColumnPrefsSlice(prefs, displayViewMode, listPaneLayout.deviceClass).columnWidths;
  }, [displayViewMode, listPaneLayout.deviceClass, prefs]);

  const handleColumnWidthChange = useCallback(
    (columnId: ProductListColumnId, width: number | null) => {
      const layoutDeviceClass = listPaneLayout.deviceClass;
      handlePrefsChange((current) => {
        const slice = getColumnPrefsSlice(current, displayViewMode, layoutDeviceClass);
        const nextWidths = { ...(slice.columnWidths ?? {}) };
        if (width == null) delete nextWidths[columnId];
        else nextWidths[columnId] = width;
        const normalizedWidths = Object.keys(nextWidths).length > 0 ? nextWidths : undefined;
        return setColumnPrefsSlice(current, displayViewMode, layoutDeviceClass, {
          ...slice,
          columnWidths: normalizedWidths,
        });
      });
    },
    [displayViewMode, handlePrefsChange, listPaneLayout.deviceClass]
  );

  const handleSortChange = useCallback(
    (sortField: ProductListSortField, sortDirection: ProductListSortDirection) => {
      handlePrefsChange((current) => ({ ...current, sortField, sortDirection }));
    },
    [handlePrefsChange]
  );

  const layoutToggle = (
    <ListWorkspaceLayoutToggle layout={layout} onLayoutChange={setLayout} disabled={!prefsHydrated} />
  );

  const toolbarProps = {
    categoryFilter,
    onCategoryFilterChange: (value: string) => {
      setCategoryFilter(value);
      handlePrefsChange((current) =>
        current.categoryFilterId === value
          ? current
          : { ...current, categoryFilterId: value }
      );
    },
    categoryOptions,
    prefs,
    onPrefsChange: handlePrefsChange,
    onShowVariantsChange: (checked: boolean) => {
      onExpandVariantsChange(resolveProductListExpandVariants(checked, displayViewMode), "user");
    },
    onExpandVariantsChange: (nextExpand: boolean) => {
      onExpandVariantsChange(nextExpand, "user");
    },
    fieldPermissions,
    detectedDeviceClass: listPaneLayout.deviceClass,
    resultCount: displayedRowCount,
    totalCount,
    prefsHydrated,
    isSavingPrefs,
    isSavingColumnPrefs,
    isExpandVariantsSyncing,
    activeViewMode: displayViewMode,
    compactCountLabel: detailPaneOpen,
    listCountPending,
    workspaceLayoutToggle: layoutToggle,
    hideViewPresets: true as const,
    columnSettingsMode: "items-matrix" as const,
    workspaceLayout: layout,
    compactFilterControls: true as const,
  };

  const toolbarCount = <ProductListToolbarCount {...toolbarProps} />;
  const toolbarControls = <ProductListToolbarControls {...toolbarProps} />;

  const tableContext: ProductListWorkspaceTableContext = {
    displayedProducts,
    visibleColumns: displayColumns,
    columnWrapModes,
    columnChipDisplay: columnChipDisplay ?? {},
    columnWidths,
    sortField: prefs.sortField,
    sortDirection: prefs.sortDirection,
    onSortChange: handleSortChange,
    onColumnWidthChange: handleColumnWidthChange,
    effectiveExpandVariants,
    listDisplayDeviceClass: listPaneLayout.deviceClass,
    frozenColumnCount: listPaneLayout.frozenColumnCount,
    freezeColumnsAuto: listPaneLayout.freezeColumnsAuto,
    prefsHydrated,
    isExpandVariantsSyncing,
    filteredCount: displayedRowCount,
    categoryFilter,
    totalCount,
  };

  const resolveExportRows = useCallback(async (options?: { grain?: "product" | "sku" }) => {
    const grain = options?.grain ?? "product";
    const fetchExpanded = grain === "sku" ? true : effectiveExpandVariants;

    let sourceRows = redactedProducts;
    if (products.length < totalCount) {
      const fetched: ProductListRow[] = [...products];
      let offset = fetched.length;
      while (offset < totalCount) {
        const page = await fetchMoreProductListRows(offset, {
          expandVariants: fetchExpanded,
          includeImages: false,
        });
        if (!isItemsRouteSessionActive(itemsRouteSession)) break;
        fetched.push(...page.rows);
        offset += page.rows.length;
        if (!page.hasMore || page.rows.length === 0) break;
      }
      sourceRows = fetched.map((row) => redactProductListRow(row, fieldPermissions.allowedFields));
    }

    let rows = sourceRows;
    if (categoryFilter !== "all") {
      rows = rows.filter((product) => product.category_id === categoryFilter);
    }
    rows = applyProductListStructuralFilters(rows, {
      appliedQuery: omnibar?.appliedQuery ?? "",
      activeAst: omnibar?.activeAst ?? [],
      filteredItemIds: omnibar?.filteredItemIds,
      residualText: omnibar?.residualText,
      inlinePreviewText: omnibar?.inlinePreviewText,
      structuralFilterResolved,
    });

    const shaped = shapeDisplayedProductListRows(rows, {
      showVariants: fetchExpanded,
      sortField: prefs.sortField,
      sortDirection: prefs.sortDirection,
      activeAst: omnibar?.activeAst,
    });
    if (grain === "sku") {
      return filterSkuGrainExportRows(shaped);
    }
    return shaped;
  }, [
    categoryFilter,
    effectiveExpandVariants,
    fieldPermissions.allowedFields,
    itemsRouteSession,
    omnibar?.activeAst,
    omnibar?.appliedQuery,
    omnibar?.filteredItemIds,
    omnibar?.inlinePreviewText,
    omnibar?.residualText,
    prefs.sortDirection,
    prefs.sortField,
    products,
    redactedProducts,
    structuralFilterResolved,
    totalCount,
  ]);

  return children({
    table: tableContext,
    toolbarCount,
    toolbarControls,
    resolveExportRows,
    exportRowCount: displayedRowCount,
    exportColumnIds: displayColumns,
  });
}

export type UseItemsCatalogExpandVariantsArgs = {
  initialListPrefs: ProductListPrefs | null;
  initialProducts: ProductListRow[];
  products: ProductListRow[];
  setProducts: React.Dispatch<React.SetStateAction<ProductListRow[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  setHasMore: React.Dispatch<React.SetStateAction<boolean>>;
  getIncludeImages: () => boolean;
  itemsRouteSession?: number;
};

export function useItemsCatalogExpandVariants({
  initialListPrefs,
  initialProducts,
  products,
  setProducts,
  setTotalCount,
  setHasMore,
  getIncludeImages,
  itemsRouteSession = 0,
}: UseItemsCatalogExpandVariantsArgs) {
  const initialExpandVariants = resolveProductListExpandVariants(
    coerceProductListPrefs(initialListPrefs ?? {}).showVariants,
    coerceProductListPrefs(initialListPrefs ?? {}).viewMode
  );
  const expandVariantsRef = useRef(initialExpandVariants);
  const [expandVariants, setExpandVariants] = useState(initialExpandVariants);
  const productsRef = useRef(products);
  productsRef.current = products;
  const expandVariantsFetchRequestRef = useRef(0);

  const refetchCatalog = useCallback(
    async (nextExpandVariants: boolean) => {
      const sourceRows = productsRef.current;
      const page = await fetchMoreProductListRows(0, {
        expandVariants: nextExpandVariants,
        includeImages: getIncludeImages(),
      });
      const rows = mergeProductListRowImages(page.rows, sourceRows, nextExpandVariants);
      setProducts(rows);
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    },
    [getIncludeImages, setHasMore, setProducts, setTotalCount]
  );

  const handleExpandVariantsChange = useCallback(
    (nextExpandVariants: boolean, source: "sync" | "user" = "sync") => {
      if (expandVariantsRef.current === nextExpandVariants) return;
      const ssrListReady = initialProducts.length > 0;
      const ssrShapeMatches = nextExpandVariants === initialExpandVariants;
      const productsShapeMismatch =
        nextExpandVariants !== listHasExpandedVariantRows(productsRef.current);
      expandVariantsRef.current = nextExpandVariants;
      setExpandVariants(nextExpandVariants);
      if (source === "sync" && ssrListReady && ssrShapeMatches && !productsShapeMismatch) {
        return;
      }
      if (!productsShapeMismatch) return;

      const requestId = expandVariantsFetchRequestRef.current + 1;
      expandVariantsFetchRequestRef.current = requestId;
      void (async () => {
        try {
          await refetchCatalog(nextExpandVariants);
          if (!isItemsRouteSessionActive(itemsRouteSession)) return;
          if (expandVariantsFetchRequestRef.current !== requestId) return;
        } catch {
          if (expandVariantsFetchRequestRef.current !== requestId) return;
          toast.error("Unable to reload items.");
        }
      })();
    },
    [initialExpandVariants, initialProducts.length, itemsRouteSession, refetchCatalog]
  );

  return { expandVariants, handleExpandVariantsChange };
}
