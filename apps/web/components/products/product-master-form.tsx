"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveProductMasterProfile } from "@/app/items/actions";
import { ProductCatalogExtensions } from "@/components/products/product-catalog-extensions";
import { ProductMediaGallery } from "@/components/products/product-media-gallery";
import { ProductVariantPanel } from "@/components/products/product-variant-panel";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { FormSectionNav } from "@/components/settings/form-section-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parentSelectOptions } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import {
  ITEM_CLASSIFICATIONS,
  classificationLabel,
} from "@/lib/products/classification-labels";
import { productMasterSchema } from "@/lib/products/schemas";
import {
  TAX_CATEGORY_OPTIONS,
  taxCategoryLabel,
} from "@/lib/products/tax-options";
import { UOM_OPTIONS } from "@/lib/products/uom-options";
import {
  defaultProductFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductMasterFormValues,
  type ProductMediaSnapshot,
  type ProductValuationSnapshot,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import { PRODUCT_FORM_SECTIONS, PRODUCT_SECTION_IDS } from "@/lib/products/section-nav";
import { useFormSectionSpy } from "@/lib/settings/form-section-spy";
import { cn } from "@/lib/utils";

export type ProductFormMode = "create" | "view" | "edit";

type Props = {
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  valuations?: ProductValuationSnapshot[];
  variants?: ProductVariantSnapshot[];
  media?: ProductMediaSnapshot[];
  initialValues?: ProductMasterFormValues;
  layout?: "canvas" | "drawer";
  mode?: ProductFormMode;
  onCancel: () => void;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onExtensionsChanged?: () => void;
};

function formatMoney(amount: string, currency: string): string {
  const parsed = Number(amount);
  if (!amount || !Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(parsed);
}

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function ProductMasterForm({
  tenantId,
  categories,
  catalogContext,
  valuations = [],
  variants = [],
  media = [],
  initialValues,
  layout = "canvas",
  mode = "create",
  onCancel,
  onSaved,
  onExtensionsChanged,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tagOptions, setTagOptions] = useState(catalogContext.tags);
  const moduleHeaderRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const isDrawer = layout === "drawer";
  const readOnly = mode === "view";
  const fieldDisabled = isPending || readOnly;

  const form = useForm<ProductMasterFormValues>({
    resolver: zodResolver(productMasterSchema),
    defaultValues: initialValues ?? {
      ...defaultProductFormValues,
      storefront_visibility: mergeStorefrontVisibility(catalogContext.storefronts, []),
    },
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const showAdvanced = watch("show_advanced");
  const itemId = watch("item_id");
  const categoryId = watch("category_id");
  const baseUom = watch("base_unit_of_measure");
  const purchaseUom = watch("purchase_uom");
  const variantAttributes = watch("variant_attributes");
  const skuMask = watch("sku_mask");
  const masterSku = watch("sku");
  const customFields = watch("custom_fields");
  const alternateUoms = watch("alternate_uoms");
  const tagIds = watch("tag_ids");
  const storefrontVisibility = watch("storefront_visibility");
  const categoryOptions = parentSelectOptions(categories).filter((option) => option.id !== null);
  const previousBaseUomRef = useRef(baseUom);

  const categoryTemplates = useMemo(() => {
    if (!categoryId) return [];
    return categories.find((category) => category.id === categoryId)?.attribute_templates ?? [];
  }, [categories, categoryId]);

  const visibleSections = useMemo(
    () => PRODUCT_FORM_SECTIONS.filter((section) => !section.advanced || showAdvanced),
    [showAdvanced]
  );
  const sectionIds = useMemo(() => visibleSections.map((section) => section.id), [visibleSections]);
  const { activeId, scrollToSection } = useFormSectionSpy(sectionIds, {
    headerRef: moduleHeaderRef,
    scrollRootRef: isDrawer ? scrollRootRef : undefined,
  });

  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      const section = PRODUCT_FORM_SECTIONS.find((item) => item.id === sectionId);
      if (section?.advanced && !showAdvanced) {
        setValue("show_advanced", true);
        window.setTimeout(() => scrollToSection(sectionId), 100);
        return;
      }
      scrollToSection(sectionId);
    },
    [scrollToSection, setValue, showAdvanced]
  );

  const onSubmit = useCallback(
    (values: ProductMasterFormValues) => {
      startTransition(async () => {
        const result = await saveProductMasterProfile(values);

        if ("error" in result) {
          toast.error(result.error ?? "Unable to save product profile.");
          return;
        }

        toast.success("Product master profile saved successfully");
        onSaved(result.itemId, result.detail ?? null);
        router.refresh();
      });
    },
    [onSaved, router]
  );

  useEffect(() => {
    setTagOptions(catalogContext.tags);
  }, [catalogContext.tags]);

  useEffect(() => {
    const nextValues =
      initialValues ??
      ({
        ...defaultProductFormValues,
        storefront_visibility: mergeStorefrontVisibility(catalogContext.storefronts, []),
      } satisfies ProductMasterFormValues);
    form.reset(nextValues);
    previousBaseUomRef.current = nextValues.base_unit_of_measure;
  }, [initialValues, form, catalogContext.storefronts]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void handleSubmit(onSubmit)();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSubmit, onSubmit, readOnly]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn(isDrawer ? "flex h-full min-h-0 flex-col" : "space-y-6")}
    >
      {isDrawer && (
        <div
          ref={moduleHeaderRef}
          className="shrink-0 border-b border-border/60 bg-background pb-3"
        >
          <FormSectionNav
            sections={visibleSections}
            activeId={activeId}
            onSelect={handleSectionSelect}
          />
        </div>
      )}

      <div
        ref={scrollRootRef}
        className={cn(
          isDrawer ? "min-h-0 flex-1 space-y-6 overflow-y-auto py-1" : "space-y-6"
        )}
      >
      {!isDrawer && (
        <div>
          <h2 className="text-xl font-semibold">
            {initialValues?.item_id ? "Edit Product Master Profile" : "Create Product Master Profile"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Essentials cover identity, commerce flags, and master SKU. Advanced fields map to the
            full item and variant master schema.
          </p>
        </div>
      )}

      <section id={PRODUCT_SECTION_IDS.essentials} className="surface-panel space-y-4 scroll-mt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Essential Product Attributes
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Product classification type
            </Label>
            <Select
              value={watch("classification")}
              disabled={fieldDisabled}
              onValueChange={(value) =>
                setValue("classification", value as ProductMasterFormValues["classification"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select classification" />
              </SelectTrigger>
              <SelectContent>
                {ITEM_CLASSIFICATIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {classificationLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.classification && (
              <p className="text-xs text-destructive">{errors.classification.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name" className="text-sm font-medium text-muted-foreground">
              Root product name
            </Label>
            <Input id="name" disabled={fieldDisabled} {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku" className="text-sm font-medium text-muted-foreground">
              Master variant SKU
            </Label>
            <Input id="sku" disabled={fieldDisabled} className="font-mono" {...register("sku")} />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode" className="text-sm font-medium text-muted-foreground">
              Barcode / GTIN
            </Label>
            <Input id="barcode" disabled={fieldDisabled} className="font-mono" {...register("barcode")} />
            {errors.barcode && <p className="text-xs text-destructive">{errors.barcode.message}</p>}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Base unit of measure
            </Label>
            <Select
              value={watch("base_unit_of_measure")}
              disabled={fieldDisabled}
              onValueChange={(value) =>
                setValue("base_unit_of_measure", value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UOM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Associated category node
            </Label>
            <Select
              value={watch("category_id") ?? "none"}
              disabled={fieldDisabled}
              onValueChange={(value) =>
                setValue("category_id", value === "none" ? null : value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id!} value={option.id!}>
                    {"— ".repeat(option.depth)}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <SwitchRow
              label="Purchasable"
              description="Allow procurement and purchase order workflows for this item."
              checked={watch("is_purchasable")}
              disabled={fieldDisabled}
              onCheckedChange={(checked) => setValue("is_purchasable", checked, { shouldDirty: true })}
            />
          </div>

          <div className="sm:col-span-2">
            <SwitchRow
              label="Salable"
              description="Allow sales orders, quotations, and storefront exposure."
              checked={watch("is_salable")}
              disabled={fieldDisabled}
              onCheckedChange={(checked) => setValue("is_salable", checked, { shouldDirty: true })}
            />
          </div>

          <div className="sm:col-span-2">
            <SwitchRow
              label="Product active"
              description="Inactive products display as archived in the directory stream."
              checked={watch("is_active")}
              disabled={fieldDisabled}
              onCheckedChange={(checked) => setValue("is_active", checked, { shouldDirty: true })}
            />
          </div>
        </div>
      </section>

      <section id={PRODUCT_SECTION_IDS.commerce} className="surface-panel space-y-4 scroll-mt-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Commerce &amp; Costing
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Default list price, purchase unit, preferred supplier rate, and tenant valuation policy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="selling_price" className="text-sm font-medium text-muted-foreground">
              Default selling rate ({catalogContext.base_currency})
            </Label>
            <Input
              id="selling_price"
              disabled={fieldDisabled}
              className="text-right font-mono"
              inputMode="decimal"
              placeholder="0.00"
              {...register("selling_price")}
            />
            {errors.selling_price && (
              <p className="text-xs text-destructive">{errors.selling_price.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Selling unit</Label>
            <Select
              value={watch("selling_uom")}
              disabled={fieldDisabled}
              onValueChange={(value) => setValue("selling_uom", value, { shouldDirty: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UOM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Purchase unit</Label>
            <Select
              value={purchaseUom}
              disabled={fieldDisabled}
              onValueChange={(value) => {
                setValue("purchase_uom", value, { shouldDirty: true });
                if (value === baseUom) {
                  setValue("purchase_uom_conversion", "1", { shouldDirty: true });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UOM_OPTIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="purchase_uom_conversion"
              className="text-sm font-medium text-muted-foreground"
            >
              Purchase unit conversion factor
            </Label>
            <Input
              id="purchase_uom_conversion"
              disabled={fieldDisabled || purchaseUom === baseUom}
              className="text-right font-mono"
              inputMode="decimal"
              placeholder="1"
              {...register("purchase_uom_conversion")}
            />
            <p className="text-xs text-muted-foreground">
              How many {baseUom} equal one {purchaseUom}.
            </p>
            {errors.purchase_uom_conversion && (
              <p className="text-xs text-destructive">{errors.purchase_uom_conversion.message}</p>
            )}
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label className="text-sm font-medium text-muted-foreground">Preferred supplier</Label>
            <Select
              value={watch("supplier_id") ?? "none"}
              disabled={fieldDisabled}
              onValueChange={(value) =>
                setValue("supplier_id", value === "none" ? null : value, { shouldDirty: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No preferred supplier</SelectItem>
                {catalogContext.suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier_id && (
              <p className="text-xs text-destructive">{errors.supplier_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase_price" className="text-sm font-medium text-muted-foreground">
              Purchase rate ({catalogContext.base_currency})
            </Label>
            <Input
              id="purchase_price"
              disabled={fieldDisabled}
              className="text-right font-mono"
              inputMode="decimal"
              placeholder="0.00"
              {...register("purchase_price")}
            />
            {errors.purchase_price && (
              <p className="text-xs text-destructive">{errors.purchase_price.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Inventory valuation method</Label>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
              {catalogContext.inventory_valuation_method}{" "}
              <span className="text-muted-foreground">
                (runtime engine: {catalogContext.runtime_valuation_engine})
              </span>
            </div>
          </div>
        </div>

        {valuations.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-sm font-medium">Live inventory valuation (read-only)</h4>
            <div className="surface-inset overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="p-3 font-medium text-muted-foreground">Location</th>
                    <th className="p-3 font-medium text-muted-foreground">On hand</th>
                    <th className="p-3 font-medium text-muted-foreground">MWAC</th>
                  </tr>
                </thead>
                <tbody>
                  {valuations.map((row) => (
                    <tr key={row.location_id} className="border-b border-border last:border-0">
                      <td className="p-3">{row.location_name}</td>
                      <td className="p-3 font-mono">{row.total_quantity_on_hand}</td>
                      <td className="p-3 font-mono">
                        {formatMoney(row.current_average_cost, catalogContext.base_currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Show Advanced Parameters</p>
          <p className="text-xs text-muted-foreground">
            Description, tax category, logistics, variant flags, and category-driven attributes.
          </p>
        </div>
        <Switch
          checked={showAdvanced}
          disabled={fieldDisabled}
          onCheckedChange={(checked) => setValue("show_advanced", checked)}
        />
      </div>

      {showAdvanced && (
        <section
          id={PRODUCT_SECTION_IDS.advanced}
          className="surface-panel space-y-6 scroll-mt-4"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Advanced Logistical &amp; Statutory Attributes
          </h3>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">
                Product description
              </Label>
              <textarea
                id="description"
                disabled={fieldDisabled}
                rows={4}
                className={cn(
                  "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
                )}
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-muted-foreground">
                Default tax category
              </Label>
              <Select
                value={watch("default_tax_category")}
                disabled={fieldDisabled}
                onValueChange={(value) =>
                  setValue(
                    "default_tax_category",
                    value as ProductMasterFormValues["default_tax_category"],
                    { shouldDirty: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_CATEGORY_OPTIONS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {taxCategoryLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="hsn_sac_code" className="text-sm font-medium text-muted-foreground">
                Statutory return code (HSN/SAC)
              </Label>
              <Input
                id="hsn_sac_code"
                disabled={fieldDisabled}
                className="text-right font-mono"
                placeholder="e.g. 84713010"
                {...register("hsn_sac_code")}
              />
            </div>

            <div className="sm:col-span-2">
              <SwitchRow
                label="Multi-variant product"
                description="Enable additional SKU variants. Use the variant manager below after saving."
                checked={watch("has_variants")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("has_variants", checked, { shouldDirty: true })}
              />
            </div>

            <div className="sm:col-span-2">
              <SwitchRow
                label="Return policy eligibility"
                description="Allow this product to participate in return workflows."
                checked={watch("is_returnable")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("is_returnable", checked, { shouldDirty: true })}
              />
            </div>

            <div className="sm:col-span-2">
              <SwitchRow
                label="Master variant active"
                description="Inactive variants remain linked but are excluded from operational flows."
                checked={watch("variant_is_active")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) =>
                  setValue("variant_is_active", checked, { shouldDirty: true })
                }
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dead_weight_kg" className="text-sm font-medium text-muted-foreground">
                Variant physical dead weight (kg)
              </Label>
              <Input
                id="dead_weight_kg"
                disabled={fieldDisabled}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("dead_weight_kg")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm font-medium text-muted-foreground">
                Legacy weight (optional)
              </Label>
              <Input
                id="weight"
                disabled={fieldDisabled}
                className="text-right font-mono"
                inputMode="decimal"
                placeholder="NUMERIC(15,4)"
                {...register("weight")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="volume" className="text-sm font-medium text-muted-foreground">
                Volume (optional)
              </Label>
              <Input
                id="volume"
                disabled={fieldDisabled}
                className="text-right font-mono"
                inputMode="decimal"
                placeholder="NUMERIC(15,4)"
                {...register("volume")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="length_cm" className="text-sm font-medium text-muted-foreground">
                Length (cm)
              </Label>
              <Input
                id="length_cm"
                disabled={fieldDisabled}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("length_cm")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="width_cm" className="text-sm font-medium text-muted-foreground">
                Width (cm)
              </Label>
              <Input
                id="width_cm"
                disabled={fieldDisabled}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("width_cm")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="height_cm" className="text-sm font-medium text-muted-foreground">
                Height (cm)
              </Label>
              <Input
                id="height_cm"
                disabled={fieldDisabled}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("height_cm")}
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-sm font-medium">Category variant attributes</h4>
            <VariantAttributeFields
              templates={categoryTemplates}
              values={variantAttributes}
              disabled={fieldDisabled}
              onChange={(key, value) =>
                setValue(
                  "variant_attributes",
                  { ...variantAttributes, [key]: value },
                  { shouldDirty: true }
                )
              }
            />
          </div>

          <ProductCatalogExtensions
            catalogContext={{ ...catalogContext, tags: tagOptions }}
            categoryTemplates={categoryTemplates}
            disabled={fieldDisabled}
            values={{
              sku_mask: skuMask,
              custom_fields: customFields,
              alternate_uoms: alternateUoms,
              tag_ids: tagIds,
              storefront_visibility: storefrontVisibility,
              base_unit_of_measure: baseUom,
            }}
            onTagsChanged={setTagOptions}
            onChange={(key, value) => {
              switch (key) {
                case "sku_mask":
                  setValue("sku_mask", value as string, { shouldDirty: true });
                  break;
                case "custom_fields":
                  setValue("custom_fields", value as ProductMasterFormValues["custom_fields"], {
                    shouldDirty: true,
                  });
                  break;
                case "alternate_uoms":
                  setValue("alternate_uoms", value as ProductMasterFormValues["alternate_uoms"], {
                    shouldDirty: true,
                  });
                  break;
                case "tag_ids":
                  setValue("tag_ids", value as string[], { shouldDirty: true });
                  break;
                case "storefront_visibility":
                  setValue(
                    "storefront_visibility",
                    value as ProductMasterFormValues["storefront_visibility"],
                    { shouldDirty: true }
                  );
                  break;
                case "base_unit_of_measure":
                  setValue("base_unit_of_measure", value as string, { shouldDirty: true });
                  break;
              }
            }}
          />
        </section>
      )}

      {!isDrawer && itemId && (
        <>
          <ProductVariantPanel
            itemId={itemId}
            variants={variants}
            categoryTemplates={categoryTemplates}
            skuMask={skuMask}
            baseSku={masterSku}
            onChanged={() => onExtensionsChanged?.()}
          />
          <ProductMediaGallery
            tenantId={tenantId}
            itemId={itemId}
            variants={variants}
            media={media}
            onChanged={() => onExtensionsChanged?.()}
          />
        </>
      )}

      {!isDrawer && !itemId && (
        <section className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Save the product profile first to manage additional variants and upload images.
        </section>
      )}

      {isDrawer && itemId && (
        <>
          <ProductVariantPanel
            itemId={itemId}
            variants={variants}
            categoryTemplates={categoryTemplates}
            skuMask={skuMask}
            baseSku={masterSku}
            readOnly={readOnly}
            onChanged={() => onExtensionsChanged?.()}
          />
          <ProductMediaGallery
            tenantId={tenantId}
            itemId={itemId}
            variants={variants}
            media={media}
            readOnly={readOnly}
            onChanged={() => onExtensionsChanged?.()}
          />
        </>
      )}

      {isDrawer && !itemId && (
        <section className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
          Save the product profile first to manage additional variants and upload images.
        </section>
      )}
      </div>

      {mode !== "view" && (
      <div
        className={cn(
          isDrawer
            ? "flex shrink-0 items-center justify-end gap-2 border-t border-border pt-4"
            : "canvas-sticky-footer"
        )}
      >
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending} title="Save (Cmd/Ctrl + Enter)">
          Save Product Master Profile
        </Button>
      </div>
      )}
    </form>
  );
}
