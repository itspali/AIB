"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  fetchMoreProductListRows,
  fetchProductListByFilterIds,
  getProductCatalogContext,
  getProductDetail,
  getProductVariants,
  loadProductDrawer,
} from "@/app/items/actions";
import { loadCategoryRows } from "@/app/items/categories/actions";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { useRouter } from "next/navigation";
import { ItemsUnifiedCatalogHeader } from "@/components/items/revamp/items-unified-catalog-header";
import { ListWorkspaceMatrixLayout } from "@/components/layout/list-workspace-matrix-layout";
import {
  ListWorkspaceSplitLayout,
  useListWorkspaceSplitDesktop,
} from "@/components/layout/list-workspace-split-layout";
import { Button } from "@/components/ui/button";
import { ItemsDetailCanvas } from "@/components/items/revamp/items-detail-canvas";
import { ProductPanelScope } from "@/components/products/product-panel-form";
import { ItemsMasterFeed } from "@/components/items/revamp/items-master-feed";
import { ItemsMatrixRegistryPane } from "@/components/items/items-matrix-registry-pane";
import {
  ProductListWorkspaceHost,
  useItemsCatalogExpandVariants,
  type ProductListWorkspaceTableContext,
} from "@/components/items/product-list-workspace-host";
import { ProductListBulkDialogs } from "@/components/products/product-list-bulk-dialogs";
import { ProductBulkActionToolbar } from "@/components/products/product-bulk-action-toolbar";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { filterProductListRowsByFeedQuery } from "@/lib/products/feed-filter";
import { productListRowKey } from "@/lib/products/list-row-key";
import { countDisplayedProductListRows } from "@/lib/products/shape-displayed-product-list";
import { useProductListBulkOperations } from "@/lib/products/use-product-list-bulk-operations";
import { resolveDeletedRowCountDelta } from "@/lib/products/resolve-deleted-row-count-delta";
import { isDeepLinkPeekLanding } from "@/lib/layout/list-module/deep-link-landing";
import type { ListModuleLoadMode } from "@/lib/layout/list-module/drawer-search-params";
import { useListWorkspace } from "@/lib/layout/list-workspace";
import {
  persistListFeedFilterQuery,
  readListFeedFilterQuery,
} from "@/lib/layout/list-workspace/feed-filter-storage";
import { isMutationSurface } from "@/lib/layout/module-drawer-url";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import { useModuleAuxiliaryContext } from "@/lib/layout/list-module/use-module-auxiliary-context";
import type { ProductCatalogLoaderProps } from "@/lib/products/catalog-loader-props";
import { enrichProductDetailSnapshot, peekItemCacheKey } from "@/lib/products/detail-enrichment";
import { redactProductListRow } from "@/lib/products/field-permissions";
import { shouldIncludeListImages } from "@/lib/products/list-prefs";
import { detailToListRow } from "@/lib/products/types";
import type {
  ProductCatalogContext,
  ProductDetailSnapshot,
  ProductListRow,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductPeekPanelId } from "@/lib/products/peek-panels";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";
import { ITEMS_HREF } from "@/lib/products/item-navigation";
import { allocateItemsRouteSession } from "@/lib/products/items-route-generation";
import { useProductPeekPanel } from "@/lib/products/use-product-peek-panel";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/categories/types";
import { useRestoreModuleSavedView } from "@/lib/search/views/use-restore-module-saved-view";

const SPLIT_LIST_PANE_WIDTH_PX = 380;

const ProductItemDrawer = lazyClientExport(
  () => import("@/components/products/product-item-drawer"),
  "ProductItemDrawer"
);

const PRODUCT_CATALOG_CONTEXT_QUERY_KEY = ["items", "catalogContext"] as const;

function detailCacheKey(itemId: string, variantId?: string | null) {
  return `${itemId}:${variantId?.trim() || ""}`;
}

type Props = ProductCatalogLoaderProps;

export function ItemsListWorkspaceTerminal(props: Props) {
  return <ItemsListWorkspaceTerminalInner {...props} />;
}

