"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductListRow } from "@/lib/products/types";
import type { CategoryRow } from "@/lib/categories/types";

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

export type ProductListBulkDialogProps = {
  categories: CategoryRow[];
  fieldPermissions: ProductFieldPermissions;
  bulkSelectionCount: number;
  isBulkPending: boolean;
  pricingDialogOpen: boolean;
  setPricingDialogOpen: (open: boolean) => void;
  jurisdictionDialogOpen: boolean;
  setJurisdictionDialogOpen: (open: boolean) => void;
  archiveDialogOpen: boolean;
  setArchiveDialogOpen: (open: boolean) => void;
  categoryDialogOpen: boolean;
  setCategoryDialogOpen: (open: boolean) => void;
  classificationDialogOpen: boolean;
  setClassificationDialogOpen: (open: boolean) => void;
  taxCategoryDialogOpen: boolean;
  setTaxCategoryDialogOpen: (open: boolean) => void;
  flagsDialogOpen: boolean;
  setFlagsDialogOpen: (open: boolean) => void;
  tagsDialogOpen: boolean;
  setTagsDialogOpen: (open: boolean) => void;
  storefrontDialogOpen: boolean;
  setStorefrontDialogOpen: (open: boolean) => void;
  runBulkPricing: (payload: {
    target: "SELLING" | "PURCHASE" | "BOTH";
    mode: "PERCENTAGE" | "FIXED_OFFSET";
    value: string;
  }) => void;
  runBulkJurisdiction: (payload: { category_id: string; tax_code_id: string }) => void;
  runBulkArchive: () => void;
  runBulkCategory: (payload: { category_id: string }) => void;
  runBulkClassification: (payload: { classification: ProductListRow["classification"] }) => void;
  runBulkTaxCategory: (payload: {
    default_tax_category: ProductListRow["default_tax_category"];
  }) => void;
  runBulkFlags: (payload: {
    apply_purchasable: boolean;
    is_purchasable: boolean;
    apply_salable: boolean;
    is_salable: boolean;
    apply_returnable: boolean;
    is_returnable: boolean;
  }) => void;
  runBulkTags: (payload: { mode: "ADD" | "REMOVE"; tag_ids: string[] }) => void;
  runBulkStorefront: (payload: { storefront_id: string; is_visible: boolean }) => void;
};

export function ProductListBulkDialogs({
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
}: ProductListBulkDialogProps) {
  return (
    <>
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
    </>
  );
}
