"use client";

import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import {
  ProductMasterForm,
  type ProductFormMode,
} from "@/components/products/product-master-form";
import { Button } from "@/components/ui/button";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { CategoryRow } from "@/lib/categories/types";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import { detailToFormValues, type ProductCatalogContext, type ProductDetailSnapshot } from "@/lib/products/types";

const PRODUCT_DRAWER_FORM_ID = "product-drawer-form";

type Props = {
  open: boolean;
  mode: ProductFormMode;
  onOpenChange: (open: boolean) => void;
  onModeChange: (mode: ProductFormMode) => void;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext | null;
  detail?: ProductDetailSnapshot | null;
  isLoading?: boolean;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onExtensionsChanged?: () => void;
};

function drawerTitle(mode: ProductFormMode, detail: ProductDetailSnapshot | null | undefined): string {
  if (mode === "create") return "Create Product Master Profile";
  return detail?.name ?? "Product Master Profile";
}

function drawerDescription(mode: ProductFormMode): string {
  if (mode === "create") {
    return "Define a new product master profile with SKUs, costing, and compliance fields.";
  }
  if (mode === "edit") {
    return "Update product identity, commerce parameters, and logistics attributes.";
  }
  return "Review product identity, commerce parameters, and logistics attributes.";
}

export function ProductDrawerForm({
  open,
  mode,
  onOpenChange,
  onModeChange,
  tenantId,
  categories,
  catalogContext,
  detail = null,
  isLoading = false,
  onSaved,
  onExtensionsChanged,
}: Props) {
  const [isFormPending, setIsFormPending] = useState(false);

  useEffect(() => {
    if (!open || mode !== "edit") {
      setIsFormPending(false);
    }
  }, [open, mode]);

  const handleSaved = (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
    onSaved(itemId, savedDetail);
    if (mode === "create") {
      onOpenChange(false);
      return;
    }
    onModeChange("view");
  };

  const handleCancel = () => {
    if (mode === "edit") {
      onModeChange("view");
      return;
    }
    onOpenChange(false);
  };

  const initialValues =
    catalogContext && detail && mode !== "create"
      ? {
          ...detailToFormValues(detail),
          storefront_visibility: mergeStorefrontVisibility(
            catalogContext.storefronts,
            detailToFormValues(detail).storefront_visibility
          ),
        }
      : undefined;

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={drawerTitle(mode, detail)}
      description={drawerDescription(mode)}
      scrollable={false}
      headerActions={
        mode === "view" && detail ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onModeChange("edit")}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : mode === "edit" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isFormPending}
              onClick={handleCancel}
            >
              Discard
            </Button>
            <Button
              type="submit"
              form={PRODUCT_DRAWER_FORM_ID}
              size="sm"
              disabled={isFormPending}
              title="Save (Cmd/Ctrl + Enter)"
            >
              Save
            </Button>
          </>
        ) : null
      }
    >
      {!open || !catalogContext ? null : isLoading ? (
        <ProductFormSkeleton />
      ) : (
        <ProductMasterForm
          key={detail?.id ? `${detail.id}-${mode}` : `create-${open}`}
          layout="drawer"
          mode={mode}
          formId={mode === "edit" ? PRODUCT_DRAWER_FORM_ID : undefined}
          hideDrawerFooter={mode === "edit"}
          onPendingChange={mode === "edit" ? setIsFormPending : undefined}
          tenantId={tenantId}
          categories={categories}
          catalogContext={catalogContext}
          valuations={detail?.valuations}
          variants={detail?.variants}
          media={detail?.media}
          initialValues={initialValues}
          onCancel={handleCancel}
          onSaved={handleSaved}
          onExtensionsChanged={onExtensionsChanged}
        />
      )}
    </RightDrawer>
  );
}