function ItemsListWorkspaceTerminalInner({
  tenantId,
  loadMode = "list",
  initialProducts,
  listTotalCount = initialProducts.length,
  listHasMore = false,
  initialSavedView = null,
  initialFilteredItemIds = null,
  initialSavedViews = [],
  categories: initialCategories = [],
  fieldPermissions,
  initialListPrefs,
  initialCatalogContext,
  initialDetail = null,
}: Props) {
  const { layout } = useListWorkspace();
  const drawer = useModuleDrawerUrl(ITEMS_HREF, { canonicalizeLegacy: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSplitDesktop = useListWorkspaceSplitDesktop();
  const itemsRouteSessionRef = useRef(allocateItemsRouteSession());

  useRestoreModuleSavedView({
    moduleName: "items",
    initialSavedViews,
    initialSavedView,
    initialFilteredItemIds,
  });

  const [products, setProducts] = useState(initialProducts);
  const [totalCount, setTotalCount] = useState(listTotalCount);
  const [hasMore, setHasMore] = useState(listHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [peekDetail, setPeekDetail] = useState<ProductDetailSnapshot | null>(initialDetail);
  const [drawerDetail, setDrawerDetail] = useState<ProductDetailSnapshot | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories);
  const [feedFilterQuery, setFeedFilterQueryState] = useState(() =>
    readListFeedFilterQuery("items")
  );
  const setFeedFilterQuery = useCallback((value: string) => {
    setFeedFilterQueryState(value);
    persistListFeedFilterQuery("items", value);
  }, []);
  const categoriesRequestedRef = useRef(initialCategories.length > 0);
  const detailCacheRef = useRef<Map<string, ProductDetailSnapshot>>(new Map());
  const [, startPeekTransition] = useTransition();
  const [, startDrawerTransition] = useTransition();

  const deepLinkBootstrapRef = useRef(
    isDeepLinkPeekLanding(loadMode as ListModuleLoadMode, initialProducts.length, initialDetail)
  );
  const listBootstrapStartedRef = useRef(false);
  const listIncludeImagesRef = useRef(shouldIncludeListImages(initialListPrefs));
  const getIncludeImages = useCallback(() => listIncludeImagesRef.current, []);

  const handleListIncludeImagesChange = useCallback((includeImages: boolean) => {
    listIncludeImagesRef.current = includeImages;
  }, []);

  const handleImagesHydrated = useCallback((imageUrls: Record<string, string | null>) => {
    setProducts((current) =>
      current.map((row) =>
        imageUrls[row.id] != null ? { ...row, image_url: imageUrls[row.id] } : row
      )
    );
  }, []);

  const { expandVariants, handleExpandVariantsChange } = useItemsCatalogExpandVariants({
    initialListPrefs,
    initialProducts,
    products,
    setProducts,
    setTotalCount,
    setHasMore,
    getIncludeImages,
    itemsRouteSession: itemsRouteSessionRef.current,
  });

  const {
    data: catalogContext,
    isLoading: isLoadingCatalogContext,
    ensureLoaded: ensureCatalogContextLoaded,
  } = useModuleAuxiliaryContext(
    PRODUCT_CATALOG_CONTEXT_QUERY_KEY,
    async () => {
      const result = await getProductCatalogContext();
      return result.catalogContext;
    },
    initialCatalogContext,
    { onError: () => toast.error("Unable to load catalog settings.") }
  );

  const ensureCatalogContext = useCallback((): Promise<ProductCatalogContext | null> => {
    if (catalogContext) return Promise.resolve(catalogContext);
    return ensureCatalogContextLoaded();
  }, [catalogContext, ensureCatalogContextLoaded]);

  const seedCatalogContext = useCallback(
    (next: ProductCatalogContext) => {
      queryClient.setQueryData(PRODUCT_CATALOG_CONTEXT_QUERY_KEY, next);
    },
    [queryClient]
  );

  useEffect(() => {
    if (initialDetail) {
      detailCacheRef.current.set(
        detailCacheKey(initialDetail.id, initialDetail.variant_id),
        initialDetail
      );
      detailCacheRef.current.set(peekItemCacheKey(initialDetail.id), initialDetail);
    }
  }, [initialDetail]);

  useEffect(() => {
    if (products.length > 0 || !deepLinkBootstrapRef.current || listBootstrapStartedRef.current) {
      return;
    }
    listBootstrapStartedRef.current = true;
    void fetchMoreProductListRows(0, { expandVariants, includeImages: listIncludeImagesRef.current })
      .then((page) => {
        setProducts(page.rows);
        setTotalCount(page.totalCount);
        setHasMore(page.hasMore);
      })
      .catch(() => toast.error("Unable to load items."));
  }, [expandVariants, products.length]);

  useEffect(() => {
    if (categories.length > 0 || categoriesRequestedRef.current) return;
    categoriesRequestedRef.current = true;
    void loadCategoryRows().then(setCategories);
  }, [categories.length]);

  useEffect(() => {
    if (!catalogContext) return;
    setPeekDetail((current) => {
      if (!current) return current;
      const needsLabels = current.storefront_visibility.some(
        (row) => row.storefront_id && !row.storefront_name
      );
      if (!needsLabels) return current;
      const enriched = enrichProductDetailSnapshot(current, catalogContext);
      detailCacheRef.current.set(
        detailCacheKey(enriched.id, enriched.variant_id),
        enriched
      );
      return enriched;
    });
  }, [catalogContext]);

  const selectedRow = useMemo(() => {
    if (!drawer.recordId) return null;
    return products.find((row) => row.id === drawer.recordId) ?? null;
  }, [drawer.recordId, products]);

  const loadPeekDetail = useCallback(
    (itemId: string, variantId: string | null) => {
      const cacheKey = detailCacheKey(itemId, variantId);
      const cached =
        detailCacheRef.current.get(cacheKey) ??
        detailCacheRef.current.get(peekItemCacheKey(itemId));
      if (cached) {
        setPeekDetail(cached);
        return;
      }
      setPeekLoading(true);
      startPeekTransition(async () => {
        try {
          const result = await loadProductDrawer(itemId, {
            variantId,
            scope: "peek",
            skipCatalogContext: Boolean(catalogContext),
          });
          if ("error" in result) {
            toast.error(result.error ?? "Unable to load item.");
            return;
          }
          if (result.catalogContext && !catalogContext) seedCatalogContext(result.catalogContext);
          const resolved = catalogContext
            ? enrichProductDetailSnapshot(result.detail, catalogContext)
            : result.detail;
          detailCacheRef.current.set(cacheKey, resolved);
          detailCacheRef.current.set(peekItemCacheKey(itemId), resolved);
          setPeekDetail(resolved);
        } catch {
          toast.error("Unable to load item.");
        } finally {
          setPeekLoading(false);
        }
      });
    },
    [catalogContext, seedCatalogContext]
  );

  const loadMutationDetail = useCallback(
    (itemId: string, variantId: string | null) => {
      const cacheKey = detailCacheKey(itemId, variantId);
      const cached = detailCacheRef.current.get(cacheKey);
      if (cached?.detail_scope === "full") {
        setDrawerDetail(cached);
        return;
      }
      setDrawerLoading(true);
      startDrawerTransition(async () => {
        try {
          const result = await loadProductDrawer(itemId, {
            variantId,
            scope: "full",
            skipCatalogContext: Boolean(catalogContext),
          });
          if ("error" in result) {
            toast.error(result.error ?? "Unable to load item.");
            return;
          }
          if (result.catalogContext && !catalogContext) seedCatalogContext(result.catalogContext);
          const resolved = catalogContext
            ? enrichProductDetailSnapshot(result.detail, catalogContext)
            : result.detail;
          detailCacheRef.current.set(cacheKey, resolved);
          setDrawerDetail(resolved);
        } catch {
          toast.error("Unable to load item.");
        } finally {
          setDrawerLoading(false);
        }
      });
    },
    [catalogContext, seedCatalogContext]
  );

  useEffect(() => {
    if (drawer.surface !== "peek" || !drawer.recordId) {
      if (drawer.surface === "closed") setPeekDetail(null);
      return;
    }
    loadPeekDetail(drawer.recordId, drawer.variantId ?? null);
    if (layout === "split" && !isSplitDesktop) setMobileDetailOpen(true);
  }, [
    drawer.recordId,
    drawer.variantId,
    drawer.surface,
    drawer.historyEpoch,
    isSplitDesktop,
    layout,
    loadPeekDetail,
  ]);

  useEffect(() => {
    if (!drawer.isOpen || !isMutationSurface(drawer.surface)) {
      if (drawer.surface === "closed") setDrawerDetail(null);
      return;
    }
    if (drawer.surface === "create") {
      setDrawerDetail(null);
      void ensureCatalogContext();
      return;
    }
    if (!drawer.recordId) return;
    void ensureCatalogContext();
    loadMutationDetail(drawer.recordId, drawer.variantId ?? null);
  }, [
    drawer.historyEpoch,
    drawer.isOpen,
    drawer.recordId,
    drawer.surface,
    drawer.variantId,
    ensureCatalogContext,
    loadMutationDetail,
  ]);

  const handleSelect = (productId: string, variantId?: string | null) => {
    drawer.openPeek(productId, variantId?.trim() || null);
    if (layout === "split" && !isSplitDesktop) setMobileDetailOpen(true);
  };

  const handleNewItem = () => {
    drawer.openCreate();
    void ensureCatalogContext();
  };

  const handleEdit = () => {
    const itemId = drawer.recordId ?? peekDetail?.id ?? selectedRow?.id;
    if (!itemId) return;
    const variant =
      drawer.variantId ?? peekDetail?.variant_id ?? selectedRow?.variant_id ?? null;
    drawer.openEdit(itemId, variant);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchMoreProductListRows(products.length, {
        expandVariants,
        includeImages: listIncludeImagesRef.current,
      });
      setProducts((current) => [...current, ...page.rows]);
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch {
      toast.error("Unable to load more items.");
    } finally {
      setIsLoadingMore(false);
    }
  };

  const mergeSavedRow = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (!savedDetail) return;
      const nextRow = redactProductListRow(
        detailToListRow(savedDetail),
        fieldPermissions.allowedFields
      );
      const isNewRow = !products.some((row) => row.id === itemId);
      setProducts((current) => {
        const index = current.findIndex((row) => row.id === itemId);
        if (index < 0) {
          return [...current, nextRow].sort((a, b) => a.name.localeCompare(b.name));
        }
        const next = [...current];
        next[index] = nextRow;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (isNewRow) {
        setTotalCount((count) => count + 1);
      }
      detailCacheRef.current.set(
        detailCacheKey(savedDetail.id, savedDetail.variant_id),
        savedDetail
      );
      setPeekDetail(savedDetail);
      setDrawerDetail(savedDetail);
    },
    [fieldPermissions.allowedFields, products]
  );

  const handleSaved = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (savedDetail) {
        mergeSavedRow(itemId, savedDetail);
        return;
      }
      loadMutationDetail(itemId, drawer.variantId ?? null);
    },
    [drawer.variantId, loadMutationDetail, mergeSavedRow]
  );

  const handlePeekAfterSave = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      handleSaved(itemId, savedDetail);
      drawer.afterSave(itemId, savedDetail?.variant_id ?? drawer.variantId);
      if (layout === "split" && !isSplitDesktop) setMobileDetailOpen(true);
    },
    [drawer, handleSaved, isSplitDesktop, layout]
  );

  const peekDrawerOpen = drawer.isOpen && drawer.surface === "peek";
  const mutationDrawerOpen = drawer.isOpen && isMutationSurface(drawer.surface);

  const { peekPanel, peekPanelLoading, onPeekPanelChange } = useProductPeekPanel({
    basePath: ITEMS_HREF,
    drawer,
    detail: peekDetail,
    setDetail: setPeekDetail,
    detailCacheRef,
    detailCacheKey,
    catalogContext: catalogContext ?? null,
  });

  const splitLayoutActive = layout === "split";
  const splitDetailOpen = splitLayoutActive && peekDrawerOpen;
  const listCountPending = deepLinkBootstrapRef.current && products.length === 0;
  const detailPaneOpen = splitLayoutActive ? isSplitDesktop : peekDrawerOpen;

  const drawerNeedsCatalog = drawer.surface === "create" || drawer.surface === "edit";
  const drawerIsLoading =
    (drawerNeedsCatalog && (!catalogContext || isLoadingCatalogContext)) ||
    (drawer.surface === "edit" &&
      Boolean(drawer.recordId) &&
      !drawerDetail &&
      drawerLoading);

  const urlNavigation = useMemo(
    () => ({
      onOpenEdit: handleEdit,
      onPeekAfterSave: handlePeekAfterSave,
      onClose: () => drawer.close(),
    }),
    [drawer, handleEdit, handlePeekAfterSave]
  );

  const loadMoreFooter = hasMore ? (
    <div className="border-t border-border/60 p-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        disabled={isLoadingMore}
        onClick={() => void handleLoadMore()}
      >
        {isLoadingMore ? "Loading…" : `Load more (${products.length} of ${totalCount})`}
      </Button>
    </div>
  ) : null;

  return (
    <ProductListWorkspaceHost
      products={products}
      totalCount={totalCount}
      categories={categories}
      fieldPermissions={fieldPermissions}
      initialListPrefs={initialListPrefs}
      expandVariants={expandVariants}
      onExpandVariantsChange={handleExpandVariantsChange}
      detailPaneOpen={detailPaneOpen}
      listCountPending={listCountPending}
      itemsRouteSession={itemsRouteSessionRef.current}
      ssrListReady={initialProducts.length > 0}
      listPaneWidth={splitLayoutActive ? SPLIT_LIST_PANE_WIDTH_PX : undefined}
      initialListImagesIncluded={initialProducts.some((row) => Boolean(row.image_url))}
      onImagesHydrated={handleImagesHydrated}
      onListIncludeImagesChange={handleListIncludeImagesChange}
    >
      {({ toolbarCount, toolbarControls, table, resolveExportRows, exportRowCount, exportColumnIds }) => (
        <ItemsListWorkspaceChrome
          toolbarCount={toolbarCount}
          toolbarControls={toolbarControls}
          table={table}
          resolveExportRows={resolveExportRows}
          exportRowCount={exportRowCount}
          exportColumnIds={exportColumnIds}
          products={products}
          setProducts={setProducts}
          setTotalCount={setTotalCount}
          expandVariants={expandVariants}
          categories={categories}
          fieldPermissions={fieldPermissions}
          getIncludeImages={getIncludeImages}
          layout={layout}
          feedFilterQuery={feedFilterQuery}
          setFeedFilterQuery={setFeedFilterQuery}
          listCountPending={listCountPending}
          catalogEmpty={products.length === 0}
          loadMoreFooter={loadMoreFooter}
          splitLayoutActive={splitLayoutActive}
          splitDetailOpen={splitDetailOpen}
          mobileDetailOpen={mobileDetailOpen}
          isSplitDesktop={isSplitDesktop}
          peekDrawerOpen={peekDrawerOpen}
          peekDetail={peekDetail}
          selectedRow={selectedRow}
          peekLoading={peekLoading}
          peekPanel={peekPanel}
          peekPanelLoading={peekPanelLoading}
          onPeekPanelChange={onPeekPanelChange}
          drawer={drawer}
          handleSelect={handleSelect}
          handleNewItem={handleNewItem}
          handleEdit={handleEdit}
          setMobileDetailOpen={setMobileDetailOpen}
          mutationDrawerOpen={mutationDrawerOpen}
          tenantId={tenantId}
          catalogContext={catalogContext}
          drawerDetail={drawerDetail}
          drawerIsLoading={drawerIsLoading}
          urlNavigation={urlNavigation}
          loadMutationDetail={loadMutationDetail}
          loadPeekDetail={loadPeekDetail}
          setDrawerDetail={setDrawerDetail}
          setPeekDetail={setPeekDetail}
          detailCacheRef={detailCacheRef}
          handleSaved={handleSaved}
          onItemArchived={(itemId, mode) => {
            if (mode === "deleted") {
              const delta = resolveDeletedRowCountDelta(products, [itemId], expandVariants);
              setProducts((current) => current.filter((row) => row.id !== itemId));
              if (delta > 0) {
                setTotalCount((count) => Math.max(0, count - delta));
              }
            } else {
              setProducts((current) =>
                current.map((row) =>
                  row.id === itemId ? { ...row, is_active: false } : row
                )
              );
            }
            if (peekDetail?.id === itemId) setPeekDetail(null);
            drawer.close();
          }}
          router={router}
        />
      )}
    </ProductListWorkspaceHost>
  );
}

