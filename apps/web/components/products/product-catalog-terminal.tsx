"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { toast } from "sonner";
import {
  bulkAdjustItemPricing,
  bulkAdjustPurchasePricing,
  bulkArchiveItems,
  bulkModifyItemTags,
  bulkReactivateItems,
  bulkSetItemCategory,
  bulkSetItemClassification,
  bulkSetItemTaxCategory,
  bulkSetOperationalFlags,
  bulkSetStorefrontVisibility,
  bulkSyncItemJurisdiction,
  fetchMoreProductListRows,
  fetchProductListByFilterIds,
  getProductCatalogContext,
  getProductVariants,
  loadProductDrawer,
  loadProductPeekSection,
  loadProductPeekValuations,
  resolveBulkTargetItemIds,
  type ResolveBulkTargetInput,
} from "@/app/items/actions";
import { loadCategoryRows } from "@/app/items/categories/actions";
import {
  enrichProductDetailSnapshot,
  peekItemCacheKey,
  resolvePeekCachedDetail,
} from "@/lib/products/detail-enrichment";
import {
  isPeekSectionLoaded,
  mergeProductPeekSection,
  peekPanelToSection,
  type ProductPeekPanelId,
} from "@/lib/products/peek-panels";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { useModuleAuxiliaryContext } from "@/lib/layout/list-module/use-module-auxiliary-context";
import type { ListModuleLoadMode } from "@/lib/layout/list-module/drawer-search-params";
import {
  isDeepLinkPeekLanding,
  peekDetailMatchesSsrSeed,
} from "@/lib/layout/list-module/deep-link-landing";
import {
  type BulkToolbarAction,
} from "@/components/products/product-bulk-action-toolbar";
import dynamic from "next/dynamic";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import { Button } from "@/components/ui/button";
import {
  buildModuleHref,
  parseModuleDrawerStateFromLocation,
  parseProductPeekPanel,
} from "@/lib/layout/module-drawer-url";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  LIST_MODULE_PAGE_CHROME,
  LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT,
  LIST_MODULE_VIEWPORT_OFFSET,
} from "@/lib/layout/list-module-chrome";
import {
  allocateItemsRouteSession,
  invalidateItemsRouteSessions,
  isItemsRouteSessionActive,
} from "@/lib/products/items-route-generation";
import { useListModuleScrollLock } from "@/lib/layout/use-list-module-scroll-lock";
import { useAvailablePaneHeight } from "@/lib/layout/use-viewport-remaining-height";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CategoryRow } from "@/lib/categories/types";
import {
  detailMatchesDrawerVariant,
  detailToListRow,
  isDetailVariantSkuContext,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductListRow,
} from "@/lib/products/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import type { ProductListPrefs } from "@/lib/products/list-prefs";
import {
  coerceProductListPrefs,
  resolveProductListExpandVariants,
  shouldIncludeListImages,
} from "@/lib/products/list-prefs";
import {
  listHasExpandedVariantRows,
  mergeProductListRowImages,
  productListRowKey,
  resolveBulkSelectionItemIds,
  isProductListRowSelected,
} from "@/lib/products/list-row-key";
import { bulkSuccessToastMessage } from "@/lib/products/bulk-schemas";
import {
  downloadProductListCsv,
  exportProductListRowsToCsv,
} from "@/lib/products/bulk-export";
import {
  savedViewNeedsNativeFilter,
  type SavedViewSnapshot,
} from "@/lib/search/views/saved-view-utils";
import { cn } from "@/lib/utils";
import { ITEMS_HREF } from "@/lib/products/item-navigation";

const ITEMS_PAGE_DESCRIPTION =
  "Manage products, classifications, variants, and stock balances.";

const ProductStreamPanel = dynamic(
  () =>
    import("@/components/products/product-stream-panel").then(
      (module) => module.ProductStreamPanel
    ),
  { ssr: false, loading: () => <ProductListSkeleton viewMode="table" /> }
);

const NewItemLinkContent = lazyClientExport(
  () => import("@/components/products/new-item-link-content"),
  "NewItemLinkContent"
);

function ItemsPageTitleHeader({ onNewItem }: { onNewItem: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">Items</h1>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="About Items"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 p-3">
            <p className="text-sm leading-snug text-muted-foreground">{ITEMS_PAGE_DESCRIPTION}</p>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Button type="button" size="sm" className="h-8 w-8 shrink-0 px-0 sm:w-auto sm:gap-1.5 sm:px-2.5" onClick={onNewItem}>
        <NewItemLinkContent />
      </Button>
    </div>
  );
}

function filterItemIdsKey(ids: Iterable<string> | null | undefined): string {
  if (!ids) return "";
  return [...ids].sort().join(",");
}

const ProductItemDrawer = lazyClientExport(
  () => import("@/components/products/product-item-drawer"),
  "ProductItemDrawer"
);
const ProductBulkPricingDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-pricing-dialog"),
  "ProductBulkPricingDialog"
);
const ProductBulkJurisdictionDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-jurisdiction-dialog"),
  "ProductBulkJurisdictionDialog"
);
const ProductBulkArchiveAlert = lazyClientExport(
  () => import("@/components/products/product-bulk-archive-alert"),
  "ProductBulkArchiveAlert"
);
const ProductBulkCategoryDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-secondary-dialogs"),
  "ProductBulkCategoryDialog"
);
const ProductBulkClassificationDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-secondary-dialogs"),
  "ProductBulkClassificationDialog"
);
const ProductBulkTaxCategoryDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-secondary-dialogs"),
  "ProductBulkTaxCategoryDialog"
);
const ProductBulkFlagsDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-secondary-dialogs"),
  "ProductBulkFlagsDialog"
);
const ProductBulkTagsDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-secondary-dialogs"),
  "ProductBulkTagsDialog"
);
const ProductBulkStorefrontDialog = lazyClientExport(
  () => import("@/components/products/product-bulk-secondary-dialogs"),
  "ProductBulkStorefrontDialog"
);

type Props = {
  tenantId: string;
  loadMode?: ListModuleLoadMode;
  initialProducts: ProductListRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  initialSavedView?: SavedViewSnapshot | null;
  initialFilteredItemIds?: string[] | null;
  categories?: CategoryRow[];
  fieldPermissions: ProductFieldPermissions;
  initialListPrefs?: ProductListPrefs | null;
  initialCatalogContext?: ProductCatalogContext | null;
  initialDetail?: ProductDetailSnapshot | null;
};

function detailCacheKey(itemId: string, variantId?: string | null) {
  return `${itemId}:${variantId?.trim() || ""}`;
}

function resolveDrawerDetailScope(surface: string): "peek" | "full" {
  return surface === "edit" ? "full" : "peek";
}

type DrawerFetchResult =
  | { ok: true; snapshot: ProductDetailSnapshot }
  | { ok: false; error?: string };

const PRODUCT_CATALOG_CONTEXT_QUERY_KEY = ["items", "catalogContext"] as const;

/** Survives Strict Mode remounts so row-click detail fetches dedupe to one POST. */
const drawerDetailInflight = new Map<string, Promise<DrawerFetchResult>>();
const drawerDetailSnapshotCache = new Map<string, ProductDetailSnapshot>();
const peekValuationsInflight = new Map<
  string,
  Promise<{ valuations: ProductDetailSnapshot["valuations"] } | { error: string }>
>();
const peekValuationsDone = new Set<string>();

/** Dedupes page-0 list bootstrap across Strict Mode remounts on deep-link peek refresh. */
const catalogListPage0Inflight = new Map<
  number,
  Promise<Awaited<ReturnType<typeof fetchMoreProductListRows>>>
>();
/** Shared inflight key so Strict Mode remount reuses the same page-0 fetch. */
const DEEP_LINK_PAGE0_INFLIGHT_KEY = 0;

