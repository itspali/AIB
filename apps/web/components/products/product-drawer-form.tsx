"use client";

import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import { ProductMasterForm } from "@/components/products/product-master-form";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { CategoryRow } from "@/lib/categories/types";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import { detailToFormValues } from "@/lib/products/types";
import type { ProductCatalogContext, ProductDetailSnapshot } from "@/lib/products/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  editingDetail?: ProductDetailSnapshot | null;
  isLoadingEdit?: boolean;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
};

export function ProductDrawerForm({
  open,
  onOpenChange,
  tenantId,
  categories,
  catalogContext,
  editingDetail = null,
  isLoadingEdit = false,
  onSaved,
}: Props) {
  const isEditing = Boolean(editingDetail);
  const title = isEditing ? "Edit Product Master Profile" : "Create Product Master Profile";

  const handleSaved = (itemId: string, detail?: ProductDetailSnapshot | null) => {
    onSaved(itemId, detail);
    onOpenChange(false);
  };

  const initialValues = editingDetail
    ? {
        ...detailToFormValues(editingDetail),
        storefront_visibility: mergeStorefrontVisibility(
          catalogContext.storefronts,
          detailToFormValues(editingDetail).storefront_visibility
        ),
      }
    : undefined;

  return (
    <RightDrawer open={open} onOpenChange={onOpenChange} title={title} scrollable={false}>
      {!open ? null : isLoadingEdit ? (
        <ProductFormSkeleton />
      ) : (
        <ProductMasterForm
          layout="drawer"
          tenantId={tenantId}
          categories={categories}
          catalogContext={catalogContext}
          valuations={editingDetail?.valuations}
          initialValues={initialValues}
          onCancel={() => onOpenChange(false)}
          onSaved={handleSaved}
        />
      )}
    </RightDrawer>
  );
}