type ItemsListWorkspaceChromeProps = {
  toolbarCount: ReactNode;
  toolbarControls: ReactNode;
  table: ProductListWorkspaceTableContext;
  resolveExportRows: () => Promise<ProductListRow[]>;
  exportRowCount: number;
  exportColumnIds: ProductListColumnId[];
  products: ProductListRow[];
  setProducts: React.Dispatch<React.SetStateAction<ProductListRow[]>>;
  setTotalCount: React.Dispatch<React.SetStateAction<number>>;
  expandVariants: boolean;
  categories: CategoryRow[];
  fieldPermissions: ProductFieldPermissions;
  getIncludeImages: () => boolean;
  layout: ListWorkspaceLayout;
  feedFilterQuery: string;
  setFeedFilterQuery: (value: string) => void;
  listCountPending: boolean;
  catalogEmpty: boolean;
  loadMoreFooter: ReactNode;
  splitLayoutActive: boolean;
  splitDetailOpen: boolean;
  mobileDetailOpen: boolean;
  isSplitDesktop: boolean;
  peekDrawerOpen: boolean;
  peekDetail: ProductDetailSnapshot | null;
  selectedRow: ProductListRow | null;
  peekLoading: boolean;
  peekPanel: ProductPeekPanelId;
  peekPanelLoading: ProductPeekPanelId | null;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  drawer: ReturnType<typeof useModuleDrawerUrl>;
  handleSelect: (productId: string, variantId?: string | null) => void;
  handleNewItem: () => void;
  handleEdit: () => void;
  setMobileDetailOpen: (open: boolean) => void;
  mutationDrawerOpen: boolean;
  tenantId: string;
  catalogContext: ProductCatalogContext | null | undefined;
  drawerDetail: ProductDetailSnapshot | null;
  drawerIsLoading: boolean;
  urlNavigation: {
    onOpenEdit: () => void;
    onPeekAfterSave: (itemId: string, savedDetail?: ProductDetailSnapshot | null) => void;
    onClose: () => void;
  };
  loadMutationDetail: (itemId: string, variantId: string | null) => void;
  loadPeekDetail: (itemId: string, variantId: string | null) => void;
  setDrawerDetail: React.Dispatch<React.SetStateAction<ProductDetailSnapshot | null>>;
  setPeekDetail: React.Dispatch<React.SetStateAction<ProductDetailSnapshot | null>>;
  detailCacheRef: React.MutableRefObject<Map<string, ProductDetailSnapshot>>;
  handleSaved: (itemId: string, savedDetail?: ProductDetailSnapshot | null) => void;
  onItemArchived: (itemId: string, mode: "deleted" | "archived") => void;
  router: ReturnType<typeof useRouter>;
};

