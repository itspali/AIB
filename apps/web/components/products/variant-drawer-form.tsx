"use client";

import { useCallback, useEffect, useMemo, useRef, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCw } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveItemVariant } from "@/app/items/actions";
import { ProductMediaGallery } from "@/components/products/product-media-gallery";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { Button } from "@/components/ui/button";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Switch } from "@/components/ui/switch";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import type { AttributeTemplateEntry, CategoryRow } from "@/lib/categories/types";
import type { ScanIdentifierPolicy } from "@/lib/products/catalog-item-settings";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import { VARIANT_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import {
  editorDimensionsLwhGridClass,
  editorFieldSpanFullClass,
  editorGridClass,
} from "@/lib/products/editor-chrome";
import { composeSkuFromMask, resolveEffectiveSkuMask } from "@/lib/products/sku-mask";
import { splitTemplatesByAxis } from "@/lib/products/variant-composition";
import {
  SELL_PRICE_COLUMN,
  VARIANT_SKU_LABEL,
} from "@/lib/products/product-user-labels";
import {
  computeVolumeCm3FromDimensions,
  formatCalculatedVolumeInfo,
} from "@/lib/products/shipping-dimensions";
import { itemVariantSchema } from "@/lib/products/variant-schemas";
import {
  scanPolicyMayUseSku,
  validateScanFriendlySku,
} from "@/lib/products/scan-friendly-sku";
import {
  resolveMasterFormSku,
  selectedSellableVariant,
  variantSnapshotToFormValues,
  type ItemVariantFormValues,
  type ProductDetailSnapshot,
  type ProductMediaSnapshot,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type VariantPanelMutationHeader = {
  variant: "edit";
  onCancel: () => void;
  onSave: () => void;
  isPending: boolean;
  isNavigatePending: boolean;
  saveLabel: string;
};

function comboKeyOf(attributes: Record<string, unknown>): string {
  return Object.keys(attributes)
    .filter((key) => String(attributes[key]).trim() !== "")
    .sort()
    .map((key) => `${key}=${String(attributes[key])}`)
    .join("|");
}

function resolveCategoryTemplates(
  categoryId: string | null,
  categories: CategoryRow[]
): AttributeTemplateEntry[] {
  if (!categoryId) return [];
  return resolveEffectiveAttributeTemplates(categoryId, categories);
}

type VariantEditFormCoreProps = {
  itemId: string;
  categoryTemplates: AttributeTemplateEntry[];
  siblingVariants: ProductVariantSnapshot[];
  skuMask: string;
  baseSku: string;
  initialValues: ItemVariantFormValues;
  isEditing: boolean;
  onSaved: () => void;
  active: boolean;
  showFooterActions?: boolean;
  onCancel?: () => void;
  onMutationHeaderChange?: (header: VariantPanelMutationHeader | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  contentClassName?: string;
  tenantId?: string;
  variants?: ProductVariantSnapshot[];
  media?: ProductMediaSnapshot[];
  focusedVariantId?: string | null;
  onMediaChanged?: () => void;
  variantAxisKeys?: string[];
  scanIdentifierPolicy?: ScanIdentifierPolicy;
};

function VariantEditFormCore({
  itemId,
  categoryTemplates,
  siblingVariants,
  skuMask,
  baseSku,
  initialValues,
  isEditing,
  onSaved,
  active,
  showFooterActions = true,
  onCancel,
  onMutationHeaderChange,
  onDirtyChange,
  contentClassName,
  tenantId,
  variants,
  media,
  focusedVariantId,
  onMediaChanged,
  variantAxisKeys = [],
  scanIdentifierPolicy,
}: VariantEditFormCoreProps) {
  const [isPending, startTransition] = useTransition();
  const axisAttributeTemplates = useMemo(
    () => splitTemplatesByAxis(categoryTemplates, variantAxisKeys).axes,
    [categoryTemplates, variantAxisKeys]
  );
  const effectiveSkuMask = useMemo(
    () => resolveEffectiveSkuMask(skuMask, axisAttributeTemplates),
    [skuMask, axisAttributeTemplates]
  );
  const skuManualRef = useRef(isEditing);
  const formRef = useRef<HTMLFormElement | null>(null);

  const form = useForm<ItemVariantFormValues>({
    resolver: zodResolver(itemVariantSchema),
    defaultValues: initialValues,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
    reset,
  } = form;
  const variantAttributes = watch("variant_attributes");
  const lengthCm = watch("length_cm");
  const widthCm = watch("width_cm");
  const heightCm = watch("height_cm");

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const computed = computeVolumeCm3FromDimensions(lengthCm, widthCm, heightCm);
    if (form.getValues("volume") === computed) return;
    setValue("volume", computed, { shouldDirty: true });
  }, [lengthCm, widthCm, heightCm, form, setValue]);

  const regenerateSku = useCallback(() => {
    const composed = composeSkuFromMask(effectiveSkuMask, baseSku || "ITEM", variantAttributes, {
      axisTemplates: axisAttributeTemplates,
    });
    if (composed) {
      setValue("sku", composed, { shouldDirty: true });
      skuManualRef.current = false;
    }
  }, [axisAttributeTemplates, effectiveSkuMask, baseSku, variantAttributes, setValue]);

  useEffect(() => {
    if (!active) return;
    reset(initialValues);
    skuManualRef.current = isEditing;
  }, [active, initialValues, reset, isEditing]);

  useEffect(() => {
    if (!active || isEditing || skuManualRef.current || !skuMask.trim()) return;
    const composed = composeSkuFromMask(effectiveSkuMask, baseSku || "ITEM", variantAttributes, {
      axisTemplates: axisAttributeTemplates,
    });
    if (composed) {
      setValue("sku", composed, { shouldDirty: true });
    }
  }, [active, axisAttributeTemplates, isEditing, effectiveSkuMask, baseSku, variantAttributes, setValue]);

  const onSubmit = useCallback(
    (values: ItemVariantFormValues) => {
      for (const template of axisAttributeTemplates) {
        if (template.required && !values.variant_attributes[template.key]?.trim()) {
          toast.error(`${template.label} is required for this variant.`);
          return;
        }
      }

      const axisAttributes = Object.fromEntries(
        axisAttributeTemplates.map((template) => [
          template.key,
          values.variant_attributes[template.key] ?? "",
        ])
      );
      const combo = comboKeyOf(axisAttributes);
      if (combo) {
        const clash = siblingVariants.some((variant) => {
          const siblingAxisAttributes = Object.fromEntries(
            axisAttributeTemplates.map((template) => [
              template.key,
              String(variant.variant_attributes[template.key] ?? ""),
            ])
          );
          return comboKeyOf(siblingAxisAttributes) === combo;
        });
        if (clash) {
          toast.error("Another variant already uses this exact attribute combination.");
          return;
        }
      }

      if (
        scanIdentifierPolicy &&
        scanPolicyMayUseSku(scanIdentifierPolicy) &&
        !values.barcode.trim()
      ) {
        const scanIssue = validateScanFriendlySku(values.sku);
        if (scanIssue) {
          toast.error(scanIssue);
          return;
        }
      }

      startTransition(async () => {
        const volume = computeVolumeCm3FromDimensions(
          values.length_cm,
          values.width_cm,
          values.height_cm
        );
        const result = await saveItemVariant({
          ...values,
          volume,
          item_id: itemId,
        });
        if ("error" in result) {
          toast.error(result.error ?? "Unable to save variant.");
          return;
        }
        toast.success(isEditing ? "Variant updated." : "Variant created.");
        onSaved();
      });
    },
    [axisAttributeTemplates, siblingVariants, itemId, isEditing, onSaved, scanIdentifierPolicy]
  );

  const submitForm = useCallback(() => {
    void formRef.current?.requestSubmit();
  }, []);

  useEffect(() => {
    if (!onMutationHeaderChange || !active) {
      onMutationHeaderChange?.(null);
      return;
    }

    onMutationHeaderChange({
      variant: "edit",
      onCancel: () => onCancel?.(),
      onSave: submitForm,
      isPending,
      isNavigatePending: false,
      saveLabel: isEditing ? "Save variant" : "Create variant",
    });
    return () => onMutationHeaderChange(null);
  }, [active, isEditing, isPending, onCancel, onMutationHeaderChange, submitForm]);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit)}
      className="flex h-full min-h-0 flex-col"
    >
      <div className={cn("flex-1 space-y-4 overflow-y-auto", contentClassName ?? "p-6")}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="variant_sku">{VARIANT_SKU_LABEL}</Label>
              {skuMask.trim() ? (
                <FieldLabelInfo label="Variant SKU">
                  <p className="font-mono">{VARIANT_FIELD_HELP.variantSkuMask(skuMask)}</p>
                </FieldLabelInfo>
              ) : null}
            </div>
            {skuMask.trim() ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-xs"
                disabled={isPending}
                onClick={regenerateSku}
              >
                <RotateCw className="h-3 w-3" />
                Regenerate
              </Button>
            ) : null}
          </div>
          <Input
            id="variant_sku"
            disabled={isPending}
            className="font-mono"
            {...register("sku", {
              onChange: () => {
                skuManualRef.current = true;
              },
            })}
          />
          {errors.sku ? <p className="text-xs text-destructive">{errors.sku.message}</p> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="variant_barcode">GTIN</Label>
            <FieldLabelInfo label="GTIN">{fieldHelpText(VARIANT_FIELD_HELP.gtin)}</FieldLabelInfo>
          </div>
          <Input
            id="variant_barcode"
            disabled={isPending}
            className="font-mono"
            {...register("barcode")}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="variant_price">{SELL_PRICE_COLUMN}</Label>
            <FieldLabelInfo label={SELL_PRICE_COLUMN}>
              {fieldHelpText(VARIANT_FIELD_HELP.sellPrice)}
            </FieldLabelInfo>
          </div>
          <Input
            id="variant_price"
            disabled={isPending}
            className="text-right font-mono"
            inputMode="decimal"
            {...register("price")}
          />
          {errors.price ? <p className="text-xs text-destructive">{errors.price.message}</p> : null}
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">Variant active</p>
            <FieldLabelInfo label="Variant active">
              {fieldHelpText(VARIANT_FIELD_HELP.active)}
            </FieldLabelInfo>
          </div>
          <Switch
            checked={watch("is_active")}
            disabled={isPending}
            onCheckedChange={(checked) => setValue("is_active", checked, { shouldDirty: true })}
          />
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h4 className="text-sm font-medium">Shipping & dimensions</h4>
          <div className={editorGridClass(true)}>
            <div className={cn(editorFieldSpanFullClass(true), editorDimensionsLwhGridClass())}>
              <div className="space-y-2">
                <Label htmlFor="variant_length">Length (cm)</Label>
                <Input
                  id="variant_length"
                  disabled={isPending}
                  className="text-right font-mono"
                  inputMode="decimal"
                  {...register("length_cm")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant_width">Width (cm)</Label>
                <Input
                  id="variant_width"
                  disabled={isPending}
                  className="text-right font-mono"
                  inputMode="decimal"
                  {...register("width_cm")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="variant_height">Height (cm)</Label>
                <Input
                  id="variant_height"
                  disabled={isPending}
                  className="text-right font-mono"
                  inputMode="decimal"
                  {...register("height_cm")}
                />
              </div>
            </div>
            <div className={cn("space-y-2", editorFieldSpanFullClass(true))}>
              <div className="flex items-center gap-1.5">
                <Label htmlFor="variant_dead_weight">Weight (kg)</Label>
                <FieldLabelInfo label="Weight (kg)">
                  {fieldHelpText(VARIANT_FIELD_HELP.weight)}
                </FieldLabelInfo>
              </div>
              <Input
                id="variant_dead_weight"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("dead_weight_kg")}
              />
            </div>
            <p className={cn("text-xs text-muted-foreground", editorFieldSpanFullClass(true))}>
              {formatCalculatedVolumeInfo(lengthCm, widthCm, heightCm)}
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <h4 className="text-sm font-medium">Variant attributes</h4>
          {axisAttributeTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This product has no variant axes configured. Set &quot;Varies by&quot; on the product
              before editing variant attributes.
            </p>
          ) : (
            <VariantAttributeFields
              templates={axisAttributeTemplates}
              values={variantAttributes}
              disabled={isPending}
              onChange={(key, value) =>
                setValue(
                  "variant_attributes",
                  { ...variantAttributes, [key]: value },
                  { shouldDirty: true }
                )
              }
            />
          )}
        </div>

        {isEditing && tenantId && variants && media && focusedVariantId ? (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Variant images</h4>
              <p className="text-xs text-muted-foreground">
                Shared images are read-only. Upload or remove images owned by this variant.
              </p>
            </div>
            <ProductMediaGallery
              tenantId={tenantId}
              itemId={itemId}
              variants={variants}
              media={media}
              focusedVariantId={focusedVariantId}
              onChanged={() => onMediaChanged?.()}
            />
          </div>
        ) : null}
      </div>

      {showFooterActions ? (
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isEditing ? "Save variant" : "Create variant"}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function VariantDrawerForm({
  open,
  onOpenChange,
  itemId,
  categoryTemplates,
  siblingVariants,
  skuMask,
  baseSku,
  initialValues,
  isEditing,
  onSaved,
  tenantId,
  variants,
  media,
  focusedVariantId,
  onMediaChanged,
  variantAxisKeys,
  scanIdentifierPolicy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  categoryTemplates: AttributeTemplateEntry[];
  siblingVariants: ProductVariantSnapshot[];
  skuMask: string;
  baseSku: string;
  initialValues: ItemVariantFormValues;
  isEditing: boolean;
  onSaved: () => void;
  tenantId?: string;
  variants?: ProductVariantSnapshot[];
  media?: ProductMediaSnapshot[];
  focusedVariantId?: string | null;
  onMediaChanged?: () => void;
  variantAxisKeys?: string[];
  scanIdentifierPolicy?: ScanIdentifierPolicy;
}) {
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({ active: open });

  const closeForm = () => {
    onOpenChange(false);
  };

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose(closeForm))}
        title={isEditing ? "Edit variant" : "Add variant"}
      >
        <VariantEditFormCore
          active={open}
          itemId={itemId}
          categoryTemplates={categoryTemplates}
          siblingVariants={siblingVariants}
          skuMask={skuMask}
          baseSku={baseSku}
          initialValues={initialValues}
          isEditing={isEditing}
          onSaved={onSaved}
          onCancel={() => requestClose(closeForm)}
          tenantId={tenantId}
          variants={variants}
          media={media}
          focusedVariantId={focusedVariantId}
          onMediaChanged={onMediaChanged}
          variantAxisKeys={variantAxisKeys}
          scanIdentifierPolicy={scanIdentifierPolicy}
        />
      </RightDrawer>
      {discardDialog}
    </>
  );
}

