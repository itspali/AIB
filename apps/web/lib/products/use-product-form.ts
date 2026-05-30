"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { saveProductMasterProfile } from "@/app/items/actions";
import { parentSelectOptions } from "@/lib/categories/tree";
import type { AttributeTemplateEntry, CategoryRow } from "@/lib/categories/types";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import { productMasterSchema } from "@/lib/products/schemas";
import {
  defaultProductFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductMasterFormValues,
} from "@/lib/products/types";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";
import type { ItemType } from "@/lib/products/item-model";

export type ProductFormMode = "create" | "view" | "edit";

export type UseProductFormOptions = {
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  initialValues?: ProductMasterFormValues;
  mode?: ProductFormMode;
  /** Fired after a successful save with the persisted item id + fresh detail. */
  onSaved?: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  /** Mirrors the in-flight save state to a parent (e.g. drawer footer). */
  onPendingChange?: (pending: boolean) => void;
  /** Show a success/error toast on save. Defaults to true. */
  notifyOnSave?: boolean;
  /** Call router.refresh() after a successful save. Defaults to true. */
  refreshOnSave?: boolean;
};

export type CategorySelectOption = {
  id: string | null;
  label: string;
  depth: number;
};

export type UseProductFormResult = {
  form: UseFormReturn<ProductMasterFormValues>;
  mode: ProductFormMode;
  readOnly: boolean;
  isPending: boolean;
  fieldDisabled: boolean;
  /** Submit the form (validates then saves). */
  submit: () => void;
  onSubmit: (values: ProductMasterFormValues) => void;
  buildDefaultValues: () => ProductMasterFormValues;
  // Derived, commonly-shared state for presentations.
  itemId: string | null;
  categoryId: string | null;
  variantStrategy: ProductVariantStrategy;
  isMultiSku: boolean;
  itemType: ItemType;
  isPhysical: boolean;
  baseUom: string;
  purchaseUom: string;
  categoryTemplates: AttributeTemplateEntry[];
  categoryOptions: CategorySelectOption[];
};

/**
 * Headless core for the product master form. Owns form state, derived
 * selectors, the cross-field effects (base-UOM sync, category-driven variant
 * strategy) and the save transaction. Presentations (full-page route, drawer,
 * quick-create) render their own chrome on top of this.
 */
export function useProductForm({
  categories,
  catalogContext,
  initialValues,
  mode = "create",
  onSaved,
  onPendingChange,
  notifyOnSave = true,
  refreshOnSave = true,
}: UseProductFormOptions): UseProductFormResult {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const readOnly = mode === "view";
  const fieldDisabled = isPending || readOnly;

  const buildDefaultValues = useCallback(
    (): ProductMasterFormValues =>
      initialValues ?? {
        ...defaultProductFormValues,
        storefront_visibility: mergeStorefrontVisibility(catalogContext.storefronts, []),
      },
    [initialValues, catalogContext.storefronts]
  );

  const form = useForm<ProductMasterFormValues>({
    resolver: zodResolver(productMasterSchema),
    defaultValues: buildDefaultValues(),
  });

  const { handleSubmit, watch, setValue } = form;

  const itemId = watch("item_id");
  const categoryId = watch("category_id");
  const variantStrategy = watch("variant_strategy");
  const isMultiSku = variantStrategy === "MULTI_SKU";
  const itemType = watch("item_type");
  const isPhysical = itemType === "PHYSICAL";
  const baseUom = watch("base_unit_of_measure");
  const purchaseUom = watch("purchase_uom");
  const previousBaseUomRef = useRef(baseUom);

  const categoryOptions = useMemo(
    () => parentSelectOptions(categories).filter((option) => option.id !== null),
    [categories]
  );

  const categoryTemplates = useMemo(() => {
    if (!categoryId) return [];
    return categories.find((category) => category.id === categoryId)?.attribute_templates ?? [];
  }, [categories, categoryId]);

  const onSubmit = useCallback(
    (values: ProductMasterFormValues) => {
      startTransition(async () => {
        const result = await saveProductMasterProfile(values);

        if ("error" in result) {
          if (notifyOnSave) {
            toast.error(result.error ?? "Unable to save product profile.");
          }
          return;
        }

        if (notifyOnSave) {
          toast.success(
            values.variant_strategy === "MULTI_SKU" && !values.item_id
              ? "Style saved. Use Variant Management to generate sellable SKUs."
              : "Product master profile saved successfully"
          );
        }
        onSaved?.(result.itemId, result.detail ?? null);
        if (refreshOnSave) {
          router.refresh();
        }
      });
    },
    [notifyOnSave, onSaved, refreshOnSave, router]
  );

  const submit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  useEffect(() => {
    const nextValues = buildDefaultValues();
    form.reset(nextValues);
    previousBaseUomRef.current = nextValues.base_unit_of_measure;
  }, [buildDefaultValues, form]);

  useEffect(() => {
    if (itemId || !categoryId) return;
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category) return;
    setValue("variant_strategy", category.default_variant_strategy, { shouldDirty: true });
    if (category.default_item_type) {
      setValue("item_type", category.default_item_type, { shouldDirty: true });
    }
  }, [categoryId, categories, itemId, setValue]);

  // Non-physical items cannot hold stock, lot/serial tracking, or multi-SKU styles.
  useEffect(() => {
    if (itemType === "PHYSICAL") return;
    if (form.getValues("track_inventory")) {
      setValue("track_inventory", false, { shouldDirty: true });
    }
    if (form.getValues("tracking_mode") !== "NONE") {
      setValue("tracking_mode", "NONE", { shouldDirty: true });
    }
    if (form.getValues("variant_strategy") === "MULTI_SKU") {
      setValue("variant_strategy", "SINGLE_SKU", { shouldDirty: true });
    }
  }, [itemType, form, setValue]);

  useEffect(() => {
    if (previousBaseUomRef.current === baseUom) return;

    const sellingUom = form.getValues("selling_uom");
    const currentPurchaseUom = form.getValues("purchase_uom");

    if (sellingUom === previousBaseUomRef.current) {
      setValue("selling_uom", baseUom, { shouldDirty: true });
    }
    if (currentPurchaseUom === previousBaseUomRef.current) {
      setValue("purchase_uom", baseUom, { shouldDirty: true });
      setValue("purchase_uom_conversion", "1", { shouldDirty: true });
    }

    previousBaseUomRef.current = baseUom;
  }, [baseUom, form, setValue]);

  return {
    form,
    mode,
    readOnly,
    isPending,
    fieldDisabled,
    submit,
    onSubmit,
    buildDefaultValues,
    itemId,
    categoryId,
    variantStrategy,
    isMultiSku,
    itemType,
    isPhysical,
    baseUom,
    purchaseUom,
    categoryTemplates,
    categoryOptions,
  };
}