export function ProductCatalogTerminal({
  tenantId,
  loadMode = "list",
  initialProducts,
  listTotalCount = initialProducts.length,
  listHasMore = false,
  initialSavedView = null,
  initialFilteredItemIds = null,
  categories: initialCategories = [],
  fieldPermissions,
  initialListPrefs,
  initialCatalogContext = null,
  initialDetail = null,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const drawer = useModuleDrawerUrl(ITEMS_HREF, { canonicalizeLegacy: true });
  const searchParams = useSearchParams();
  const peekPanel = useMemo(() => {
    if (typeof window !== "undefined") {
      return parseProductPeekPanel(new URLSearchParams(window.location.search));
    }
    return parseProductPeekPanel(searchParams);
  }, [drawer.historyEpoch, searchParams]);
  const [peekPanelLoading, setPeekPanelLoading] = useState<ProductPeekPanelId | null>(null);
  const [valuationsLoadingKey, setValuationsLoadingKey] = useState<string | null>(null);
  const peekSectionInFlightRef = useRef(new Set<string>());
  const { ref: catalogViewportRef, height: catalogViewportHeight } =
    useAvailablePaneHeight(true, "remaining-viewport");
  const omnibar = useOptionalOmnibarContext();
  const itemsRouteSessionRef = useRef(allocateItemsRouteSession());
  const deepLinkPeekLandingRef = useRef(
    isDeepLinkPeekLanding(loadMode, initialProducts.length, initialDetail)
  );
  const deepLinkListBootstrapStartedRef = useRef(false);

  useListModuleScrollLock();

  const [categories, setCategories] = useState(initialCategories);
  const categoriesRequestedRef = useRef(initialCategories.length > 0);

  useEffect(() => {
    if (categories.length > 0 || categoriesRequestedRef.current) return;
    if (!drawer.isOpen) return;
    if (drawer.surface !== "create" && drawer.surface !== "edit") return;
    categoriesRequestedRef.current = true;
    void loadCategoryRows().then(setCategories);
  }, [categories.length, drawer.isOpen, drawer.surface]);

  const hasServerFilteredView =
    initialSavedView != null && initialFilteredItemIds != null;
  const serverFilterSnapshotRef = useRef(
    hasServerFilteredView
      ? {
          itemIdsKey: filterItemIdsKey(initialFilteredItemIds),
          products: initialProducts,
        }
      : null
  );
  const serverViewHydratedRef = useRef(false);
  const [products, setProducts] = useState(
    hasServerFilteredView ? [] : initialProducts
  );
  const productsRef = useRef(products);
  productsRef.current = products;
  const [filterProducts, setFilterProducts] = useState<ProductListRow[] | null>(
    hasServerFilteredView ? initialProducts : null
  );
  const [isLoadingFilterProducts, setIsLoadingFilterProducts] = useState(false);
  const [isLoadingFullCatalog, setIsLoadingFullCatalog] = useState(false);
  const filterFetchRequestRef = useRef(0);
  const expandVariantsFetchRequestRef = useRef(0);
  const fullCatalogFetchRequestRef = useRef(0);
  const [totalCount, setTotalCount] = useState(listTotalCount);
  const [hasMore, setHasMore] = useState(listHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [detail, setDetail] = useState<ProductDetailSnapshot | null>(initialDetail);
  const detailRef = useRef(initialDetail);
  detailRef.current = detail;
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
    {
      onError: () => toast.error("Unable to load catalog settings."),
    }
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
  const [isLoadingDetail, startDetailTransition] = useTransition();
  const drawerFetchTargetRef = useRef<string | null>(null);
  const activeDrawerTargetRef = useRef<{ itemId: string; variantId: string | null }>({
    itemId: "",
    variantId: null,
  });
  const detailCacheRef = useRef<Map<string, ProductDetailSnapshot>>(new Map());
  const [detailLoadingKey, setDetailLoadingKey] = useState<string | null>(null);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listIncludeImagesRef = useRef(shouldIncludeListImages(initialListPrefs));
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const initialExpandVariants = resolveProductListExpandVariants(
    false,
    coerceProductListPrefs(initialListPrefs ?? {}).viewMode
  );
  const expandVariantsRef = useRef(initialExpandVariants);
  const [expandVariants, setExpandVariants] = useState(initialExpandVariants);
  const [categoryFilterId, setCategoryFilterId] = useState("all");
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [jurisdictionDialogOpen, setJurisdictionDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [classificationDialogOpen, setClassificationDialogOpen] = useState(false);
  const [taxCategoryDialogOpen, setTaxCategoryDialogOpen] = useState(false);
  const [flagsDialogOpen, setFlagsDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [storefrontDialogOpen, setStorefrontDialogOpen] = useState(false);
  const [isBulkPending, startBulkTransition] = useTransition();

  const handleListIncludeImagesChange = useCallback((includeImages: boolean) => {
    listIncludeImagesRef.current = includeImages;
  }, []);

  const listFetchOptions = useCallback(
    () => ({
      expandVariants,
      includeImages: listIncludeImagesRef.current,
    }),
    [expandVariants]
  );

  const runPage0CatalogFetch = useCallback(
    (fetchOptions: { expandVariants: boolean; includeImages: boolean }) => {
      if (productsRef.current.length > 0) return;

      const deepLinkBootstrap = deepLinkPeekLandingRef.current;
      const inflightKey = deepLinkBootstrap
        ? DEEP_LINK_PAGE0_INFLIGHT_KEY
        : itemsRouteSessionRef.current;

      if (deepLinkBootstrap) {
        if (deepLinkListBootstrapStartedRef.current && catalogListPage0Inflight.has(inflightKey)) {
          return;
        }
        deepLinkListBootstrapStartedRef.current = true;
      }

      const requestId = fullCatalogFetchRequestRef.current + 1;
      fullCatalogFetchRequestRef.current = requestId;
      setIsLoadingFullCatalog(true);

      const runFetch = () =>
        fetchMoreProductListRows(0, fetchOptions).finally(() => {
          catalogListPage0Inflight.delete(inflightKey);
        });

      const fetchPromise = catalogListPage0Inflight.get(inflightKey) ?? runFetch();
      if (!catalogListPage0Inflight.has(inflightKey)) {
        catalogListPage0Inflight.set(inflightKey, fetchPromise);
      }

      void (async () => {
        try {
          const page = await fetchPromise;
          const mounted = catalogFetchMountedRef.current;
          const requestIdMatch = fullCatalogFetchRequestRef.current === requestId;
          if (!mounted) return;
          if (!requestIdMatch) return;
          setProducts(page.rows);
          setTotalCount(page.totalCount);
          setHasMore(page.hasMore);
        } catch {
          if (fullCatalogFetchRequestRef.current !== requestId) return;
          toast.error("Unable to load items.");
        } finally {
          if (fullCatalogFetchRequestRef.current === requestId) {
            setIsLoadingFullCatalog(false);
          }
        }
      })();
    },
    []
  );

  useLayoutEffect(() => {
    if (!deepLinkPeekLandingRef.current) return;
    if (productsRef.current.length > 0) return;
    runPage0CatalogFetch({
      expandVariants: initialExpandVariants,
      includeImages: false,
    });
  }, [initialExpandVariants, runPage0CatalogFetch]);

  const selectedId = drawer.recordId;
  const selectedVariantId = drawer.variantId;
  const drawerOpen = drawer.isOpen;

  const catalogFetchMountedRef = useRef(true);
  useEffect(() => {
    catalogFetchMountedRef.current = true;
    return () => {
      catalogFetchMountedRef.current = false;
    };
  }, []);

  const runBulkTransition = useCallback(
    (task: () => Promise<void>) => {
      startBulkTransition(() => {
        void task().catch((error) => {
          console.error(error);
          const message =
            error instanceof Error && error.message
              ? error.message
              : typeof error === "string" && error.trim()
                ? error
                : "Bulk action failed.";
          toast.error(message);
        });
      });
    },
    []
  );

  useLayoutEffect(() => {
    if (!omnibar || serverViewHydratedRef.current) return;
    serverViewHydratedRef.current = true;
    if (initialSavedView) {
      omnibar.hydrateModuleViewFromServer(initialSavedView, initialFilteredItemIds);
      return;
    }
    omnibar.markDefaultViewResolvedOnServer("items");
  }, [initialFilteredItemIds, initialSavedView, omnibar]);

  const initialDrawerUrlSyncedRef = useRef(false);
  useLayoutEffect(() => {
    if (initialDrawerUrlSyncedRef.current) return;
    initialDrawerUrlSyncedRef.current = true;
    if (typeof window === "undefined") return;
    const { recordId } = parseModuleDrawerStateFromLocation(window.location);
    if (recordId) return;
    drawer.close();
    setDetail(null);
    drawerFetchTargetRef.current = null;
    activeDrawerTargetRef.current = { itemId: "", variantId: null };
  }, [drawer]);

  const matchesServerSnapshot = useCallback(() => {
    const snapshot = serverFilterSnapshotRef.current;
    if (!snapshot || !omnibar || initialSavedView == null) return false;

    if (omnibar.activeSavedView?.id !== initialSavedView.id) {
      return false;
    }

    if (omnibar.filteredItemIds) {
      return filterItemIdsKey(omnibar.filteredItemIds) === snapshot.itemIdsKey;
    }

    return Boolean(omnibar.appliedQuery.trim());
  }, [initialSavedView, omnibar]);

  const structuralFilterActive = useMemo(() => {
    if (!omnibar?.appliedQuery.trim()) return false;
    if (omnibar.isExecuting) return true;
    if (omnibar.activeAst.some((clause) => clause.kind !== "text")) return true;
    if (
      omnibar.activeSavedView &&
      savedViewNeedsNativeFilter(omnibar.activeSavedView.compiled_ast)
    ) {
      return true;
    }
    return false;
  }, [
    omnibar?.activeAst,
    omnibar?.activeSavedView,
    omnibar?.appliedQuery,
    omnibar?.isExecuting,
  ]);

  const isDefaultViewBootstrapping = omnibar?.isDefaultViewBootstrapping ?? false;
  const isResolvingDefaultView =
    !hasServerFilteredView &&
    (isDefaultViewBootstrapping || Boolean(omnibar?.resolvingDefaultView));

  useEffect(() => {
    if (!omnibar) return;

    if (hasServerFilteredView && initialFilteredItemIds) {
      setFilterProducts((current) => current ?? initialProducts);
      setIsLoadingFilterProducts(false);
      return;
    }

    if (matchesServerSnapshot()) {
      const snapshot = serverFilterSnapshotRef.current!;
      setFilterProducts((current) => current ?? snapshot.products);
      setIsLoadingFilterProducts(false);
      return;
    }

    if (isResolvingDefaultView) {
      setFilterProducts(null);
      setIsLoadingFilterProducts(true);
      return;
    }

    if (!structuralFilterActive) {
      setFilterProducts(null);
      setIsLoadingFilterProducts(false);
      return;
    }

    if (omnibar.isExecuting || omnibar.filteredItemIds === null) {
      setFilterProducts(null);
      return;
    }

    const itemIds = [...omnibar.filteredItemIds];
    if (!itemIds.length) {
      setFilterProducts([]);
      setIsLoadingFilterProducts(false);
      return;
    }

    const snapshot = serverFilterSnapshotRef.current;
    if (expandVariants) {
      const rowsByItem = new Map<string, ProductListRow[]>();
      for (const row of products) {
        const list = rowsByItem.get(row.id) ?? [];
        list.push(row);
        rowsByItem.set(row.id, list);
      }
      if (snapshot) {
        for (const row of snapshot.products) {
          const list = rowsByItem.get(row.id) ?? [];
          if (!list.some((entry) => entry.variant_id === row.variant_id)) {
            list.push(row);
          }
          rowsByItem.set(row.id, list);
        }
      }
      const allLoaded = itemIds.every((id) => rowsByItem.has(id));
      if (allLoaded) {
        setFilterProducts(itemIds.flatMap((id) => rowsByItem.get(id) ?? []));
        setIsLoadingFilterProducts(false);
        return;
      }
    } else {
      const loadedById = new Map<string, ProductListRow>();
      for (const row of products) loadedById.set(row.id, row);
      if (snapshot) {
        for (const row of snapshot.products) loadedById.set(row.id, row);
      }
      const allLoaded = itemIds.every((id) => loadedById.has(id));
      if (allLoaded) {
        setFilterProducts(
          itemIds
            .map((id) => loadedById.get(id))
            .filter((row): row is ProductListRow => row != null)
        );
        setIsLoadingFilterProducts(false);
        return;
      }
    }

    const requestId = filterFetchRequestRef.current + 1;
    filterFetchRequestRef.current = requestId;
    setIsLoadingFilterProducts(true);

    const routeSession = itemsRouteSessionRef.current;
    void (async () => {
      try {
        const page = await fetchProductListByFilterIds(itemIds, listFetchOptions());
        if (!isItemsRouteSessionActive(routeSession)) return;
        if (filterFetchRequestRef.current !== requestId) return;
        setFilterProducts(page.rows);
      } catch {
        if (filterFetchRequestRef.current !== requestId) return;
        toast.error("Unable to load filtered items.");
        setFilterProducts([]);
      } finally {
        if (filterFetchRequestRef.current === requestId) {
          setIsLoadingFilterProducts(false);
        }
      }
    })();
  }, [
    hasServerFilteredView,
    initialFilteredItemIds,
    initialProducts,
    isResolvingDefaultView,
    matchesServerSnapshot,
    omnibar?.filteredItemIds,
    omnibar?.isExecuting,
    omnibar?.moduleFilterRevision,
    omnibar?.activeSavedView?.id,
    omnibar?.appliedQuery,
    structuralFilterActive,
    products,
    expandVariants,
    omnibar,
  ]);

  useEffect(() => {
    if (deepLinkPeekLandingRef.current) return;

    const deepLinkBootstrap = deepLinkPeekLandingRef.current;

    if (!omnibar && !deepLinkBootstrap) return;
    if (hasServerFilteredView) return;
    if (!deepLinkBootstrap) {
      if (isResolvingDefaultView || structuralFilterActive || matchesServerSnapshot()) return;
      if (products.length > 0) return;
      if (omnibar!.appliedQuery.trim() || omnibar!.activeSavedView) return;
    } else {
      if (structuralFilterActive) return;
      if (products.length > 0) return;
    }

    runPage0CatalogFetch(listFetchOptions());
  }, [
    hasServerFilteredView,
    isResolvingDefaultView,
    listFetchOptions,
    matchesServerSnapshot,
    omnibar?.activeSavedView,
    omnibar?.appliedQuery,
    omnibar?.moduleFilterRevision,
    products.length,
    structuralFilterActive,
    omnibar,
    runPage0CatalogFetch,
  ]);

  useEffect(() => {
    return () => {
      catalogListPage0Inflight.delete(itemsRouteSessionRef.current);
      filterFetchRequestRef.current += 1;
      expandVariantsFetchRequestRef.current += 1;
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };
  }, []);

  const unfilteredCatalogActive =
    (!isResolvingDefaultView || deepLinkPeekLandingRef.current) &&
    !structuralFilterActive &&
    !omnibar?.activeSavedView &&
    !omnibar?.appliedQuery.trim();

  const catalogProducts =
    isResolvingDefaultView && !deepLinkPeekLandingRef.current
      ? []
      : unfilteredCatalogActive
        ? products
        : filterProducts ?? products;
  const catalogTotalCount = unfilteredCatalogActive || filterProducts == null ? totalCount : filterProducts.length;
  const catalogHasMore = unfilteredCatalogActive ? hasMore : filterProducts != null ? false : hasMore;

  const bulkSelectionCount = bulkSelectAllMatching
    ? catalogTotalCount
    : bulkSelectedIds.size;

  const buildBulkTarget = useCallback((): ResolveBulkTargetInput => {
    const filteredItemIds =
      omnibar?.filteredItemIds && omnibar.filteredItemIds.size > 0
        ? [...omnibar.filteredItemIds]
        : null;

    return {
      selectAllMatching: bulkSelectAllMatching,
      selectedIds: resolveBulkSelectionItemIds(
        bulkSelectedIds,
        catalogProducts,
        expandVariants
      ),
      filteredItemIds,
      categoryId: categoryFilterId !== "all" ? categoryFilterId : null,
    };
  }, [
    bulkSelectAllMatching,
    bulkSelectedIds,
    catalogProducts,
    categoryFilterId,
    expandVariants,
    omnibar?.filteredItemIds,
  ]);

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const refetchCatalog = useCallback(async (nextExpandVariants: boolean) => {
    const sourceRows = productsRef.current;
    const page = await fetchMoreProductListRows(0, {
      expandVariants: nextExpandVariants,
      includeImages: false,
    });
    const rows = mergeProductListRowImages(page.rows, sourceRows, nextExpandVariants);
    setProducts(rows);
    setTotalCount(page.totalCount);
    setHasMore(page.hasMore);
    setFilterProducts(null);
  }, []);

  const handleExpandVariantsChange = useCallback(
    (nextExpandVariants: boolean, source: "sync" | "user" = "sync") => {
      if (expandVariantsRef.current === nextExpandVariants) return;
      if (
        source === "sync" &&
        deepLinkPeekLandingRef.current &&
        productsRef.current.length === 0
      ) {
        expandVariantsRef.current = nextExpandVariants;
        setExpandVariants(nextExpandVariants);
        return;
      }
      clearBulkSelection();

      const ssrListReady = initialProducts.length > 0 || hasServerFilteredView;
      const ssrShapeMatches = nextExpandVariants === initialExpandVariants;

      expandVariantsRef.current = nextExpandVariants;
      setExpandVariants(nextExpandVariants);

      if (source === "sync" && ssrListReady && ssrShapeMatches) {
        return;
      }

      // Collapsed mode is rendered client-side from the rows already in memory.
      if (!nextExpandVariants) {
        return;
      }

      const currentRows = productsRef.current;
      if (listHasExpandedVariantRows(currentRows)) {
        return;
      }

      if (deepLinkPeekLandingRef.current && currentRows.length === 0) {
        return;
      }

      const filterCatalogActive =
        structuralFilterActive ||
        Boolean(omnibar?.activeSavedView) ||
        Boolean(omnibar?.appliedQuery.trim());

      // Filtered lists refetch via the structural-filter effect when expandVariants changes.
      if (filterCatalogActive) {
        return;
      }

      const requestId = expandVariantsFetchRequestRef.current + 1;
      expandVariantsFetchRequestRef.current = requestId;
      const routeSession = itemsRouteSessionRef.current;
      void (async () => {
        try {
          await refetchCatalog(nextExpandVariants);
          if (!isItemsRouteSessionActive(routeSession)) return;
          if (expandVariantsFetchRequestRef.current !== requestId) return;
        } catch {
          if (expandVariantsFetchRequestRef.current !== requestId) return;
          toast.error("Unable to reload items.");
        }
      })();
    },
    [
      clearBulkSelection,
      hasServerFilteredView,
      initialExpandVariants,
      initialProducts.length,
      omnibar?.activeSavedView,
      omnibar?.appliedQuery,
      refetchCatalog,
      structuralFilterActive,
    ]
  );

  const handleBulkRowToggle = useCallback((rowKey: string, checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(rowKey);
      else next.delete(rowKey);
      return next;
    });
  }, []);

  const handleBulkPageToggle = useCallback((rowKeys: string[], checked: boolean) => {
    setBulkSelectAllMatching(false);
    setBulkSelectedIds((current) => {
      const next = new Set(current);
      for (const key of rowKeys) {
        if (checked) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  }, []);

  const refreshBulkAffectedRows = useCallback(
    async (itemIds: string[]) => {
      if (!itemIds.length) return;
      try {
        const page = await fetchProductListByFilterIds(itemIds, listFetchOptions());
        const affectedSet = new Set(itemIds);
        const mergeRows = (current: ProductListRow[]) => {
          if (expandVariants) {
            const kept = current.filter((row) => !affectedSet.has(row.id));
            return [...kept, ...page.rows];
          }
          const byId = new Map(page.rows.map((row) => [row.id, row]));
          return current.map((row) => byId.get(row.id) ?? row);
        };

        setProducts(mergeRows);
        setFilterProducts((current) => (current ? mergeRows(current) : current));
      } catch {
        toast.error("Bulk action completed but the list could not be refreshed.");
      }
    },
    [expandVariants]
  );

  const patchBulkActiveRows = useCallback((itemIds: string[], isActive: boolean) => {
    const idSet = new Set(itemIds);
    const patchRows = (current: ProductListRow[]) =>
      current.map((row) => (idSet.has(row.id) ? { ...row, is_active: isActive } : row));

    setProducts(patchRows);
    setFilterProducts((current) => (current ? patchRows(current) : current));
  }, []);

  const closeAllBulkDialogs = useCallback(() => {
    setPricingDialogOpen(false);
    setJurisdictionDialogOpen(false);
    setArchiveDialogOpen(false);
    setCategoryDialogOpen(false);
    setClassificationDialogOpen(false);
    setTaxCategoryDialogOpen(false);
    setFlagsDialogOpen(false);
    setTagsDialogOpen(false);
    setStorefrontDialogOpen(false);
  }, []);

  const handleBulkSuccess = useCallback(
    (
      affectedCount: number,
      itemIds: string[],
      mode: "refresh" | "archive" | "reactivate"
    ) => {
      toast.success(bulkSuccessToastMessage(affectedCount));
      clearBulkSelection();
      closeAllBulkDialogs();
      if (mode === "archive") {
        patchBulkActiveRows(itemIds, false);
      } else if (mode === "reactivate") {
        patchBulkActiveRows(itemIds, true);
      } else {
        void refreshBulkAffectedRows(itemIds);
      }
    },
    [
      clearBulkSelection,
      closeAllBulkDialogs,
      patchBulkActiveRows,
      refreshBulkAffectedRows,
    ]
  );

  const executeBulkAction = useCallback(
    (
      action: (
        target: ResolveBulkTargetInput
      ) => Promise<{ success?: true; affectedCount?: number; error?: string }>,
      mode: "refresh" | "archive" | "reactivate" = "refresh"
    ) => {
      const target = buildBulkTarget();
      runBulkTransition(async () => {
        const resolved = await resolveBulkTargetItemIds(target);
        if ("error" in resolved) {
          toast.error(resolved.error);
          return;
        }
        const result = await action(target);
        if ("error" in result) {
          toast.error(result.error ?? "Bulk action failed.");
          return;
        }
        handleBulkSuccess(result.affectedCount ?? resolved.itemIds.length, resolved.itemIds, mode);
      });
    },
    [buildBulkTarget, handleBulkSuccess, runBulkTransition]
  );

  const handleBulkExport = useCallback(async () => {
    const target = buildBulkTarget();
    runBulkTransition(async () => {
      const resolved = await resolveBulkTargetItemIds(target);
      if ("error" in resolved) {
        toast.error(resolved.error);
        return;
      }

      try {
        let rows: ProductListRow[];
        const idSet = new Set(resolved.itemIds);
        const visibleMatches = catalogProducts.filter((row) => idSet.has(row.id));
        if (visibleMatches.length === resolved.itemIds.length) {
          rows = visibleMatches;
        } else {
          const page = await fetchProductListByFilterIds(resolved.itemIds, {
            includeImages: listIncludeImagesRef.current,
          });
          rows = page.rows;
        }

        const csv = exportProductListRowsToCsv(rows, fieldPermissions);
        downloadProductListCsv(csv);
        toast.success(`Exported ${rows.length} product${rows.length === 1 ? "" : "s"}.`);
        clearBulkSelection();
      } catch {
        toast.error("Unable to export selected items.");
      }
    });
  }, [buildBulkTarget, catalogProducts, clearBulkSelection, fieldPermissions, runBulkTransition]);

  const handleBulkToolbarAction = useCallback(
    (action: BulkToolbarAction) => {
      switch (action) {
        case "pricing":
          setPricingDialogOpen(true);
          break;
        case "jurisdiction":
          setJurisdictionDialogOpen(true);
          break;
        case "archive":
          setArchiveDialogOpen(true);
          break;
        case "reactivate":
          executeBulkAction(bulkReactivateItems, "reactivate");
          break;
        case "category":
          setCategoryDialogOpen(true);
          break;
        case "classification":
          setClassificationDialogOpen(true);
          break;
        case "taxCategory":
          setTaxCategoryDialogOpen(true);
          break;
        case "flags":
          setFlagsDialogOpen(true);
          break;
        case "tags":
          setTagsDialogOpen(true);
          break;
        case "storefront":
          setStorefrontDialogOpen(true);
          break;
        case "export":
          void handleBulkExport();
          break;
        default:
          break;
      }
    },
    [executeBulkAction, handleBulkExport]
  );

  const runBulkArchive = useCallback(() => {
    executeBulkAction(bulkArchiveItems, "archive");
  }, [executeBulkAction]);

  const runBulkPricing = useCallback(
    (payload: {
      target: "SELLING" | "PURCHASE" | "BOTH";
      mode: "PERCENTAGE" | "FIXED_OFFSET";
      value: string;
    }) => {
      const target = buildBulkTarget();
      const adjustment = { mode: payload.mode, value: payload.value };

      runBulkTransition(async () => {
        const resolved = await resolveBulkTargetItemIds(target);
        if ("error" in resolved) {
          toast.error(resolved.error);
          return;
        }

        let sellingCount = 0;
        let purchaseCount = 0;

        if (payload.target === "SELLING" || payload.target === "BOTH") {
          const result = await bulkAdjustItemPricing(target, adjustment);
          if ("error" in result) {
            toast.error(result.error ?? "Unable to adjust selling prices.");
            return;
          }
          sellingCount = result.affectedCount;
        }

        if (payload.target === "PURCHASE" || payload.target === "BOTH") {
          const result = await bulkAdjustPurchasePricing(target, adjustment);
          if ("error" in result) {
            toast.error(result.error ?? "Unable to adjust purchase costs.");
            return;
          }
          purchaseCount = result.affectedCount;
        }

        if (payload.target === "BOTH") {
          toast.success(
            `Bulk Properties Applied Successfully. ${sellingCount} selling and ${purchaseCount} purchase updates synchronized.`
          );
        } else {
          toast.success(
            bulkSuccessToastMessage(
              payload.target === "PURCHASE" ? purchaseCount : sellingCount
            )
          );
        }

        clearBulkSelection();
        closeAllBulkDialogs();
        void refreshBulkAffectedRows(resolved.itemIds);
      });
    },
    [buildBulkTarget, clearBulkSelection, closeAllBulkDialogs, refreshBulkAffectedRows, runBulkTransition]
  );

  const runBulkJurisdiction = useCallback(
    (payload: { category_id: string; tax_code_id: string }) => {
      executeBulkAction((target) => bulkSyncItemJurisdiction(target, payload));
    },
    [executeBulkAction]
  );

  const runBulkCategory = useCallback(
    (payload: { category_id: string }) => {
      executeBulkAction((target) => bulkSetItemCategory(target, payload));
    },
    [executeBulkAction]
  );

  const runBulkClassification = useCallback(
    (payload: { classification: ProductListRow["classification"] }) => {
      executeBulkAction((target) => bulkSetItemClassification(target, payload));
    },
    [executeBulkAction]
  );

  const runBulkTaxCategory = useCallback(
    (payload: { default_tax_category: ProductListRow["default_tax_category"] }) => {
      executeBulkAction((target) => bulkSetItemTaxCategory(target, payload));
    },
    [executeBulkAction]
  );

  const runBulkFlags = useCallback(
    (payload: {
      apply_purchasable: boolean;
      is_purchasable: boolean;
      apply_salable: boolean;
      is_salable: boolean;
      apply_returnable: boolean;
      is_returnable: boolean;
    }) => {
      executeBulkAction((target) => bulkSetOperationalFlags(target, payload));
    },
    [executeBulkAction]
  );

  const runBulkTags = useCallback(
    (payload: { mode: "ADD" | "REMOVE"; tag_ids: string[] }) => {
      executeBulkAction((target) => bulkModifyItemTags(target, payload));
    },
    [executeBulkAction]
  );

  const runBulkStorefront = useCallback(
    (payload: { storefront_id: string; is_visible: boolean }) => {
      executeBulkAction((target) => bulkSetStorefrontVisibility(target, payload));
    },
    [executeBulkAction]
  );

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchMoreProductListRows(products.length, listFetchOptions());
      setProducts((current) => {
        const seen = new Set(current.map((row) => productListRowKey(row, expandVariants)));
        const appended = page.rows.filter(
          (row) => !seen.has(productListRowKey(row, expandVariants))
        );
        return [...current, ...appended];
      });
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch {
      toast.error("Unable to load more items.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [expandVariants, hasMore, isLoadingMore, products.length]);

  const handleImagesHydrated = useCallback((imageUrls: Record<string, string | null>) => {
    const applyUrls = (current: ProductListRow[]) =>
      current.map((row) =>
        imageUrls[row.id] != null ? { ...row, image_url: imageUrls[row.id] } : row
      );

    setProducts(applyUrls);
    setFilterProducts((current) => (current ? applyUrls(current) : current));
  }, []);

  const resolveCachedDetail = useCallback(
    (itemId: string, variantId: string | null, scope: "peek" | "full") => {
      if (scope === "peek") {
        const itemPeek = detailCacheRef.current.get(peekItemCacheKey(itemId));
        if (itemPeek) {
          const resolved = catalogContext
            ? enrichProductDetailSnapshot(itemPeek, catalogContext)
            : itemPeek;
          const peekCached = resolvePeekCachedDetail(resolved, variantId);
          if (peekCached) return peekCached;
        }
      }

      const variantKey = detailCacheKey(itemId, variantId);
      const exact = detailCacheRef.current.get(variantKey);
      if (exact) {
        const exactScope = exact.detail_scope ?? "full";
        if (scope === "full" && exactScope !== "full") {
          return null;
        }
        if (exactScope === "full" || scope === "peek") {
          const resolved = catalogContext
            ? enrichProductDetailSnapshot(exact, catalogContext)
            : exact;
          if (scope === "peek") {
            return resolvePeekCachedDetail(resolved, variantId);
          }
          return resolved;
        }
      }

      return null;
    },
    [catalogContext]
  );

  const loadDrawerData = useCallback(
    (
      itemId: string,
      variantId?: string | null,
      options?: {
        scope?: "peek" | "full";
        prefetch?: boolean;
        onLoaded?: (snapshot: ProductDetailSnapshot) => void;
      }
    ) => {
      const variant = variantId?.trim() || null;
      const scope = options?.scope ?? "peek";
      const cacheKey = detailCacheKey(itemId, variant);
      const requestKey = `${cacheKey}:${scope}`;

      const isActiveTarget = () => {
        const target = activeDrawerTargetRef.current;
        return target.itemId === itemId && target.variantId === variant;
      };

      const applyDetail = (snapshot: ProductDetailSnapshot) => {
        if (options?.prefetch) return;
        if (!isActiveTarget()) return;
        setDetail(snapshot);
        options?.onLoaded?.(snapshot);
      };

      const cached = resolveCachedDetail(itemId, variant, scope);
      if (cached) {
        applyDetail(cached);
        return;
      }

      const moduleCached = drawerDetailSnapshotCache.get(requestKey);
      if (moduleCached) {
        const resolved = catalogContext
          ? enrichProductDetailSnapshot(moduleCached, catalogContext)
          : moduleCached;
        detailCacheRef.current.set(cacheKey, resolved);
        if (scope === "peek") {
          detailCacheRef.current.set(peekItemCacheKey(itemId), resolved);
        }
        applyDetail(resolved);
        return;
      }

      const beginLoadingUi = () => {
        if (options?.prefetch || !isActiveTarget()) return;
        setDetailLoadingKey(cacheKey);
      };

      const finishLoadingUi = () => {
        if (options?.prefetch || !isActiveTarget()) return;
        setDetailLoadingKey(null);
      };

      const consumeResult = (result: DrawerFetchResult) => {
        if (!result.ok) {
          drawerFetchTargetRef.current = null;
          if (!options?.prefetch && isActiveTarget()) {
            toast.error(result.error ?? "Unable to load product profile.");
          }
          finishLoadingUi();
          return;
        }
        applyDetail(result.snapshot);
        finishLoadingUi();
      };

      const existing = drawerDetailInflight.get(requestKey);
      if (existing) {
        if (!options?.prefetch) {
          beginLoadingUi();
          startDetailTransition(async () => {
            if (!isActiveTarget()) {
              finishLoadingUi();
              return;
            }
            consumeResult(await existing);
          });
        }
        return;
      }

      beginLoadingUi();

      let fetchPromise!: Promise<DrawerFetchResult>;
      fetchPromise = (async (): Promise<DrawerFetchResult> => {
        try {
          const result = await loadProductDrawer(itemId, {
            variantId: variant,
            scope,
            skipCatalogContext: Boolean(catalogContext) || scope === "peek",
          });
          if ("error" in result) {
            return { ok: false, error: result.error };
          }

          if (result.catalogContext && !catalogContext) {
            seedCatalogContext(result.catalogContext);
          }

          const resolved = catalogContext
            ? enrichProductDetailSnapshot(result.detail, catalogContext)
            : result.detail;

          detailCacheRef.current.set(cacheKey, resolved);
          if (scope === "peek") {
            detailCacheRef.current.set(peekItemCacheKey(itemId), resolved);
          }
          drawerDetailSnapshotCache.set(requestKey, resolved);

          return { ok: true, snapshot: resolved };
        } catch {
          return { ok: false, error: "Unable to load product profile." };
        } finally {
          if (drawerDetailInflight.get(requestKey) === fetchPromise) {
            drawerDetailInflight.delete(requestKey);
          }
        }
      })();

      drawerDetailInflight.set(requestKey, fetchPromise);

      if (options?.prefetch) {
        void fetchPromise;
        return;
      }

      startDetailTransition(async () => {
        if (!isActiveTarget()) {
          finishLoadingUi();
          return;
        }
        consumeResult(await fetchPromise);
      });
    },
    [catalogContext, resolveCachedDetail, seedCatalogContext]
  );

  const loadDrawerDataRef = useRef(loadDrawerData);
  loadDrawerDataRef.current = loadDrawerData;
  const ensureCatalogContextRef = useRef(ensureCatalogContext);
  ensureCatalogContextRef.current = ensureCatalogContext;

  useEffect(() => {
    if (!drawerOpen || !drawer.recordId) return;
    activeDrawerTargetRef.current = {
      itemId: drawer.recordId,
      variantId: drawer.variantId ?? null,
    };
  }, [drawerOpen, drawer.recordId, drawer.variantId]);

  const handleSelect = (productId: string, variantId?: string | null) => {
    const variant = variantId?.trim() || null;
    if (
      drawer.isOpen &&
      drawer.surface === "peek" &&
      drawer.recordId === productId &&
      (drawer.variantId ?? null) === variant
    ) {
      return;
    }
    if (
      drawer.isOpen &&
      drawer.recordId === productId &&
      (drawer.variantId ?? null) === variant &&
      detail &&
      detail.id === productId &&
      detailMatchesDrawerVariant(detail, variant)
    ) {
      return;
    }
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }
    activeDrawerTargetRef.current = { itemId: productId, variantId: variant };
    drawer.openPeek(productId, variant);
  };

  // Peek loads on row click only — hover prefetch caused extra loadProductDrawer POSTs.
  const handleProductHover = undefined;
  const handleProductPointerEnter = undefined;

  const handleNewItem = () => {
    setDetail(null);
    drawer.openCreate();
    void ensureCatalogContext();
  };

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
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!catalogContext) return;

    setDetail((current) => {
      if (!current) return current;
      const needsStorefrontLabels = current.storefront_visibility.some(
        (row) => row.storefront_id && !row.storefront_name
      );
      if (!needsStorefrontLabels) return current;

      const enriched = enrichProductDetailSnapshot(current, catalogContext);
      detailCacheRef.current.set(
        detailCacheKey(current.id, current.variant_id),
        enriched
      );
      detailCacheRef.current.set(peekItemCacheKey(current.id), enriched);
      return enriched;
    });
  }, [catalogContext]);

  useEffect(() => {
    if (!drawerOpen || drawer.surface !== "peek" || !drawer.recordId || !detail) return;
    if (detail.id !== drawer.recordId || detail.detail_scope !== "peek") return;
    if (!detailMatchesDrawerVariant(detail, drawer.variantId ?? null)) return;
    if (detail.item_type !== "PHYSICAL" || detail.is_bundle || !detail.track_inventory) return;

    const cacheKey = detailCacheKey(drawer.recordId, drawer.variantId ?? null);
    if (detail.valuations.length > 0 || detail.peek_valuations_resolved) {
      peekValuationsDone.add(cacheKey);
      setValuationsLoadingKey((current) => (current === cacheKey ? null : current));
      return;
    }
    if (peekValuationsDone.has(cacheKey)) {
      setValuationsLoadingKey((current) => (current === cacheKey ? null : current));
      return;
    }

    setValuationsLoadingKey(cacheKey);

    const itemId = drawer.recordId;
    const variantId = drawer.variantId ?? null;

    const applyValuationsResult = (
      result: { valuations: ProductDetailSnapshot["valuations"] } | { error: string }
    ) => {
      setValuationsLoadingKey((current) => (current === cacheKey ? null : current));
      peekValuationsDone.add(cacheKey);
      if ("error" in result) return;

      const target = activeDrawerTargetRef.current;
      if (target.itemId !== itemId || target.variantId !== variantId) return;

      setDetail((current) => {
        if (!current || current.id !== itemId || !detailMatchesDrawerVariant(current, variantId)) {
          return current;
        }
        const next = { ...current, valuations: result.valuations };
        detailCacheRef.current.set(detailCacheKey(next.id, next.variant_id), next);
        detailCacheRef.current.set(peekItemCacheKey(next.id), next);
        const requestKey = `${detailCacheKey(next.id, next.variant_id)}:peek`;
        drawerDetailSnapshotCache.set(requestKey, next);
        return next;
      });
    };

    const existingRequest = peekValuationsInflight.get(cacheKey);
    if (existingRequest) {
      void existingRequest.then(applyValuationsResult);
      return;
    }

    const request = loadProductPeekValuations(itemId, variantId, {
      skipEligibilityCheck: true,
    }).then((result) => {
      if ("error" in result) return { error: result.error ?? "Unable to load stock." };
      return { valuations: result.valuations };
    });
    peekValuationsInflight.set(cacheKey, request);

    void request
      .then((result) => {
        peekValuationsInflight.delete(cacheKey);
        applyValuationsResult(result);
      })
      .catch(() => {
        peekValuationsInflight.delete(cacheKey);
        applyValuationsResult({ error: "Unable to load stock." });
      });
  }, [
    detail?.id,
    detail?.variant_id,
    detail?.detail_scope,
    detail?.item_type,
    detail?.is_bundle,
    detail?.track_inventory,
    detail?.valuations.length,
    drawer.recordId,
    drawer.surface,
    drawer.variantId,
    drawerOpen,
  ]);

  useEffect(() => {
    if (!drawerOpen) {
      drawerFetchTargetRef.current = null;
      setValuationsLoadingKey(null);
      return;
    }

    if (drawer.surface === "create" || drawer.recordId) {
      void ensureCatalogContextRef.current();
    }

    if (drawer.surface === "create") {
      return;
    }

    if (!drawer.recordId) return;
    const drawerVariant = drawer.variantId ?? null;
    const fetchScope = resolveDrawerDetailScope(drawer.surface);
    const fetchTargetKey = `${drawer.recordId}:${drawerVariant ?? ""}:${fetchScope}`;
    const currentDetail = detailRef.current;

    if (
      fetchScope === "peek" &&
      currentDetail?.id === drawer.recordId &&
      peekDetailMatchesSsrSeed(currentDetail, drawer.recordId, drawerVariant, fetchScope)
    ) {
      drawerFetchTargetRef.current = fetchTargetKey;
      return;
    }

    if (drawerFetchTargetRef.current === fetchTargetKey) {
      return;
    }
    drawerFetchTargetRef.current = fetchTargetKey;

    loadDrawerDataRef.current(drawer.recordId, drawerVariant, {
      scope: fetchScope,
    });
  }, [drawer.recordId, drawer.surface, drawer.variantId, drawerOpen]);

  const refreshDetail = () => {
    const itemId = drawer.recordId ?? detail?.id ?? null;
    if (!itemId) return;
    const variant = drawer.variantId ?? detail?.variant_id ?? null;
    const cacheKey = detailCacheKey(itemId, variant);
    const fullRequestKey = `${cacheKey}:full`;
    const peekRequestKey = `${cacheKey}:peek`;
    drawerDetailInflight.delete(fullRequestKey);
    drawerDetailInflight.delete(peekRequestKey);
    drawerDetailSnapshotCache.delete(fullRequestKey);
    drawerDetailSnapshotCache.delete(peekRequestKey);
    detailCacheRef.current.delete(cacheKey);
    detailCacheRef.current.delete(peekItemCacheKey(itemId));
    loadDrawerData(itemId, drawer.variantId, { scope: "full" });
  };

  const handleRequestFullDetail = useCallback(() => {
    const itemId = drawer.recordId ?? detail?.id ?? null;
    if (!itemId) return;
    if (detail?.detail_scope === "full") return;
    const variant = drawer.variantId ?? detail?.variant_id ?? null;
    const fullRequestKey = `${detailCacheKey(itemId, variant)}:full`;
    drawerDetailInflight.delete(fullRequestKey);
    drawerDetailSnapshotCache.delete(fullRequestKey);
    detailCacheRef.current.delete(detailCacheKey(itemId, variant));
    loadDrawerData(itemId, drawer.variantId, { scope: "full" });
  }, [detail?.detail_scope, detail?.id, detail?.variant_id, drawer.recordId, drawer.variantId, loadDrawerData]);

  const patchVariantInDetail = useCallback(
    (variantId: string, patch: Partial<ProductDetailSnapshot["variants"][number]>) => {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              variants: prev.variants.map((row) =>
                row.id === variantId ? { ...row, ...patch } : row
              ),
            }
          : prev
      );
    },
    []
  );

  const reloadVariantsQuietly = useCallback(async () => {
    const itemId = drawer.recordId ?? detail?.id ?? null;
    if (!itemId) return;
    const result = await getProductVariants(itemId);
    if ("error" in result || !result.bundle) {
      toast.error(result.error ?? "Unable to refresh variants.");
      return;
    }
    setDetail((prev) => {
      const next = prev
        ? {
            ...prev,
            updated_at: result.bundle.updated_at,
            variants: result.bundle.variants,
            has_variants: result.bundle.has_variants,
            variant_axes: result.bundle.variant_axes,
          }
        : null;
      if (next) {
        const cacheVariant = prev?.variant_id ?? drawer.variantId;
        detailCacheRef.current.set(detailCacheKey(itemId, cacheVariant), next);
        if ((next.detail_scope ?? "full") === "peek") {
          detailCacheRef.current.set(peekItemCacheKey(itemId), next);
        }
      }
      return next;
    });
  }, [detail?.id, drawer.recordId, drawer.variantId]);

  const handleSaved = (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
    if (savedDetail) {
      setDetail(savedDetail);
      detailCacheRef.current.set(
        detailCacheKey(itemId, savedDetail.variant_id),
        savedDetail
      );
      // Keep the item-level peek cache aligned after full saves so reopen/peek
      // shows current alternates and the optimistic-lock token stays fresh.
      detailCacheRef.current.set(peekItemCacheKey(itemId), {
        ...savedDetail,
        detail_scope: "peek",
      });
      const mergeSavedRow = (current: ProductListRow[]) => {
        const nextRow = redactProductListRow(
          detailToListRow(savedDetail),
          fieldPermissions.allowedFields
        );
        const index = current.findIndex((row) => row.id === itemId);
        if (index < 0) return [...current, nextRow].sort((a, b) => a.name.localeCompare(b.name));
        const next = [...current];
        next[index] = nextRow;
        return next.sort((a, b) => a.name.localeCompare(b.name));
      };

      setProducts(mergeSavedRow);
      setFilterProducts((current) => (current ? mergeSavedRow(current) : current));
    } else {
      loadDrawerData(itemId, drawer.variantId, { scope: "full" });
    }
  };

  const handlePeekAfterSave = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      handleSaved(itemId, savedDetail);
      drawer.afterSave(itemId, savedDetail?.variant_id ?? drawer.variantId);
    },
    [drawer, handleSaved]
  );

  const handleCreatePersisted = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (savedDetail) {
        handleSaved(itemId, savedDetail);
        return;
      }
      loadDrawerData(itemId, null, { scope: "full" });
    },
    [handleSaved, loadDrawerData]
  );

  const syncPeekPanelUrl = useCallback(
    (panel: ProductPeekPanelId) => {
      if (!drawer.recordId || drawer.surface !== "peek") return;
      const preserveParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : searchParams;
      const href = buildModuleHref(ITEMS_HREF, {
        recordId: drawer.recordId,
        variantId: drawer.variantId,
        preserveParams,
        panel,
      });
      drawer.replaceDrawerHref(href);
    },
    [drawer, searchParams]
  );

  const loadPeekPanelSection = useCallback(
    async (panel: ProductPeekPanelId) => {
      const section = peekPanelToSection(panel);
      if (!section || !drawer.recordId) return;

      if (
        detail?.id === drawer.recordId &&
        isPeekSectionLoaded(detail, section)
      ) {
        return;
      }

      const requestKey = `${drawer.recordId}:${section}`;
      if (peekSectionInFlightRef.current.has(requestKey)) return;
      peekSectionInFlightRef.current.add(requestKey);
      setPeekPanelLoading(panel);

      try {
        const result = await loadProductPeekSection(
          drawer.recordId,
          section,
          drawer.variantId
        );
        if ("error" in result) {
          toast.error(result.error ?? "Unable to load product section.");
          return;
        }

        setDetail((current) => {
          if (!current || current.id !== drawer.recordId) return current;
          let merged = mergeProductPeekSection(current, section, result.patch);
          if (section === "reach" && catalogContext) {
            merged = enrichProductDetailSnapshot(merged, catalogContext);
          }
          detailCacheRef.current.set(
            detailCacheKey(merged.id, merged.variant_id),
            merged
          );
          detailCacheRef.current.set(peekItemCacheKey(merged.id), merged);
          return merged;
        });
      } finally {
        peekSectionInFlightRef.current.delete(requestKey);
        setPeekPanelLoading(null);
      }
    },
    [catalogContext, detail, drawer.recordId, drawer.variantId]
  );

  const handlePeekPanelChange = useCallback(
    (panel: ProductPeekPanelId) => {
      syncPeekPanelUrl(panel);
      void loadPeekPanelSection(panel);
    },
    [loadPeekPanelSection, syncPeekPanelUrl]
  );

  useEffect(() => {
    if (!drawerOpen || drawer.surface !== "peek" || !drawer.recordId || !detail) return;
    if (detail.id !== drawer.recordId) return;
    if (peekPanel === "essentials") return;
    void loadPeekPanelSection(peekPanel);
  }, [
    detail,
    drawer.recordId,
    drawer.surface,
    drawerOpen,
    loadPeekPanelSection,
    peekPanel,
  ]);

  const handlePanelCloseStable = useCallback(() => {
    drawer.close();
    setDetail(null);
  }, [drawer]);

  const handleItemArchived = useCallback(
    (itemId: string) => {
      patchBulkActiveRows([itemId], false);
      handlePanelCloseStable();
    },
    [handlePanelCloseStable, patchBulkActiveRows]
  );

  const urlNavigation = useMemo(
    () => ({
      onOpenEdit: () => {
        if (!drawer.recordId) return;
        const variantId =
          detail && isDetailVariantSkuContext(detail) ? drawer.variantId : null;
        drawer.openEdit(drawer.recordId, variantId);
      },
      onPeekAfterSave: handlePeekAfterSave,
      onClose: handlePanelCloseStable,
    }),
    [detail, drawer, handlePeekAfterSave, handlePanelCloseStable]
  );

  const drawerTargetKey = drawer.recordId
    ? detailCacheKey(drawer.recordId, drawer.variantId)
    : null;
  const hasMatchingDetail =
    Boolean(detail) &&
    Boolean(drawer.recordId) &&
    detail?.id === drawer.recordId &&
    (drawer.surface === "edit"
      ? detail?.detail_scope === "full" &&
        detailMatchesDrawerVariant(detail, drawer.variantId)
      : peekDetailMatchesSsrSeed(detail, drawer.recordId, drawer.variantId, "peek"));

  const isDetailRefreshing = Boolean(
    drawerTargetKey && detailLoadingKey === drawerTargetKey && isLoadingDetail
  );

  const isValuationsLoading = Boolean(
    drawerTargetKey &&
      valuationsLoadingKey === drawerTargetKey &&
      !peekValuationsDone.has(drawerTargetKey)
  );

  const drawerDetail =
    drawer.surface === "create" || hasMatchingDetail ? detail : null;

  const drawerNeedsCatalog =
    drawer.surface === "create" || drawer.surface === "edit";

  const drawerIsLoading =
    (drawerNeedsCatalog && (!catalogContext || isLoadingCatalogContext)) ||
    (drawer.surface !== "create" &&
      Boolean(drawer.recordId) &&
      !hasMatchingDetail &&
      (isLoadingDetail || detailLoadingKey === drawerTargetKey));

  const streamPanelProps = {
    products: catalogProducts,
    totalCount: catalogTotalCount,
    hasMore: catalogHasMore,
    isLoadingMore,
    onLoadMore: unfilteredCatalogActive ? handleLoadMore : undefined,
    structuralFilterResolved: !unfilteredCatalogActive && filterProducts != null,
    isLoadingStructuralFilter:
      isLoadingFullCatalog ||
      (!matchesServerSnapshot() &&
        !deepLinkPeekLandingRef.current &&
        (isResolvingDefaultView ||
          (structuralFilterActive &&
            (isLoadingFilterProducts ||
              omnibar?.isExecuting === true ||
              omnibar?.filteredItemIds === null)))),
    categories,
    selectedId: drawerOpen ? selectedId : null,
    selectedVariantId: drawerOpen ? selectedVariantId : null,
    fieldPermissions,
    initialListPrefs,
    bulkSelectedIds,
    onBulkRowToggle: handleBulkRowToggle,
    onBulkPageToggle: handleBulkPageToggle,
    onCategoryFilterChange: setCategoryFilterId,
    bulkSelectAllMatching,
    isBulkPending,
    onBulkClearSelection: clearBulkSelection,
    onBulkSelectAllMatching: () => setBulkSelectAllMatching(true),
    onBulkAction: handleBulkToolbarAction,
    onSelect: handleSelect,
    onProductHover: handleProductHover,
    onProductPointerEnter: handleProductPointerEnter,
    onListIncludeImagesChange: handleListIncludeImagesChange,
    onImagesHydrated: handleImagesHydrated,
    expandVariants,
    onExpandVariantsChange: handleExpandVariantsChange,
    initialListImagesIncluded:
      initialProducts.some((row) => Boolean(row.image_url)) ||
      shouldIncludeListImages(initialListPrefs),
    ssrListReady: initialProducts.length > 0 || hasServerFilteredView,
    itemsRouteSession: itemsRouteSessionRef.current,
    detailPaneOpen: drawerOpen,
    listCountPending:
      deepLinkPeekLandingRef.current && products.length === 0 && isLoadingFullCatalog,
    bulkToolbarEmbedded: true,
  } as const;

  return (
    <>
      <div
        ref={catalogViewportRef}
        style={
          catalogViewportHeight != null
            ? { height: catalogViewportHeight, maxHeight: catalogViewportHeight }
            : undefined
        }
        className={cn(
          "list-module-shell-root flex min-h-0 flex-col overflow-hidden",
          catalogViewportHeight == null && LIST_MODULE_VIEWPORT_FALLBACK_HEIGHT,
          LIST_MODULE_VIEWPORT_OFFSET
        )}
      >
        <ProductStreamPanel
          {...streamPanelProps}
          renderLayout={({ toolbar, bulkToolbar, body }) => (
            <div className="flex h-full min-h-0 flex-1 basis-0 flex-col overflow-hidden">
              <div className={cn(LIST_MODULE_PAGE_CHROME)}>
                <div className="space-y-2.5">
                  <ItemsPageTitleHeader onNewItem={handleNewItem} />
                  {toolbar}
                </div>
                {bulkToolbar}
              </div>
              <div className="flex min-h-0 flex-1 basis-0 flex-col overflow-auto pb-1">
                {body}
              </div>
            </div>
          )}
        />
      </div>

      {pricingDialogOpen ? (
        <ProductBulkPricingDialog
          open={pricingDialogOpen}
          onOpenChange={setPricingDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          canAdjustSelling={fieldPermissions.allowedFields.includes("selling_price")}
          canAdjustPurchase={fieldPermissions.allowedFields.includes("purchase_price")}
          onSubmit={runBulkPricing}
        />
      ) : null}

      {jurisdictionDialogOpen ? (
        <ProductBulkJurisdictionDialog
          open={jurisdictionDialogOpen}
          onOpenChange={setJurisdictionDialogOpen}
          categories={categories}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkJurisdiction}
        />
      ) : null}

      {archiveDialogOpen ? (
        <ProductBulkArchiveAlert
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onConfirm={runBulkArchive}
        />
      ) : null}

      {categoryDialogOpen ? (
        <ProductBulkCategoryDialog
          open={categoryDialogOpen}
          onOpenChange={setCategoryDialogOpen}
          categories={categories}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkCategory}
        />
      ) : null}

      {classificationDialogOpen ? (
        <ProductBulkClassificationDialog
          open={classificationDialogOpen}
          onOpenChange={setClassificationDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkClassification}
        />
      ) : null}

      {taxCategoryDialogOpen ? (
        <ProductBulkTaxCategoryDialog
          open={taxCategoryDialogOpen}
          onOpenChange={setTaxCategoryDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkTaxCategory}
        />
      ) : null}

      {flagsDialogOpen ? (
        <ProductBulkFlagsDialog
          open={flagsDialogOpen}
          onOpenChange={setFlagsDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkFlags}
        />
      ) : null}

      {tagsDialogOpen ? (
        <ProductBulkTagsDialog
          open={tagsDialogOpen}
          onOpenChange={setTagsDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkTags}
        />
      ) : null}

      {storefrontDialogOpen ? (
        <ProductBulkStorefrontDialog
          open={storefrontDialogOpen}
          onOpenChange={setStorefrontDialogOpen}
          selectedCount={bulkSelectionCount}
          isPending={isBulkPending}
          onSubmit={runBulkStorefront}
        />
      ) : null}

      {drawerOpen ? (
        <ProductItemDrawer
          open={drawerOpen}
          surface={drawer.surface}
          tenantId={tenantId}
          categories={categories}
          catalogContext={catalogContext}
          detail={drawerDetail}
          fieldPermissions={fieldPermissions}
          isLoading={drawerIsLoading}
          isDetailRefreshing={isDetailRefreshing}
          urlNavigation={urlNavigation}
          onExtensionsChanged={refreshDetail}
          onRequestFullDetail={handleRequestFullDetail}
          onVariantPatch={patchVariantInDetail}
          onVariantsReload={reloadVariantsQuietly}
          onCreatePersisted={handleCreatePersisted}
          onDetailSaved={handleSaved}
          onItemArchived={handleItemArchived}
          peekPanel={drawer.surface === "peek" ? peekPanel : undefined}
          onPeekPanelChange={drawer.surface === "peek" ? handlePeekPanelChange : undefined}
          peekPanelLoading={drawer.surface === "peek" ? peekPanelLoading : null}
          isValuationsLoading={isValuationsLoading}
        />
      ) : null}
    </>
  );
}