function ItemsListWorkspaceChrome({
  toolbarCount,
  toolbarControls,
  table,
  resolveExportRows,
  exportRowCount,
  exportColumnIds,
  products,
  setProducts,
  setTotalCount,
  expandVariants,
  categories,
  fieldPermissions,
  getIncludeImages,
  layout,
  feedFilterQuery,
  setFeedFilterQuery,
  listCountPending,
  catalogEmpty,
  loadMoreFooter,
  splitLayoutActive,
  splitDetailOpen,
  mobileDetailOpen,
  isSplitDesktop,
  peekDrawerOpen,
  peekDetail,
  selectedRow,
  peekLoading,
  peekPanel,
  peekPanelLoading,
  onPeekPanelChange,
  drawer,
  handleSelect,
  handleNewItem,
  handleEdit,
  setMobileDetailOpen,
  mutationDrawerOpen,
  tenantId,
  catalogContext,
  drawerDetail,
  drawerIsLoading,
  urlNavigation,
  loadMutationDetail,
  loadPeekDetail,
  setDrawerDetail,
  setPeekDetail,
  detailCacheRef,
  handleSaved,
  onItemArchived,
  router,
}: ItemsListWorkspaceChromeProps) {
  const omnibar = useOptionalOmnibarContext();
  const bulk = useProductListBulkOperations({
    products,
    setProducts,
    setTotalCount,
    totalCount: table.totalCount,
    expandVariants,
    fieldPermissions,
    categories,
    filteredItemIds: omnibar?.filteredItemIds,
    categoryFilterId: table.categoryFilter,
    getIncludeImages,
  });

  const listLoading =
    !table.prefsHydrated || table.isExpandVariantsSyncing || listCountPending;
  const filterEmptyMessage = "No items match the current filter.";

  const feedFilteredProducts = useMemo(
    () => filterProductListRowsByFeedQuery(table.displayedProducts, feedFilterQuery),
    [table.displayedProducts, feedFilterQuery]
  );

  const feedFilteredRowCount = useMemo(
    () => countDisplayedProductListRows(feedFilteredProducts, table.effectiveExpandVariants),
    [feedFilteredProducts, table.effectiveExpandVariants]
  );

  const displayedRowKeys = useMemo(
    () =>
      feedFilteredProducts.map((row) =>
        productListRowKey(row, table.effectiveExpandVariants)
      ),
    [feedFilteredProducts, table.effectiveExpandVariants]
  );

  const pageAllSelected =
    displayedRowKeys.length > 0 &&
    displayedRowKeys.every((key) => bulk.bulkSelectedIds.has(key));

  const showBulkToolbar =
    (bulk.bulkSelectAllMatching ? table.totalCount : bulk.bulkSelectedIds.size) > 0;

  const bulkToolbar = showBulkToolbar ? (
    <ProductBulkActionToolbar
      selectedCount={bulk.bulkSelectedIds.size}
      totalMatchingCount={table.totalCount}
      selectAllMatching={bulk.bulkSelectAllMatching}
      pageAllSelected={pageAllSelected}
      visibleCount={feedFilteredRowCount}
      isPending={bulk.isBulkPending}
      fieldPermissions={fieldPermissions}
      onClearSelection={bulk.clearBulkSelection}
      onSelectPage={() => bulk.handleBulkPageToggle(displayedRowKeys, true)}
      onSelectAllMatching={bulk.onBulkSelectAllMatching}
      onAction={bulk.handleBulkToolbarAction}
      embedded
    />
  ) : null;

  const matrixPane = (
    <ItemsMatrixRegistryPane
      table={table}
      loading={listLoading}
      selectedId={drawer.recordId}
      selectedVariantId={drawer.variantId ?? null}
      onSelect={handleSelect}
      catalogEmpty={catalogEmpty}
      emptyMessage={filterEmptyMessage}
      filterQuery={feedFilterQuery}
      bulkSelectedIds={bulk.bulkSelectedIds}
      onBulkRowToggle={bulk.handleBulkRowToggle}
      onBulkPageToggle={bulk.handleBulkPageToggle}
    />
  );

  const splitFeedPane = (
    <ItemsMasterFeed
      products={table.displayedProducts}
      columns={table.visibleColumns}
      columnWrapModes={table.columnWrapModes}
      loading={listLoading}
      selectedId={drawer.recordId}
      selectedVariantId={drawer.variantId ?? null}
      onSelect={handleSelect}
      filterQuery={feedFilterQuery}
      effectiveExpandVariants={table.effectiveExpandVariants}
      bulkSelectedIds={bulk.bulkSelectedIds}
      onBulkRowToggle={bulk.handleBulkRowToggle}
      emptyMessage={
        catalogEmpty
          ? "No items yet. Create your first item profile to populate the catalog."
          : filterEmptyMessage
      }
    />
  );

  return (
    <>
      <ListModuleShell
        catalogBody={layout !== "matrix"}
        title={
          <ItemsUnifiedCatalogHeader
            onNewItem={handleNewItem}
            count={toolbarCount}
            controls={toolbarControls}
            layout={layout}
            feedFilter={{ value: feedFilterQuery, onChange: setFeedFilterQuery }}
            dataTransferMenuProps={{
              fieldPermissions,
              defaultColumnIds: exportColumnIds,
              rowCount: exportRowCount,
              previewRows: table.displayedProducts.slice(0, 8),
              resolveExportRows,
              onImported: () => router.refresh(),
            }}
          />
        }
        className="list-module-shell-root"
        bulkToolbar={bulkToolbar}
      >
        {layout === "split" ? (
          <ListWorkspaceSplitLayout
            detailOpen={splitDetailOpen}
            mobileDetailOpen={mobileDetailOpen}
            listPane={
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 basis-0 flex-col">{splitFeedPane}</div>
                {loadMoreFooter}
              </div>
            }
            detailPane={
              <ProductPanelScope
                mode="view"
                tenantId={tenantId}
                categories={categories}
                catalogContext={catalogContext ?? null}
                detail={peekDetail}
                fieldPermissions={fieldPermissions}
                isLoading={peekLoading}
                onModeChange={() => {}}
                onSaved={() => {}}
                onClose={() => {
                  drawer.close();
                  setMobileDetailOpen(false);
                }}
                urlNavigation={urlNavigation}
                onItemArchived={onItemArchived}
                onRequestFullDetail={() => {
                  if (!peekDetail?.id) return;
                  loadPeekDetail(peekDetail.id, peekDetail.variant_id ?? null);
                }}
                onExtensionsChanged={() => {
                  if (!peekDetail?.id) return;
                  loadPeekDetail(peekDetail.id, peekDetail.variant_id ?? null);
                }}
                peekPanel={peekPanel}
                onPeekPanelChange={onPeekPanelChange}
                peekPanelLoading={peekPanelLoading}
              >
                <ItemsDetailCanvas
                  detail={peekDetail}
                  selectedRow={selectedRow}
                  loading={peekLoading}
                  catalogContext={catalogContext}
                  categories={categories}
                  peekPanel={peekPanel}
                  onPeekPanelChange={onPeekPanelChange}
                  peekPanelLoading={peekPanelLoading}
                  onBack={() => setMobileDetailOpen(false)}
                  showMobileBack={mobileDetailOpen && !isSplitDesktop}
                />
              </ProductPanelScope>
            }
          />
        ) : (
          <>
            <ListWorkspaceMatrixLayout footer={loadMoreFooter ?? undefined}>
              {matrixPane}
            </ListWorkspaceMatrixLayout>
            {peekDrawerOpen ? (
              <ProductItemDrawer
                open={peekDrawerOpen}
                surface="peek"
                tenantId={tenantId}
                categories={categories}
                catalogContext={catalogContext ?? null}
                detail={peekDetail}
                fieldPermissions={fieldPermissions}
                isLoading={peekLoading && !peekDetail}
                isDetailRefreshing={peekLoading && Boolean(peekDetail)}
                urlNavigation={urlNavigation}
                peekPanel={peekPanel}
                onPeekPanelChange={onPeekPanelChange}
                peekPanelLoading={peekPanelLoading}
                onExtensionsChanged={() => {
                  if (!peekDetail?.id) return;
                  loadPeekDetail(peekDetail.id, peekDetail.variant_id ?? null);
                }}
                onItemArchived={onItemArchived}
              />
            ) : null}
          </>
        )}
      </ListModuleShell>

      <ProductListBulkDialogs {...bulk.dialogProps} />

      {mutationDrawerOpen ? (
        <ProductItemDrawer
          open={mutationDrawerOpen}
          surface={drawer.surface}
          tenantId={tenantId}
          categories={categories}
          catalogContext={catalogContext}
          detail={drawer.surface === "create" && !drawerDetail ? null : drawerDetail}
          fieldPermissions={fieldPermissions}
          isLoading={drawerIsLoading}
          urlNavigation={urlNavigation}
          onExtensionsChanged={() => {
            const itemId = drawer.recordId ?? peekDetail?.id ?? null;
            if (!itemId) return;
            loadMutationDetail(itemId, drawer.variantId ?? null);
          }}
          onRequestFullDetail={() => {
            if (!drawer.recordId) return;
            loadMutationDetail(drawer.recordId, drawer.variantId ?? null);
          }}
          onVariantPatch={(variantId: string, patch: Partial<ProductVariantSnapshot>) => {
            setDrawerDetail((prev) =>
              prev
                ? {
                    ...prev,
                    variants: prev.variants.map((row) =>
                      row.id === variantId ? { ...row, ...patch } : row
                    ),
                  }
                : prev
            );
          }}
          onVariantsReload={async () => {
            const itemId = drawer.recordId ?? drawerDetail?.id ?? null;
            if (!itemId) return;

            const [detailResult, variantResult, listPage] = await Promise.all([
              getProductDetail(itemId),
              getProductVariants(itemId),
              fetchProductListByFilterIds([itemId], {
                expandVariants,
                includeImages: getIncludeImages(),
              }),
            ]);

            if ("error" in variantResult || !variantResult.bundle) {
              toast.error(variantResult.error ?? "Unable to refresh variants.");
              return;
            }
            if ("error" in detailResult || !detailResult.detail) {
              toast.error(detailResult.error ?? "Unable to refresh product profile.");
              return;
            }

            const bundle = variantResult.bundle;
            const applyVariantRefresh = (prev: ProductDetailSnapshot | null) => {
              if (!prev || prev.id !== itemId) return prev;
              return {
                ...prev,
                variants: bundle.variants,
                has_variants: bundle.has_variants,
                variant_axes: bundle.variant_axes,
                updated_at: bundle.updated_at,
                variant_strategy: detailResult.detail.variant_strategy,
                variant_count_summary: undefined,
              };
            };

            setDrawerDetail(applyVariantRefresh);
            setPeekDetail(applyVariantRefresh);

            const cacheDetail = applyVariantRefresh(
              detailCacheRef.current.get(peekItemCacheKey(itemId)) ??
                detailCacheRef.current.get(detailCacheKey(itemId, drawer.variantId)) ??
                detailResult.detail
            );
            if (cacheDetail) {
              for (const key of detailCacheRef.current.keys()) {
                if (key === peekItemCacheKey(itemId) || key.startsWith(`${itemId}:`)) {
                  detailCacheRef.current.delete(key);
                }
              }
              detailCacheRef.current.set(
                detailCacheKey(cacheDetail.id, cacheDetail.variant_id),
                cacheDetail
              );
              detailCacheRef.current.set(peekItemCacheKey(itemId), cacheDetail);
            }

            setProducts((current) => {
              const next = current.filter((row) => row.id !== itemId);
              return [...next, ...listPage.rows].sort((a, b) => {
                const byName = a.name.localeCompare(b.name);
                if (byName !== 0) return byName;
                return (a.default_sku ?? "").localeCompare(b.default_sku ?? "");
              });
            });
          }}
          onCreatePersisted={(itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
            if (savedDetail) handleSaved(itemId, savedDetail);
            else loadMutationDetail(itemId, null);
          }}
          onDetailSaved={handleSaved}
          onItemArchived={onItemArchived}
        />
      ) : null}
    </>
  );
}
