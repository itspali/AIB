"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { hydrateProductListImageUrls, saveProductListUserPrefs } from "@/app/items/actions";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import {
  type BulkToolbarAction,
} from "@/components/products/product-bulk-action-toolbar";
import { useDeviceClass } from "@/hooks/use-device-class";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import {
  bumpProductListPrefsRevision,
  getColumnPrefsSlice,
  isCardViewMode,
  isTableLikeViewMode,
  type ColumnPrefsCardContext,
  loadProductListPrefs,
  resolveProductListExpandVariants,
  AUTO_LAYOUT_PREF,
  resolveCardGridColumns,
  resolveFrozenColumnCount,
  resolvePrefsOnMount,
  saveProductListPrefs,
  setColumnPrefsSlice,
  shouldPersistPrefsImmediately,
  supportsProductListVariantExpansion,
  didColumnSettingsChange,
  isShowVariantsOnlyPrefChange,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";
import { resolveColumnWrapModes, resolveVisibleColumns } from "@/lib/products/resolve-list-columns";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import {
  collapseVariantListRows,
  productListRowKey,
  injectVariantParentRows,
} from "@/lib/products/list-row-key";
import { sortProductListRows, type ProductListSortDirection, type ProductListSortField } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import { resolveListPaneLayoutOverrides } from "@/lib/products/list-pane-layout";
import { useElementWidth } from "@/lib/layout/use-element-width";
import { applyFallbackTextFilter } from "@/lib/search/executor/apply-fallback-text";
import { ITEMS_HREF } from "@/lib/products/item-navigation";
import { isItemsRouteSessionActive } from "@/lib/products/items-route-generation";

const ProductListCompact = lazyClientExport(
  () => import("@/components/products/product-list-compact"),
  "ProductListCompact"
);
const ProductListImageGallery = lazyClientExport(
  () => import("@/components/products/product-list-image-gallery"),
  "ProductListImageGallery"
);
const ProductListTable = lazyClientExport(
  () => import("@/components/products/product-list-table"),
  "ProductListTable"
);
const ProductListToolbar = lazyClientExport(
  () => import("@/components/products/product-list-toolbar"),
  "ProductListToolbar"
);
const ProductBulkActionToolbar = lazyClientExport(
  () => import("@/components/products/product-bulk-action-toolbar"),
  "ProductBulkActionToolbar"
);

const PREFS_SAVE_DEBOUNCE_MS = 500;
/** One hydration request per list load; avoids menu navigation POST storms. */
const LIST_IMAGE_HYDRATION_MAX = 500;
/** Defer lazy image signing so quick menu hops do not start in-flight POSTs. */
const LIST_IMAGE_HYDRATION_DEFER_MS = 200;

type Props = {
  products: ProductListRow[];
  totalCount?: number;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  structuralFilterResolved?: boolean;
  isLoadingStructuralFilter?: boolean;
  categories: CategoryRow[];
  selectedId: string | null;
  selectedVariantId?: string | null;
  fieldPermissions: ProductFieldPermissions;
  initialListPrefs?: ProductListPrefs | null;
  bulkSelectedIds: Set<string>;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onBulkPageToggle: (rowKeys: string[], checked: boolean) => void;
  onCategoryFilterChange?: (categoryId: string) => void;
  bulkSelectAllMatching?: boolean;
  isBulkPending?: boolean;
  onBulkClearSelection?: () => void;
  onBulkSelectAllMatching?: () => void;
  onBulkAction?: (action: BulkToolbarAction) => void;
  onSelect: (productId: string, variantId?: string | null) => void;
  onProductHover?: (productId: string, variantId?: string | null) => void;
  onProductPointerEnter?: (productId: string, variantId?: string | null) => void;
  onListIncludeImagesChange?: (includeImages: boolean) => void;
  onImagesHydrated?: (imageUrls: Record<string, string | null>) => void;
  expandVariants?: boolean;
  onExpandVariantsChange?: (expandVariants: boolean, source?: "sync" | "user") => void;
  /** SSR already signed list images; skip client hydration POSTs. */
  initialListImagesIncluded?: boolean;
  /** SSR provided the initial list rows — avoid refetching on prefs hydration. */
  ssrListReady?: boolean;
  /** Invalidated when the items catalog unmounts. */
  itemsRouteSession?: number;
  /** Desktop split detail open — list pane uses narrower responsive layout. */
  detailPaneOpen?: boolean;
  /** List totals not yet loaded (deep-link peek refresh). */
  listCountPending?: boolean;
  bulkToolbarEmbedded?: boolean;
  renderLayout: (sections: {
    toolbar: ReactNode;
    bulkToolbar: ReactNode | null;
    body: ReactNode;
    viewMode: ProductListPrefs["viewMode"];
  }) => ReactNode;
};

export function ProductStreamPanel({
  products,
  totalCount = products.length,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  structuralFilterResolved = false,
  isLoadingStructuralFilter = false,
  categories,
  selectedId,
  selectedVariantId = null,
  fieldPermissions,
  initialListPrefs,
  bulkSelectedIds,
  onBulkRowToggle,
  onBulkPageToggle,
  onCategoryFilterChange,
  bulkSelectAllMatching = false,
  isBulkPending = false,
  onBulkClearSelection,
  onBulkSelectAllMatching,
  onBulkAction,
  onSelect,
  onProductHover,
  onProductPointerEnter,
  onListIncludeImagesChange,
  onImagesHydrated,
  expandVariants = false,
  onExpandVariantsChange,
  initialListImagesIncluded = false,
  ssrListReady = false,
  itemsRouteSession = 0,
  detailPaneOpen = false,
  listCountPending = false,
  bulkToolbarEmbedded = false,
  renderLayout,
}: Props) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const isOnItemsRoute = useCallback(() => {
    const current = pathnameRef.current;
    return current === ITEMS_HREF || current.startsWith(`${ITEMS_HREF}/`);
  }, []);
  const omnibar = useOptionalOmnibarContext();
  const { deviceClass } = useDeviceClass();
  const { ref: listPaneRef, width: listPaneWidth } = useElementWidth<HTMLDivElement>();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
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
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryItem, setGalleryItem] = useState<{ id: string; name: string } | null>(null);
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
    // Sync the comparison ref so the save effect does not treat hydration as a
    // user edit (which would fire a needless saveProductListUserPrefs action).
    prevPrefsRef.current = hydrated;
    suppressPrefsPersistRef.current = true;
    setPrefs(hydrated);
    setPrefsHydrated(true);

    const syncExpand = onExpandVariantsChangeRef.current;
    if (syncExpand) {
      const desired = resolveProductListExpandVariants(
        hydrated.showVariants,
        hydrated.viewMode
      );
      syncExpand(desired, "sync");
    }
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
          return;
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

    if (isShowVariantsOnlyPrefChange(previous, prefs)) {
      prevPrefsRef.current = prefs;
      return;
    }

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

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

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

  const displayViewMode =
    detailPaneOpen && isCardViewMode(prefs.viewMode) ? "table" : prefs.viewMode;

  const supportsVariantExpansion = supportsProductListVariantExpansion(displayViewMode);
  const desiredExpandVariants = supportsVariantExpansion && prefs.showVariants;
  const effectiveExpandVariants = supportsVariantExpansion && expandVariants;
  const isExpandVariantsSyncing =
    supportsVariantExpansion && prefs.showVariants !== expandVariants;

  useEffect(() => {
    if (omnibar?.scopePinnedToAll) {
      setCategoryFilter("all");
      onCategoryFilterChange?.("all");
    }
  }, [omnibar?.scopePinnedToAll, omnibar?.moduleFilterRevision, onCategoryFilterChange]);

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

    if (omnibar?.appliedQuery.trim()) {
      const hasStructuralFilter = omnibar.activeAst.some((clause) => clause.kind !== "text");

      if (hasStructuralFilter && !structuralFilterResolved && omnibar.filteredItemIds) {
        rows = rows.filter((product) => omnibar.filteredItemIds?.has(product.id));
      } else if (!hasStructuralFilter && omnibar.residualText) {
        rows = applyFallbackTextFilter(
          rows.map((row) => ({ ...row, description: null })),
          omnibar.residualText
        );
      }
    }

    // Live, uncommitted text preview as the user types in the inline bar.
    if (omnibar?.inlinePreviewText) {
      rows = applyFallbackTextFilter(
        rows.map((row) => ({ ...row, description: null })),
        omnibar.inlinePreviewText
      );
    }

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

  const displayedProducts = useMemo(() => {
    const sorted = sortProductListRows(filteredProducts, prefs.sortField, prefs.sortDirection, {
      showVariants: effectiveExpandVariants,
    });
    return effectiveExpandVariants
      ? injectVariantParentRows(sorted)
      : collapseVariantListRows(sorted);
  }, [effectiveExpandVariants, filteredProducts, prefs.sortField, prefs.sortDirection]);

  const displayedRowKeys = useMemo(
    () => displayedProducts.map((product) => productListRowKey(product, effectiveExpandVariants)),
    [displayedProducts, effectiveExpandVariants]
  );

  const pageAllSelected =
    displayedRowKeys.length > 0 &&
    displayedRowKeys.every((key) => bulkSelectedIds.has(key));
  const pageSomeSelected =
    displayedRowKeys.some((key) => bulkSelectedIds.has(key)) && !pageAllSelected;

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
        listPaneWidth,
        detailPaneOpen,
        frozenColumnCount: baseFrozenColumnCount,
        cardGridColumns: baseCardGridColumns,
        freezeColumnsAuto: prefs.frozenColumnCount === AUTO_LAYOUT_PREF,
      }),
    [
      baseCardGridColumns,
      baseFrozenColumnCount,
      detailPaneOpen,
      deviceClass,
      listPaneWidth,
      prefs.frozenColumnCount,
    ]
  );

  const listDisplayDeviceClass = listPaneLayout.deviceClass;

  const cardColumnContext = useMemo<ColumnPrefsCardContext | undefined>(
    () =>
      isCardViewMode(displayViewMode)
        ? {
            cardLayout: prefs.cardLayout,
            cardOrientation: prefs.cardOrientation,
          }
        : undefined,
    [displayViewMode, prefs.cardLayout, prefs.cardOrientation]
  );

  const visibleColumns = useMemo(
    () =>
      resolveVisibleColumns({
        prefs,
        viewMode: displayViewMode,
        deviceClass: listDisplayDeviceClass,
        allowedFields: fieldPermissions.allowedFields,
      }),
    [displayViewMode, fieldPermissions.allowedFields, listDisplayDeviceClass, prefs]
  );

  const columnWrapModes = useMemo(() => {
    const slice = getColumnPrefsSlice(
      prefs,
      displayViewMode,
      listDisplayDeviceClass,
      cardColumnContext
    );
    return resolveColumnWrapModes(visibleColumns, slice, displayViewMode);
  }, [cardColumnContext, displayViewMode, listDisplayDeviceClass, prefs, visibleColumns]);

  const columnChipDisplay = useMemo(() => {
    const slice = getColumnPrefsSlice(
      prefs,
      displayViewMode,
      listDisplayDeviceClass,
      cardColumnContext
    );
    return slice.columnChipDisplay;
  }, [cardColumnContext, displayViewMode, listDisplayDeviceClass, prefs]);

  const columnWidths = useMemo(() => {
    if (!isTableLikeViewMode(displayViewMode)) return undefined;
    return getColumnPrefsSlice(
      prefs,
      displayViewMode,
      listDisplayDeviceClass,
      cardColumnContext
    ).columnWidths;
  }, [cardColumnContext, displayViewMode, listDisplayDeviceClass, prefs]);

  const handleColumnWidthChange = useCallback(
    (columnId: ProductListColumnId, width: number | null) => {
      handlePrefsChange((current) => {
        const slice = getColumnPrefsSlice(
          current,
          displayViewMode,
          deviceClass,
          cardColumnContext
        );
        const nextWidths = { ...(slice.columnWidths ?? {}) };

        if (width == null) {
          delete nextWidths[columnId];
        } else {
          nextWidths[columnId] = width;
        }

        const normalizedWidths =
          Object.keys(nextWidths).length > 0 ? nextWidths : undefined;

        return setColumnPrefsSlice(
          current,
          displayViewMode,
          deviceClass,
          {
            ...slice,
            columnWidths: normalizedWidths,
          },
          cardColumnContext
        );
      });
    },
    [cardColumnContext, deviceClass, displayViewMode, handlePrefsChange]
  );

  const shouldHydrateImages = useMemo(
    () => isCardViewMode(displayViewMode) || visibleColumns.includes("image"),
    [displayViewMode, visibleColumns]
  );

  const imageHydrationRequestedRef = useRef(new Set<string>());
  const imageHydrationFlightRef = useRef(0);
  const productsRef = useRef(products);
  productsRef.current = products;

  useEffect(() => {
    onListIncludeImagesChange?.(isCardViewMode(prefs.viewMode));
  }, [onListIncludeImagesChange, prefs.viewMode]);

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
        .filter(
          (row) =>
            !row.image_url && !imageHydrationRequestedRef.current.has(row.id)
        )
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
    shouldHydrateImages,
  ]);

  const handleImageClick = useCallback((product: ProductListRow) => {
    setGalleryItem({ id: product.id, name: product.name });
    setGalleryOpen(true);
  }, []);

  const showBulkToolbar =
    (bulkSelectAllMatching ? totalCount : bulkSelectedIds.size) > 0 &&
    onBulkClearSelection &&
    onBulkSelectAllMatching &&
    onBulkAction;

  const listContent = !prefsHydrated || isLoadingStructuralFilter || isExpandVariantsSyncing ? (
    <ProductListSkeleton viewMode={displayViewMode} cardLayout={prefs.cardLayout} />
  ) : displayedProducts.length === 0 ? (
    <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
      {products.length === 0
        ? "No items yet. Create your first item profile to populate the catalog."
        : "No items match the current filter."}
    </p>
  ) : isCardViewMode(displayViewMode) ? (
    <div className="min-h-0 flex-1 basis-0 overflow-auto overscroll-contain scrollbar-none">
      <ProductListCompact
        products={displayedProducts}
        columns={visibleColumns}
        columnWrapModes={columnWrapModes}
        columnChipDisplay={columnChipDisplay}
        gridColumns={listPaneLayout.cardGridColumns}
        cardLayout={prefs.cardLayout}
        cardOrientation={prefs.cardOrientation}
        cardMetaDisplay={prefs.cardMetaDisplay}
        showVariants={effectiveExpandVariants}
        selectedId={selectedId}
        selectedVariantId={selectedVariantId}
        bulkSelectedIds={bulkSelectedIds}
        onSelect={onSelect}
        onProductHover={onProductHover}
        onProductPointerEnter={onProductPointerEnter}
        onBulkRowToggle={onBulkRowToggle}
        onImageClick={handleImageClick}
      />
    </div>
  ) : (
    <ProductListTable
      products={displayedProducts}
      columns={visibleColumns}
      columnWrapModes={columnWrapModes}
      columnChipDisplay={columnChipDisplay}
      columnWidths={columnWidths}
      deviceClass={listDisplayDeviceClass}
      compactRows={false}
      showVariants={effectiveExpandVariants}
      selectedId={selectedId}
      selectedVariantId={selectedVariantId}
      bulkSelectedIds={bulkSelectedIds}
      pageAllSelected={pageAllSelected}
      pageSomeSelected={pageSomeSelected}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={listPaneLayout.frozenColumnCount}
      freezeColumnsAuto={listPaneLayout.freezeColumnsAuto}
      onSortChange={(sortField: ProductListSortField, sortDirection: ProductListSortDirection) =>
        handlePrefsChange((current) => ({ ...current, sortField, sortDirection }))
      }
      onColumnWidthChange={handleColumnWidthChange}
      onSelect={onSelect}
      onProductHover={onProductHover}
      onProductPointerEnter={onProductPointerEnter}
      onBulkRowToggle={onBulkRowToggle}
      onBulkPageToggle={(checked: boolean) => onBulkPageToggle(displayedRowKeys, checked)}
      onImageClick={handleImageClick}
    />
  );

  const toolbar = (
    <ProductListToolbar
      categoryFilter={categoryFilter}
      onCategoryFilterChange={(value: string) => {
        setCategoryFilter(value);
        onCategoryFilterChange?.(value);
      }}
      categoryOptions={categoryOptions}
      prefs={prefs}
      onPrefsChange={handlePrefsChange}
      onShowVariantsChange={(checked: boolean) => {
        const nextExpand = resolveProductListExpandVariants(checked, displayViewMode);
        onExpandVariantsChange?.(nextExpand, "user");
      }}
      onExpandVariantsChange={(nextExpand: boolean) => {
        onExpandVariantsChange?.(nextExpand, "user");
      }}
      fieldPermissions={fieldPermissions}
      detectedDeviceClass={deviceClass}
      resultCount={filteredProducts.length}
      totalCount={totalCount}
      prefsHydrated={prefsHydrated}
      isSavingPrefs={isSavingPrefs}
      isSavingColumnPrefs={isSavingColumnPrefs}
      isExpandVariantsSyncing={isExpandVariantsSyncing}
      activeViewMode={displayViewMode}
      viewModeToggleLocked={detailPaneOpen && isCardViewMode(prefs.viewMode)}
      compactCountLabel={detailPaneOpen}
      listCountPending={listCountPending}
    />
  );

  const bulkToolbar =
    showBulkToolbar ? (
      <ProductBulkActionToolbar
        selectedCount={bulkSelectedIds.size}
        totalMatchingCount={totalCount}
        selectAllMatching={bulkSelectAllMatching}
        pageAllSelected={pageAllSelected}
        visibleCount={displayedProducts.length}
        isPending={isBulkPending}
        fieldPermissions={fieldPermissions}
        onClearSelection={onBulkClearSelection}
        onSelectPage={() => onBulkPageToggle(displayedRowKeys, true)}
        onSelectAllMatching={onBulkSelectAllMatching}
        onAction={onBulkAction}
        embedded={bulkToolbarEmbedded}
      />
    ) : null;

  const body = (
    <div className="flex min-h-0 flex-1 basis-0 flex-col">
      <div ref={listPaneRef} className="flex min-h-0 flex-1 basis-0 flex-col">
        {listContent}
      </div>

      <ProductListImageGallery
        key={galleryItem?.id ?? "gallery-closed"}
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        itemId={galleryItem?.id ?? null}
        itemName={galleryItem?.name ?? null}
      />

      {hasMore && onLoadMore ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={() => onLoadMore()}
          >
            {isLoadingMore ? (
              <>
                <Spinner />
                Loading…
              </>
            ) : (
              `Load more (${Math.max(totalCount - products.length, 0)} remaining)`
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );

  return renderLayout({
    toolbar,
    bulkToolbar,
    body,
    viewMode: displayViewMode,
  });
}
