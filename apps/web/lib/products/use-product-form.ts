"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { saveProductMasterProfile, getProductDetail, findExactItemByName } from "@/app/items/actions";
import { parentSelectOptions, resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import type { AttributeTemplateEntry, CategoryRow } from "@/lib/categories/types";
import {
  ITEM_SAVE_PARTIAL_REACH_ERROR,
  ITEM_SAVE_SUCCESS,
} from "@/lib/products/product-user-labels";
import { EXACT_DUPLICATE_ITEM_NAME_MESSAGE } from "@/lib/products/item-name-uniqueness";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import { productMasterSchema } from "@/lib/products/schemas";
import {
  defaultProductFormValues,
  detailToFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductMasterFormValues,
} from "@/lib/products/types";
import {
  inferVariantStrategy,
  type InferVariantStrategyInput,
  type ProductVariantStrategy,
} from "@/lib/products/variant-strategy";
import {
  resolveItemCompositionTemplates,
  sanitizeItemVariantAxisKeys,
  validateItemVariantAxesSelection,
} from "@/lib/products/item-composition-templates";
import {
  defaultVariantAxisKeys,
  pickDescriptiveVariantAttributes,
  splitTemplatesByAxis,
  variantAxesZodIssuePath,
} from "@/lib/products/variant-composition";
import type { ItemClassification } from "@/lib/products/classification-labels";
import {
  itemTypeSupportsComposition,
  normalizeCompositionFromDetail,
  shouldClearTrackInventoryWhenCompositionEnabled,
} from "@/lib/products/composition";
import { deriveClassificationOnItemTypeChange } from "@/lib/products/item-type-classification";
import type { ItemType } from "@/lib/products/item-model";
import { isTaxableSupplyCategory } from "@/lib/products/tax-options";

export type ProductFormMode = "create" | "view" | "edit";

export type UseProductFormOptions = {
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  initialValues?: ProductMasterFormValues;
  mode?: ProductFormMode;
  /**
   * Fired after the profile saves. Return `false` when follow-up persistence
   * (e.g. Reach matrix) failed so the success toast is suppressed.
   */
  onSaved?: (
    itemId: string,
    detail?: ProductDetailSnapshot | null
  ) => void | Promise<boolean | void>;
  /** Mirrors the in-flight save state to a parent (e.g. drawer footer). */
  onPendingChange?: (pending: boolean) => void;
  /** Show a success/error toast on save. Defaults to true. */
  notifyOnSave?: boolean;
  /** Call router.refresh() after a successful save. Defaults to true. */
  refreshOnSave?: boolean;
  /**
   * When true, always apply `initialValues` when they change (e.g. create wizard
   * after first save). Skips the dirty-guard that blocks stale `updated_at`.
   */
  hydrateOnInitialValuesChange?: boolean;
  /** Sellable SKU rows for inferring variant_strategy on save (not shown in UI). */
  getVariantStrategyContext?: () => Omit<InferVariantStrategyInput, "persistedStrategy">;
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
  hydrateOnInitialValuesChange = false,
  getVariantStrategyContext,
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

  const { handleSubmit, watch, setValue, register } = form;
  const trackInventoryAutoClearedRef = useRef(false);

  const itemId = watch("item_id");
  const categoryId = watch("category_id");
  const variantStrategy = watch("variant_strategy");
  const isMultiSku = variantStrategy === "MULTI_SKU";
  const itemType = watch("item_type");
  const classification = watch("classification");
  const isBundle = watch("is_bundle");
  const isPhysical = itemType === "PHYSICAL";
  const baseUom = watch("base_unit_of_measure");
  const purchaseUom = watch("purchase_uom");
  const previousBaseUomRef = useRef(baseUom);
  const previousClassificationRef = useRef<ItemClassification | null>(null);

  useEffect(() => {
    register("track_inventory");
  }, [register]);

  const categoryOptions = useMemo(
    () => parentSelectOptions(categories).filter((option) => option.id !== null),
    [categories]
  );

  const categoryTemplates = useMemo(() => {
    if (!categoryId) return [];
    return resolveEffectiveAttributeTemplates(categoryId, categories);
  }, [categories, categoryId]);

  const onSubmit = useCallback(
    (values: ProductMasterFormValues) => {
      const strategyContext = getVariantStrategyContext?.();
      const inferredStrategy = inferVariantStrategy({
        sellableVariantCount: strategyContext?.sellableVariantCount ?? 0,
        totalVariantRows: strategyContext?.totalVariantRows ?? 0,
        persistedStrategy: values.variant_strategy,
        selectedAxisCount: values.variant_axes?.length ?? 0,
      });

      const extraTemplates = values.extra_sku_options ?? [];
      const mergedTemplates = resolveItemCompositionTemplates(categoryTemplates, extraTemplates);

      const variantAxes = sanitizeItemVariantAxisKeys(
        values.variant_axes.length > 0
          ? values.variant_axes
          : inferredStrategy === "MULTI_SKU" && values.item_type === "PHYSICAL"
            ? defaultVariantAxisKeys(mergedTemplates, [])
            : values.variant_axes,
        categoryTemplates,
        extraTemplates
      );

      const axesMessage = validateItemVariantAxesSelection({
        variant_strategy: inferredStrategy,
        item_type: values.item_type,
        variant_axes: variantAxes,
        categoryTemplates,
        extraTemplates,
      });
      if (axesMessage) {
        form.setError(variantAxesZodIssuePath(), { type: "manual", message: axesMessage });
        if (notifyOnSave) {
          toast.error(axesMessage);
        }
        return;
      }

      const skuTrim = values.sku.trim();
      if (
        !skuTrim &&
        !values.item_id &&
        !catalogContext.catalog_items.sku_auto_generation_enabled
      ) {
        if (notifyOnSave) {
          toast.error("Product code is required.");
        }
        return;
      }

      if (values.item_type === "PHYSICAL") {
        const descriptiveTemplates = splitTemplatesByAxis(mergedTemplates, variantAxes).descriptive;
        for (const template of descriptiveTemplates) {
          if (!template.required) continue;
          const value = values.variant_attributes[template.key]?.trim() ?? "";
          if (!value) {
            const message = `${template.label} is required.`;
            if (notifyOnSave) {
              toast.error(message);
            }
            return;
          }
        }
      }

      const taxable = isTaxableSupplyCategory(values.default_tax_category);
      const normalizedRole = normalizeCompositionFromDetail({
        classification: values.classification,
        is_bundle: values.is_bundle,
      });
      const payload: ProductMasterFormValues = {
        ...values,
        sku: skuTrim,
        variant_strategy: inferredStrategy,
        variant_axes: variantAxes,
        extra_sku_options: extraTemplates,
        variant_attributes: pickDescriptiveVariantAttributes(
          values.variant_attributes,
          mergedTemplates,
          variantAxes
        ),
        classification: normalizedRole.classification,
        is_bundle: normalizedRole.is_bundle,
        hsn_sac_code: taxable ? values.hsn_sac_code : "",
        tax_code_id: taxable ? values.tax_code_id : null,
      };

      startTransition(async () => {
        if (!catalogContext.catalog_items.allow_duplicate_item_names) {
          const trimmedName = values.name.trim();
          if (trimmedName.length > 0) {
            const exact = await findExactItemByName(trimmedName, values.item_id);
            if ("error" in exact && exact.error) {
              if (notifyOnSave) {
                toast.error(exact.error);
              }
              return;
            }
            if (exact.match) {
              form.setError("name", {
                type: "manual",
                message: EXACT_DUPLICATE_ITEM_NAME_MESSAGE,
              });
              if (notifyOnSave) {
                toast.error(EXACT_DUPLICATE_ITEM_NAME_MESSAGE);
              }
              return;
            }
          }
        }

        const result = await saveProductMasterProfile(payload);

        if ("error" in result) {
          if (result.conflict && values.item_id) {
            const refreshed = await getProductDetail(values.item_id);
            if (!("error" in refreshed) && refreshed.detail) {
              setValue("updated_at", refreshed.detail.updated_at, { shouldDirty: false });
            }
          }
          if ("skuConflict" in result && result.skuConflict) {
            form.setError("sku", {
              type: "manual",
              message: result.error ?? "This product code is already in use.",
            });
          }
          if ("nameConflict" in result && result.nameConflict) {
            form.setError("name", {
              type: "manual",
              message: result.error ?? EXACT_DUPLICATE_ITEM_NAME_MESSAGE,
            });
          }
          if (notifyOnSave) {
            toast.error(result.error ?? "Unable to save product profile.");
          }
          return;
        }

        if (result.detail) {
          const hydrated = {
            ...detailToFormValues(result.detail),
            storefront_visibility: mergeStorefrontVisibility(
              catalogContext.storefronts,
              detailToFormValues(result.detail).storefront_visibility
            ),
          };
          form.reset(hydrated);
          previousBaseUomRef.current = hydrated.base_unit_of_measure;
        }

        const followUpOk = (await onSaved?.(result.itemId, result.detail ?? null)) !== false;

        if (notifyOnSave) {
          if (followUpOk) {
            const savedStrategy = payload.variant_strategy;
            const loadedStrategy = (initialValues ?? buildDefaultValues()).variant_strategy;
            const switchedToMulti =
              savedStrategy === "MULTI_SKU" && loadedStrategy !== "MULTI_SKU";
            toast.success(
              switchedToMulti
                ? "Product saved. Add or generate SKUs in the SKUs section."
                : ITEM_SAVE_SUCCESS
            );
          } else {
            toast.error(ITEM_SAVE_PARTIAL_REACH_ERROR);
          }
        }
        if (refreshOnSave) {
          router.refresh();
        }
      });
    },
    [
      catalogContext.catalog_items.sku_auto_generation_enabled,
      categoryTemplates,
      buildDefaultValues,
      form,
      initialValues,
      notifyOnSave,
      onSaved,
      refreshOnSave,
      router,
      catalogContext.storefronts,
      getVariantStrategyContext,
      setValue,
    ]
  );

  const submit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  useEffect(() => {
    onPendingChange?.(isPending);
  }, [isPending, onPendingChange]);

  const valuesSeedRef = useRef<string | null>(null);

  useEffect(() => {
    const nextUpdatedAt = initialValues?.updated_at;
    if (!itemId || !nextUpdatedAt) return;
    const currentUpdatedAt = form.getValues("updated_at");
    if (currentUpdatedAt === nextUpdatedAt) return;
    setValue("updated_at", nextUpdatedAt, { shouldDirty: false });
  }, [form, initialValues?.updated_at, itemId, setValue]);

  useEffect(() => {
    const nextValues = buildDefaultValues();
    const seed = `${mode}:${nextValues.item_id ?? "new"}:${nextValues.updated_at ?? ""}`;
    if (valuesSeedRef.current === seed) return;

    const previousSeed = valuesSeedRef.current;
    const previousMode = previousSeed?.split(":")[0];
    const sameItem =
      previousSeed != null &&
      previousSeed.split(":")[1] === (nextValues.item_id ?? "new");
    if (sameItem && form.formState.isDirty && !hydrateOnInitialValuesChange) {
      return;
    }

    // Create wizard: parent may flip mode before detail props arrive — keep saved item_id.
    const currentItemId = form.getValues("item_id");
    if (
      hydrateOnInitialValuesChange &&
      previousMode === "create" &&
      mode === "edit" &&
      currentItemId &&
      !nextValues.item_id
    ) {
      valuesSeedRef.current = `${mode}:${currentItemId}:${form.getValues("updated_at") ?? ""}`;
      return;
    }

    valuesSeedRef.current = seed;
    form.reset(nextValues);
    previousBaseUomRef.current = nextValues.base_unit_of_measure;
  }, [buildDefaultValues, form, hydrateOnInitialValuesChange, mode]);

  useEffect(() => {
    if (itemId || !categoryId) return;
    const category = categories.find((entry) => entry.id === categoryId);
    if (!category?.default_item_type) return;
    setValue("item_type", category.default_item_type, { shouldDirty: true });
  }, [categoryId, categories, itemId, setValue]);

  useEffect(() => {
    if (previousClassificationRef.current === classification) return;
    previousClassificationRef.current = classification;

    const defaults = commerceDefaultsForClassification(classification);
    if (!defaults) return;

    setValue("is_purchasable", defaults.is_purchasable, { shouldDirty: true });
    setValue("is_salable", defaults.is_salable, { shouldDirty: true });
  }, [classification, setValue]);

  // Keep classification and bundle aligned with item_type.
  useEffect(() => {
    const currentClassification = form.getValues("classification") as ItemClassification;
    const preserveLegacy =
      currentClassification === "PHYSICAL_GOOD" && itemType === "PHYSICAL";
    const nextClassification = deriveClassificationOnItemTypeChange(
      itemType,
      currentClassification,
      { preserveLegacyPhysicalGood: preserveLegacy }
    );
    if (nextClassification !== currentClassification) {
      setValue("classification", nextClassification, { shouldDirty: true });
    }
    if (!itemTypeSupportsComposition(itemType) && form.getValues("is_bundle")) {
      setValue("is_bundle", false, { shouldDirty: true });
    }
  }, [itemType, form, setValue]);

  // Non-physical items cannot hold stock, lot/serial tracking, or multi-SKU styles.
  useEffect(() => {
    if (itemType === "PHYSICAL") {
      if (
        trackInventoryAutoClearedRef.current &&
        !isBundle &&
        !form.getValues("track_inventory")
      ) {
        setValue("track_inventory", true, { shouldDirty: true });
        trackInventoryAutoClearedRef.current = false;
      }
      return;
    }
    if (form.getValues("track_inventory")) {
      trackInventoryAutoClearedRef.current = true;
      setValue("track_inventory", false, { shouldDirty: true });
    }
    if (form.getValues("tracking_mode") !== "NONE") {
      setValue("tracking_mode", "NONE", { shouldDirty: true });
    }
    if (form.getValues("variant_strategy") === "MULTI_SKU") {
      setValue("variant_strategy", "SINGLE_SKU", { shouldDirty: true });
    }
  }, [itemType, isBundle, form, setValue]);

  const trackInventory = watch("track_inventory");

  // Physical items without stock tracking do not use lot/serial modes.
  useEffect(() => {
    if (itemType !== "PHYSICAL" || trackInventory) return;
    if (form.getValues("tracking_mode") !== "NONE") {
      setValue("tracking_mode", "NONE", { shouldDirty: true });
    }
  }, [itemType, trackInventory, form, setValue]);

  useEffect(() => {
    if (
      shouldClearTrackInventoryWhenCompositionEnabled(
        isBundle,
        form.getValues("track_inventory")
      )
    ) {
      setValue("track_inventory", false, { shouldDirty: true });
    }
  }, [isBundle, form, setValue]);

  useEffect(() => {
    if (previousBaseUomRef.current === baseUom) return;

    setValue("selling_uom", baseUom, { shouldDirty: true });
    setValue("purchase_uom", baseUom, { shouldDirty: true });
    setValue("purchase_uom_conversion", "1", { shouldDirty: true });

    previousBaseUomRef.current = baseUom;
  }, [baseUom, setValue]);

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

function commerceDefaultsForClassification(
  classification: ItemClassification
): { is_purchasable: boolean; is_salable: boolean } | null {
  switch (classification) {
    case "RAW_MATERIAL":
    case "CONSUMABLE":
      return { is_purchasable: true, is_salable: false };
    case "WIP_ASSEMBLY":
      return { is_purchasable: false, is_salable: false };
    case "FINISHED_GOOD":
      return { is_purchasable: true, is_salable: true };
    case "SERVICE":
      return { is_purchasable: false, is_salable: true };
    default:
      return null;
  }
}