export function VariantCatalogEditForm({
  detail,
  categories,
  tenantId,
  onSaved,
  onCancel,
  onMutationHeaderChange,
  onDirtyChange,
  onMediaChanged,
}: {
  detail: ProductDetailSnapshot;
  categories: CategoryRow[];
  tenantId: string;
  onSaved: () => void;
  onCancel: () => void;
  onMutationHeaderChange?: (header: VariantPanelMutationHeader | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onMediaChanged?: () => void;
}) {
  const selectedVariant = selectedSellableVariant(detail);
  if (!selectedVariant) return null;

  const categoryTemplates = resolveCategoryTemplates(detail.category_id, categories);
  const siblingVariants = detail.variants.filter((variant) => variant.id !== selectedVariant.id);

  return (
    <VariantEditFormCore
      active
      itemId={detail.id}
      categoryTemplates={categoryTemplates}
      siblingVariants={siblingVariants}
      skuMask={detail.sku_mask ?? ""}
      baseSku={resolveMasterFormSku(detail)}
      initialValues={variantSnapshotToFormValues(selectedVariant, detail.id)}
      isEditing
      onSaved={onSaved}
      onCancel={onCancel}
      onMutationHeaderChange={onMutationHeaderChange}
      onDirtyChange={onDirtyChange}
      showFooterActions={false}
      contentClassName="p-3 pb-6"
      tenantId={tenantId}
      variants={detail.variants}
      media={detail.media}
      focusedVariantId={selectedVariant.id}
      onMediaChanged={onMediaChanged}
      variantAxisKeys={detail.variant_axes}
    />
  );
}
