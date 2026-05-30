"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  fetchMoreProductListRows,
  fetchProductListByFilterIds,
  getProductCatalogContext,
  getProductDetail,
} from "@/app/items/actions";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { ProductDrawerForm } from "@/components/products/product-drawer-form";
import type { ProductFormMode } from "@/components/products/product-master-form";
import { CatalogSubNav } from "@/components/products/catalog-sub-nav";
import { ProductStreamPanel } from "@/components/products/product-stream-panel";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import {
  detailToListRow,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductListRow,
} from "@/lib/products/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { redactProductListRow } from "@/lib/products/field-permissions";
import type { ProductListPrefs } from "@/lib/products/list-prefs";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

type Props = {
  tenantId: string;
  initialProducts: ProductListRow[];
  listTotalCount?: number;
  listHasMore?: boolean;
  initialSavedView?: SavedViewSnapshot | null;
  initialFilteredItemIds?: string[] | null;
  categories: CategoryRow[];
  fieldPermissions: ProductFieldPermissions;
  initialListPrefs?: ProductListPrefs | null;
};

export function ProductCatalogTerminal({
  tenantId,
  initialProducts,
  listTotalCount = initialProducts.length,
  listHasMore = false,
  initialSavedView = null,
  initialFilteredItemIds = null,
  categories,
  fieldPermissions,
  initialListPrefs,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const hasServerFilteredView =
    initialSavedView != null && initialFilteredItemIds != null;
  const skipInitialFilterFetchRef = useRef(hasServerFilteredView);
  const serverViewHydratedRef = useRef(false);
  const [products, setProducts] = useState(
    hasServerFilteredView ? [] : initialProducts
  );
  const [filterProducts, setFilterProducts] = useState<ProductListRow[] | null>(
    hasServerFilteredView ? initialProducts : null
  );
  const [isLoadingFilterProducts, setIsLoadingFilterProducts] = useState(false);
  const filterFetchRequestRef = useRef(0);
  const [totalCount, setTotalCount] = useState(listTotalCount);
  const [hasMore, setHasMore] = useState(listHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductDetailSnapshot | null>(null);
  const [catalogContext, setCatalogContext] = useState<ProductCatalogContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<ProductFormMode>("create");
  const [isLoadingDetail, startDetailTransition] = useTransition();
  const [isLoadingCatalogContext, setIsLoadingCatalogContext] = useState(false);
  const catalogContextRequestRef = useRef<Promise<ProductCatalogContext | null> | null>(null);

  useEffect(() => {
    setProducts(hasServerFilteredView ? [] : initialProducts);
    setFilterProducts(hasServerFilteredView ? initialProducts : null);
    setTotalCount(listTotalCount);
    setHasMore(listHasMore);
  }, [hasServerFilteredView, initialProducts, listHasMore, listTotalCount]);

  useLayoutEffect(() => {
    if (!omnibar || serverViewHydratedRef.current) return;
    serverViewHydratedRef.current = true;
    if (initialSavedView) {
      omnibar.hydrateModuleViewFromServer(initialSavedView, initialFilteredItemIds);
      return;
    }
    omnibar.markDefaultViewResolvedOnServer("items");
  }, [initialFilteredItemIds, initialSavedView, omnibar]);

  const structuralFilterActive = useMemo(() => {
    if (!omnibar?.appliedQuery.trim()) return false;
    if (omnibar.isExecuting) return true;
    return omnibar.activeAst.some((clause) => clause.kind !== "text");
  }, [omnibar?.activeAst, omnibar?.appliedQuery, omnibar?.isExecuting]);

  const isDefaultViewBootstrapping = omnibar?.isDefaultViewBootstrapping ?? false;
  const isResolvingDefaultView =
    !hasServerFilteredView &&
    (isDefaultViewBootstrapping || Boolean(omnibar?.resolvingDefaultView));

  useEffect(() => {
    if (skipInitialFilterFetchRef.current) {
      skipInitialFilterFetchRef.current = false;
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

    if (!omnibar) return;

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

    // Fast path: if every matched item is already loaded, filter client-side
    // and skip the (serialized) server action entirely.
    const loadedById = new Map(products.map((row) => [row.id, row]));
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

    const requestId = filterFetchRequestRef.current + 1;
    filterFetchRequestRef.current = requestId;
    setIsLoadingFilterProducts(true);

    void (async () => {
      try {
        const page = await fetchProductListByFilterIds(itemIds);
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
    isResolvingDefaultView,
    omnibar?.filteredItemIds,
    omnibar?.isExecuting,
    omnibar?.moduleFilterRevision,
    structuralFilterActive,
    products,
  ]);

  const catalogProducts = isResolvingDefaultView ? [] : filterProducts ?? products;
  const catalogTotalCount = filterProducts != null ? filterProducts.length : totalCount;
  const catalogHasMore = filterProducts != null ? false : hasMore;

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchMoreProductListRows(products.length);
      setProducts((current) => {
        const seen = new Set(current.map((row) => row.id));
        const appended = page.rows.filter((row) => !seen.has(row.id));
        return [...current, ...appended];
      });
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch {
      toast.error("Unable to load more items.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, products.length]);

  const handleImagesHydrated = useCallback((imageUrls: Record<string, string | null>) => {
    const applyUrls = (current: ProductListRow[]) =>
      current.map((row) =>
        imageUrls[row.id] != null ? { ...row, image_url: imageUrls[row.id] } : row
      );

    setProducts(applyUrls);
    setFilterProducts((current) => (current ? applyUrls(current) : current));
  }, []);

  const ensureCatalogContext = useCallback((): Promise<ProductCatalogContext | null> => {
    if (catalogContext) return Promise.resolve(catalogContext);

    if (catalogContextRequestRef.current) {
      return catalogContextRequestRef.current;
    }

    const request = (async () => {
      setIsLoadingCatalogContext(true);
      try {
        const result = await getProductCatalogContext();
        setCatalogContext(result.catalogContext);
        return result.catalogContext;
      } catch {
        toast.error("Unable to load catalog settings.");
        return null;
      } finally {
        setIsLoadingCatalogContext(false);
        catalogContextRequestRef.current = null;
      }
    })();

    catalogContextRequestRef.current = request;
    return request;
  }, [catalogContext]);

  const loadDetail = (itemId: string, onLoaded?: (snapshot: ProductDetailSnapshot) => void) => {
    startDetailTransition(async () => {
      const result = await getProductDetail(itemId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load product profile.");
        return;
      }
      setDetail(result.detail);
      onLoaded?.(result.detail);
    });
  };

  const openCreate = () => {
    setSelectedId(null);
    setDetail(null);
    setDrawerMode("create");
    setDrawerOpen(true);
    void ensureCatalogContext();
  };

  const handleSelect = (productId: string) => {
    setSelectedId(productId);
    setDetail(null);
    setDrawerMode("view");
    setDrawerOpen(true);
    void ensureCatalogContext();
    loadDetail(productId);
  };

  const handleDrawerOpenChange = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setDrawerMode("create");
      setDetail(null);
      setSelectedId(null);
    }
  };

  const refreshDetail = () => {
    if (!selectedId) return;
    loadDetail(selectedId);
  };

  const handleSaved = (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
    setSelectedId(itemId);
    setDrawerMode("view");

    if (savedDetail) {
      setDetail(savedDetail);
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
      loadDetail(itemId);
    }
  };

  return (
    <>
      <div className="canvas-scroll-endpad">
        <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between md:mb-5">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">Items</h1>
            <p className="mt-1 text-sm text-muted-foreground md:hidden">
              Manage item master profiles, classifications, and stock balances.
            </p>
            <CatalogSubNav active="items" />
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">New profile</span>
            <span className="hidden sm:inline">Create New Item Profile</span>
          </Button>
        </header>

        <ProductStreamPanel
          products={catalogProducts}
          totalCount={catalogTotalCount}
          hasMore={catalogHasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={filterProducts == null ? handleLoadMore : undefined}
          structuralFilterResolved={filterProducts != null}
          isLoadingStructuralFilter={
            isResolvingDefaultView ||
            (structuralFilterActive &&
              (isLoadingFilterProducts ||
                omnibar?.isExecuting === true ||
                omnibar?.filteredItemIds === null))
          }
          categories={categories}
          selectedId={drawerOpen ? selectedId : null}
          fieldPermissions={fieldPermissions}
          initialListPrefs={initialListPrefs}
          onSelect={handleSelect}
          onImagesHydrated={handleImagesHydrated}
        />
      </div>

      <ProductDrawerForm
        open={drawerOpen}
        mode={drawerMode}
        onOpenChange={handleDrawerOpenChange}
        onModeChange={setDrawerMode}
        tenantId={tenantId}
        categories={categories}
        catalogContext={catalogContext}
        detail={detail}
        isLoading={
          !catalogContext ||
          isLoadingCatalogContext ||
          (isLoadingDetail && drawerMode !== "create")
        }
        onSaved={handleSaved}
        onExtensionsChanged={refreshDetail}
      />
    </>
  );
}
