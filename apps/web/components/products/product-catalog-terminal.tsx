"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Info, Plus } from "lucide-react";
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
  getProductDetail,
  resolveBulkTargetItemIds,
  type ResolveBulkTargetInput,
} from "@/app/items/actions";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import {
  type BulkToolbarAction,
} from "@/components/products/product-bulk-action-toolbar";
import { ProductBulkArchiveAlert } from "@/components/products/product-bulk-archive-alert";
import { ProductBulkJurisdictionDialog } from "@/components/products/product-bulk-jurisdiction-dialog";
import { ProductBulkPricingDialog } from "@/components/products/product-bulk-pricing-dialog";
import {
  ProductBulkCategoryDialog,
  ProductBulkClassificationDialog,
  ProductBulkFlagsDialog,
  ProductBulkStorefrontDialog,
  ProductBulkTagsDialog,
  ProductBulkTaxCategoryDialog,
} from "@/components/products/product-bulk-secondary-dialogs";
import { ProductDrawerForm } from "@/components/products/product-drawer-form";
import type { ProductFormMode } from "@/components/products/product-master-form";
import { CatalogSubNav } from "@/components/products/catalog-sub-nav";
import { ProductStreamPanel } from "@/components/products/product-stream-panel";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  coerceProductListPrefs,
  resolveProductListExpandVariants,
} from "@/lib/products/list-prefs";
import {
  productListRowKey,
  resolveBulkSelectionItemIds,
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

const ITEMS_PAGE_DESCRIPTION =
  "Manage item master profiles, classifications, and stock balances.";

function filterItemIdsKey(ids: Iterable<string> | null | undefined): string {
  if (!ids) return "";
  return [...ids].sort().join(",");
}

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
  const [filterProducts, setFilterProducts] = useState<ProductListRow[] | null>(
    hasServerFilteredView ? initialProducts : null
  );
  const [isLoadingFilterProducts, setIsLoadingFilterProducts] = useState(false);
  const [isLoadingFullCatalog, setIsLoadingFullCatalog] = useState(false);
  const filterFetchRequestRef = useRef(0);
  const fullCatalogFetchRequestRef = useRef(0);
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
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
  const initialExpandVariants = resolveProductListExpandVariants(
    coerceProductListPrefs(initialListPrefs ?? {}).showVariants,
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

  const matchesServerSnapshot = useCallback(() => {
    const snapshot = serverFilterSnapshotRef.current;
    if (!snapshot || !omnibar) return false;

    if (omnibar.filteredItemIds) {
      return filterItemIdsKey(omnibar.filteredItemIds) === snapshot.itemIdsKey;
    }

    return (
      initialSavedView != null &&
      omnibar.activeSavedView?.id === initialSavedView.id &&
      Boolean(omnibar.appliedQuery.trim())
    );
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

    void (async () => {
      try {
        const page = await fetchProductListByFilterIds(itemIds, { expandVariants });
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
    if (!omnibar) return;
    if (isResolvingDefaultView || structuralFilterActive || matchesServerSnapshot()) return;
    if (products.length > 0) return;
    if (omnibar.appliedQuery.trim() || omnibar.activeSavedView) return;

    const requestId = fullCatalogFetchRequestRef.current + 1;
    fullCatalogFetchRequestRef.current = requestId;
    setIsLoadingFullCatalog(true);

    void (async () => {
      try {
        const page = await fetchMoreProductListRows(0, { expandVariants });
        if (fullCatalogFetchRequestRef.current !== requestId) return;
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
  }, [
    isResolvingDefaultView,
    matchesServerSnapshot,
    omnibar?.activeSavedView,
    omnibar?.appliedQuery,
    omnibar?.moduleFilterRevision,
    products.length,
    structuralFilterActive,
    expandVariants,
    omnibar,
  ]);

  const unfilteredCatalogActive =
    !isResolvingDefaultView &&
    !structuralFilterActive &&
    !omnibar?.activeSavedView &&
    !omnibar?.appliedQuery.trim();

  const catalogProducts = isResolvingDefaultView
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
    try {
      const page = await fetchMoreProductListRows(0, { expandVariants: nextExpandVariants });
      setProducts(page.rows);
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
      setFilterProducts(null);
    } catch {
      toast.error("Unable to reload items.");
    }
  }, []);

  const handleExpandVariantsChange = useCallback(
    (nextExpandVariants: boolean) => {
      if (expandVariantsRef.current === nextExpandVariants) return;
      expandVariantsRef.current = nextExpandVariants;
      setExpandVariants(nextExpandVariants);
      clearBulkSelection();
      void refetchCatalog(nextExpandVariants);
    },
    [clearBulkSelection, refetchCatalog]
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
        const page = await fetchProductListByFilterIds(itemIds, { expandVariants });
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
          const page = await fetchProductListByFilterIds(resolved.itemIds);
          rows = page.rows;
        }

        const csv = exportProductListRowsToCsv(rows, fieldPermissions);
        downloadProductListCsv(csv);
        toast.success(`Exported ${rows.length} item master${rows.length === 1 ? "" : "s"}.`);
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
    (payload: { category_id: string; tax_rate_id: string }) => {
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
      const page = await fetchMoreProductListRows(products.length, { expandVariants });
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
        <header className="mb-4 sm:mb-5 md:mb-5">
          <CatalogSubNav active="items" className="mb-3 mt-0" />
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">Items</h1>
              <DropdownMenu>
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
            <Button asChild className="shrink-0">
              <Link href="/inventory/items/new">
                <Plus className="h-4 w-4" />
                New
              </Link>
            </Button>
          </div>
        </header>

        <ProductStreamPanel
          products={catalogProducts}
          totalCount={catalogTotalCount}
          hasMore={catalogHasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={unfilteredCatalogActive ? handleLoadMore : undefined}
          structuralFilterResolved={!unfilteredCatalogActive && filterProducts != null}
          isLoadingStructuralFilter={
            isLoadingFullCatalog ||
            (!matchesServerSnapshot() &&
              (isResolvingDefaultView ||
                (structuralFilterActive &&
                  (isLoadingFilterProducts ||
                    omnibar?.isExecuting === true ||
                    omnibar?.filteredItemIds === null))))
          }
          categories={categories}
          selectedId={drawerOpen ? selectedId : null}
          fieldPermissions={fieldPermissions}
          initialListPrefs={initialListPrefs}
          bulkSelectedIds={bulkSelectedIds}
          onBulkRowToggle={handleBulkRowToggle}
          onBulkPageToggle={handleBulkPageToggle}
          onCategoryFilterChange={setCategoryFilterId}
          bulkSelectAllMatching={bulkSelectAllMatching}
          isBulkPending={isBulkPending}
          onBulkClearSelection={clearBulkSelection}
          onBulkSelectAllMatching={() => setBulkSelectAllMatching(true)}
          onBulkAction={handleBulkToolbarAction}
          onSelect={handleSelect}
          onImagesHydrated={handleImagesHydrated}
          expandVariants={expandVariants}
          onExpandVariantsChange={handleExpandVariantsChange}
        />
      </div>

      <ProductBulkPricingDialog
        open={pricingDialogOpen}
        onOpenChange={setPricingDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        canAdjustSelling={fieldPermissions.allowedFields.includes("selling_price")}
        canAdjustPurchase={fieldPermissions.allowedFields.includes("purchase_price")}
        onSubmit={runBulkPricing}
      />

      <ProductBulkJurisdictionDialog
        open={jurisdictionDialogOpen}
        onOpenChange={setJurisdictionDialogOpen}
        categories={categories}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkJurisdiction}
      />

      <ProductBulkArchiveAlert
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onConfirm={runBulkArchive}
      />

      <ProductBulkCategoryDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        categories={categories}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkCategory}
      />

      <ProductBulkClassificationDialog
        open={classificationDialogOpen}
        onOpenChange={setClassificationDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkClassification}
      />

      <ProductBulkTaxCategoryDialog
        open={taxCategoryDialogOpen}
        onOpenChange={setTaxCategoryDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkTaxCategory}
      />

      <ProductBulkFlagsDialog
        open={flagsDialogOpen}
        onOpenChange={setFlagsDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkFlags}
      />

      <ProductBulkTagsDialog
        open={tagsDialogOpen}
        onOpenChange={setTagsDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkTags}
      />

      <ProductBulkStorefrontDialog
        open={storefrontDialogOpen}
        onOpenChange={setStorefrontDialogOpen}
        selectedCount={bulkSelectionCount}
        isPending={isBulkPending}
        onSubmit={runBulkStorefront}
      />

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
