"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
  fetchProductListByFilterIds,
  resolveBulkTargetItemIds,
  type ResolveBulkTargetInput,
} from "@/app/items/actions";
import type { BulkToolbarAction } from "@/components/products/product-bulk-action-toolbar";
import type { CategoryRow } from "@/lib/categories/types";
import { bulkSuccessToastMessage } from "@/lib/products/bulk-schemas";
import {
  downloadProductListCsv,
  downloadProductListCsvFromMatrix,
  exportProductListRowsToCsv,
} from "@/lib/products/bulk-export";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import {
  buildSkuGrainExportMatrix,
  filterSkuGrainExportRows,
  resolveSkuGrainDefaultColumnIds,
} from "@/lib/products/list-sku-export";
import { resolveBulkSelectionItemIds } from "@/lib/products/list-row-key";
import type { ProductListRow } from "@/lib/products/types";

type UseProductListBulkOperationsOptions = {
  products: ProductListRow[];
  setProducts: React.Dispatch<React.SetStateAction<ProductListRow[]>>;
  totalCount: number;
  expandVariants: boolean;
  fieldPermissions: ProductFieldPermissions;
  categories: CategoryRow[];
  filteredItemIds?: Set<string> | null;
  categoryFilterId?: string;
  getIncludeImages?: () => boolean;
};

export function useProductListBulkOperations({
  products,
  setProducts,
  totalCount,
  expandVariants,
  fieldPermissions,
  categories,
  filteredItemIds,
  categoryFilterId = "all",
  getIncludeImages = () => false,
}: UseProductListBulkOperationsOptions) {
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkSelectAllMatching, setBulkSelectAllMatching] = useState(false);
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

  const bulkSelectionCount = bulkSelectAllMatching ? totalCount : bulkSelectedIds.size;

  const clearBulkSelection = useCallback(() => {
    setBulkSelectedIds(new Set());
    setBulkSelectAllMatching(false);
  }, []);

  const buildBulkTarget = useCallback((): ResolveBulkTargetInput => {
    const ids =
      filteredItemIds && filteredItemIds.size > 0 ? [...filteredItemIds] : null;

    return {
      selectAllMatching: bulkSelectAllMatching,
      selectedIds: resolveBulkSelectionItemIds(bulkSelectedIds, products, expandVariants),
      filteredItemIds: ids,
      categoryId: categoryFilterId !== "all" ? categoryFilterId : null,
    };
  }, [
    bulkSelectAllMatching,
    bulkSelectedIds,
    categoryFilterId,
    expandVariants,
    filteredItemIds,
    products,
  ]);

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
        const page = await fetchProductListByFilterIds(itemIds, {
          expandVariants,
          includeImages: getIncludeImages(),
        });
        const affectedSet = new Set(itemIds);
        setProducts((current) => {
          if (expandVariants) {
            const kept = current.filter((row) => !affectedSet.has(row.id));
            return [...kept, ...page.rows];
          }
          const byId = new Map(page.rows.map((row) => [row.id, row]));
          return current.map((row) => byId.get(row.id) ?? row);
        });
      } catch {
        toast.error("Bulk action completed but the list could not be refreshed.");
      }
    },
    [expandVariants, getIncludeImages, setProducts]
  );

  const patchBulkActiveRows = useCallback(
    (itemIds: string[], isActive: boolean) => {
      const idSet = new Set(itemIds);
      setProducts((current) =>
        current.map((row) => (idSet.has(row.id) ? { ...row, is_active: isActive } : row))
      );
    },
    [setProducts]
  );

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
    [clearBulkSelection, closeAllBulkDialogs, patchBulkActiveRows, refreshBulkAffectedRows]
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
        const visibleMatches = products.filter((row) => idSet.has(row.id));
        if (visibleMatches.length === resolved.itemIds.length) {
          rows = visibleMatches;
        } else {
          const page = await fetchProductListByFilterIds(resolved.itemIds, {
            expandVariants: expandVariants,
            includeImages: getIncludeImages(),
          });
          rows = page.rows;
        }

        if (expandVariants) {
          const skuRows = filterSkuGrainExportRows(rows);
          const columnIds = resolveSkuGrainDefaultColumnIds(
            fieldPermissions.allowedFields as ProductListColumnId[]
          );
          const matrix = buildSkuGrainExportMatrix(skuRows, columnIds, fieldPermissions);
          downloadProductListCsvFromMatrix(matrix);
          toast.success(`Exported ${skuRows.length} SKU${skuRows.length === 1 ? "" : "s"}.`);
        } else {
          const csv = exportProductListRowsToCsv(rows, fieldPermissions);
          downloadProductListCsv(csv);
          toast.success(`Exported ${rows.length} product${rows.length === 1 ? "" : "s"}.`);
        }
        clearBulkSelection();
      } catch {
        toast.error("Unable to export selected items.");
      }
    });
  }, [buildBulkTarget, clearBulkSelection, expandVariants, fieldPermissions, getIncludeImages, products, runBulkTransition]);

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

  const dialogProps = useMemo(
    () => ({
      categories,
      fieldPermissions,
      bulkSelectionCount,
      isBulkPending,
      pricingDialogOpen,
      setPricingDialogOpen,
      jurisdictionDialogOpen,
      setJurisdictionDialogOpen,
      archiveDialogOpen,
      setArchiveDialogOpen,
      categoryDialogOpen,
      setCategoryDialogOpen,
      classificationDialogOpen,
      setClassificationDialogOpen,
      taxCategoryDialogOpen,
      setTaxCategoryDialogOpen,
      flagsDialogOpen,
      setFlagsDialogOpen,
      tagsDialogOpen,
      setTagsDialogOpen,
      storefrontDialogOpen,
      setStorefrontDialogOpen,
      runBulkPricing,
      runBulkJurisdiction,
      runBulkArchive,
      runBulkCategory,
      runBulkClassification,
      runBulkTaxCategory,
      runBulkFlags,
      runBulkTags,
      runBulkStorefront,
    }),
    [
      archiveDialogOpen,
      bulkSelectionCount,
      categories,
      classificationDialogOpen,
      categoryDialogOpen,
      fieldPermissions,
      flagsDialogOpen,
      isBulkPending,
      jurisdictionDialogOpen,
      pricingDialogOpen,
      runBulkArchive,
      runBulkCategory,
      runBulkClassification,
      runBulkFlags,
      runBulkJurisdiction,
      runBulkPricing,
      runBulkStorefront,
      runBulkTags,
      runBulkTaxCategory,
      storefrontDialogOpen,
      tagsDialogOpen,
      taxCategoryDialogOpen,
    ]
  );

  return {
    bulkSelectedIds,
    bulkSelectAllMatching,
    isBulkPending,
    bulkSelectionCount,
    clearBulkSelection,
    handleBulkRowToggle,
    handleBulkPageToggle,
    handleBulkToolbarAction,
    onBulkSelectAllMatching: () => setBulkSelectAllMatching(true),
    dialogProps,
  };
}
