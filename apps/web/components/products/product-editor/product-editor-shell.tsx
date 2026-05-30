"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FieldErrors } from "react-hook-form";
import {
  Boxes,
  ChevronRight,
  Layers,
  ListTree,
  Package,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ProductCatalogExtensions } from "@/components/products/product-catalog-extensions";
import { ProductMediaGallery } from "@/components/products/product-media-gallery";
import { ProductVariantPanel } from "@/components/products/product-variant-panel";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { Badge } from "@/components/ui/badge";
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
import type { CategoryRow } from "@/lib/categories/types";
import {
  ITEM_CLASSIFICATIONS,
  classificationLabel,
} from "@/lib/products/classification-labels";
import {
  ITEM_COSTING_METHODS,
  ITEM_STATUSES,
  ITEM_TRACKING_MODES,
  ITEM_TYPES,
  itemCostingMethodLabel,
  itemStatusLabel,
  itemTrackingModeLabel,
  itemTypeLabel,
} from "@/lib/products/item-model";
import { TAX_CATEGORY_OPTIONS, taxCategoryLabel } from "@/lib/products/tax-options";
import { UOM_OPTIONS } from "@/lib/products/uom-options";
import {
  PRODUCT_VARIANT_STRATEGIES,
  variantStrategyLabel,
} from "@/lib/products/variant-strategy";
import {
  useProductForm,
  type ProductFormMode,
} from "@/lib/products/use-product-form";
import type {
  ProductCatalogContext,
  ProductDetailSnapshot,
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductValuationSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

type SectionId = "overview" | "pricing" | "inventory" | "variants" | "media" | "catalog";
type SectionStatus = "error" | "complete" | "empty";

const SECTIONS: Array<{ id: SectionId; label: string; icon: typeof Package }> = [
  { id: "overview", label: "Overview", icon: Package },
  { id: "pricing", label: "Pricing & Tax", icon: Wallet },
  { id: "inventory", label: "Inventory & Costing", icon: Boxes },
  { id: "variants", label: "Variants", icon: Layers },
  { id: "media", label: "Media", icon: ListTree },
  { id: "catalog", label: "Catalog & Tags", icon: Tag },
];

function nextSection(id: SectionId): { id: SectionId; label: string } | null {
  const index = SECTIONS.findIndex((section) => section.id === id);
  const next = SECTIONS[index + 1];
  return next ? { id: next.id, label: next.label } : null;
}

// Maps a form field to the section that renders it, so an invalid save can jump
// the user to the first offending section.
const FIELD_SECTION: Partial<Record<keyof ProductMasterFormValues, SectionId>> = {
  classification: "overview",
  name: "overview",
  sku: "overview",
  item_type: "overview",
  status: "overview",
  description: "overview",
  category_id: "overview",
  variant_strategy: "overview",
  base_unit_of_measure: "overview",
  selling_price: "pricing",
  selling_uom: "pricing",
  purchase_uom: "pricing",
  purchase_uom_conversion: "pricing",
  purchase_price: "pricing",
  supplier_id: "pricing",
  hsn_sac_code: "pricing",
  standard_cost: "inventory",
  barcode: "inventory",
  dead_weight_kg: "inventory",
  weight: "inventory",
  volume: "inventory",
  length_cm: "inventory",
  width_cm: "inventory",
  height_cm: "inventory",
  custom_fields: "catalog",
  alternate_uoms: "catalog",
};

type Props = {
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  valuations?: ProductValuationSnapshot[];
  variants?: ProductVariantSnapshot[];
  media?: ProductMediaSnapshot[];
  initialValues?: ProductMasterFormValues;
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

function StatusDot({ status }: { status: SectionStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        status === "error" && "bg-destructive",
        status === "complete" && "bg-emerald-500",
        status === "empty" && "bg-muted-foreground/30"
      )}
    />
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  full,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("min-w-0 space-y-2", full && "sm:col-span-2")}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function ToggleRow({
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 sm:col-span-2">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * Anchored section card. Registers its element with the parent so the scroll-spy
 * can observe it and the nav can jump to it; renders a soft "Next" link instead
 * of forcing a wizard step.
 */
function SectionBlock({
  id,
  title,
  description,
  registerRef,
  onNext,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  registerRef: (el: HTMLDivElement | null) => void;
  onNext?: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  const next = nextSection(id);
  return (
    <div ref={registerRef} data-section={id} className="scroll-mt-20">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
        {next && onNext ? (
          <div className="mt-6 flex justify-end border-t border-border pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => onNext(next.id)}>
              Next: {next.label}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ProductEditorShell({
  tenantId,
  categories,
  catalogContext,
  valuations = [],
  variants = [],
  media = [],
  initialValues,
  mode = "create",
  onCancel,
  onSaved,
  onExtensionsChanged,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [tagOptions, setTagOptions] = useState(catalogContext.tags);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  const formRef = useRef<HTMLFormElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({});

  const {
    form,
    readOnly,
    isPending,
    fieldDisabled,
    onSubmit,
    itemId,
    variantStrategy,
    isMultiSku,
    itemType,
    isPhysical,
    baseUom,
    purchaseUom,
    categoryTemplates,
    categoryOptions,
  } = useProductForm({ categories, catalogContext, initialValues, mode, onSaved });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = form;

  const name = watch("name");
  const sku = watch("sku");
  const status = watch("status");
  const trackInventory = watch("track_inventory");
  const costingMethod = watch("costing_method");
  const trackingMode = watch("tracking_mode");
  const variantAttributes = watch("variant_attributes");
  const skuMask = watch("sku_mask");
  const customFields = watch("custom_fields");
  const alternateUoms = watch("alternate_uoms");
  const tagIds = watch("tag_ids");
  const storefrontVisibility = watch("storefront_visibility");
  const needsReview = watch("needs_review");
  const sellingPrice = watch("selling_price");
  const purchasePrice = watch("purchase_price");
  const standardCost = watch("standard_cost");

  useEffect(() => {
    setTagOptions(catalogContext.tags);
  }, [catalogContext.tags]);

  // Resolve the nearest scrollable ancestor (the dashboard canvas) as the
  // IntersectionObserver root; falls back to the viewport.
  useLayoutEffect(() => {
    let el = formRef.current?.parentElement ?? null;
    while (el) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        setScrollRoot(el);
        return;
      }
      el = el.parentElement;
    }
    setScrollRoot(null);
  }, []);

  // Scroll-spy: highlight the topmost visible section.
  useEffect(() => {
    const elements = SECTIONS.map((section) => sectionRefs.current[section.id]).filter(
      (el): el is HTMLDivElement => Boolean(el)
    );
    if (elements.length === 0) return;

    const visible = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-section");
          if (!id) continue;
          if (entry.isIntersecting) visible.add(id);
          else visible.delete(id);
        }
        const firstVisible = SECTIONS.find((section) => visible.has(section.id));
        if (firstVisible) setActiveSection(firstVisible.id);
      },
      { root: scrollRoot, rootMargin: "-96px 0px -60% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [scrollRoot]);

  // Keep the active chip in view on the mobile nav strip.
  useEffect(() => {
    const bar = chipBarRef.current;
    if (!bar) return;
    const activeChip = bar.querySelector<HTMLElement>(`[data-chip="${activeSection}"]`);
    activeChip?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeSection]);

  const scrollToSection = useCallback((id: SectionId) => {
    setActiveSection(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const registerSection = useCallback(
    (id: SectionId) => (el: HTMLDivElement | null) => {
      sectionRefs.current[id] = el;
    },
    []
  );

  const onInvalid = useCallback(
    (formErrors: FieldErrors<ProductMasterFormValues>) => {
      const firstField = Object.keys(formErrors)[0] as
        | keyof ProductMasterFormValues
        | undefined;
      const target = firstField ? FIELD_SECTION[firstField] : undefined;
      if (target) scrollToSection(target);
      toast.error("Please fix the highlighted fields before saving.");
    },
    [scrollToSection]
  );

  const handleSave = useMemo(
    () => handleSubmit(onSubmit, onInvalid),
    [handleSubmit, onSubmit, onInvalid]
  );

  const submitRef = useRef(handleSave);
  submitRef.current = handleSave;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (readOnly) return;
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submitRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readOnly]);

  const sectionErrors = useMemo(() => {
    const map: Record<SectionId, boolean> = {
      overview: false,
      pricing: false,
      inventory: false,
      variants: false,
      media: false,
      catalog: false,
    };
    (Object.keys(errors) as Array<keyof ProductMasterFormValues>).forEach((key) => {
      const section = FIELD_SECTION[key];
      if (section) map[section] = true;
    });
    return map;
  }, [errors]);

  const sectionStatus = useCallback(
    (id: SectionId): SectionStatus => {
      if (sectionErrors[id]) return "error";
      switch (id) {
        case "overview":
          return name?.trim() && sku?.trim() ? "complete" : "empty";
        case "pricing":
          return Number(sellingPrice) > 0 || Number(purchasePrice) > 0 ? "complete" : "empty";
        case "inventory":
          return trackInventory || Number(standardCost) > 0 ? "complete" : "empty";
        case "variants":
          return variants.length > 0 ? "complete" : "empty";
        case "media":
          return media.length > 0 ? "complete" : "empty";
        case "catalog": {
          const hasTags = Array.isArray(tagIds) && tagIds.length > 0;
          const hasCustom = Array.isArray(customFields) && customFields.length > 0;
          const hasUoms = Array.isArray(alternateUoms) && alternateUoms.length > 0;
          return hasTags || hasCustom || hasUoms ? "complete" : "empty";
        }
        default:
          return "empty";
      }
    },
    [
      sectionErrors,
      name,
      sku,
      sellingPrice,
      purchasePrice,
      trackInventory,
      standardCost,
      variants.length,
      media.length,
      tagIds,
      customFields,
      alternateUoms,
    ]
  );

  const skuLabel = isMultiSku ? "Style code" : "Master SKU";

  return (
    <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-4">
      {/* Summary header */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold sm:text-xl">
              {name?.trim() ? name : mode === "create" ? "New item" : "Untitled item"}
            </h2>
            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {sku?.trim() ? sku : "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="active">{itemTypeLabel(itemType)}</Badge>
            <Badge variant={status === "ACTIVE" ? "completed" : "locked"}>
              {itemStatusLabel(status)}
            </Badge>
            <Badge variant="default">{variantStrategyLabel(variantStrategy)}</Badge>
            {needsReview ? <Badge variant="action_required">Needs review</Badge> : null}
          </div>
        </div>
      </div>

      {/* Mobile / tablet sticky scroll-spy strip */}
      <div
        ref={chipBarRef}
        className="sticky top-0 z-20 -mx-1 flex gap-1 overflow-x-auto rounded-lg border border-border bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
      >
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              data-chip={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-transparent bg-secondary text-secondary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <StatusDot status={sectionStatus(section.id)} />
              {section.label}
            </button>
          );
        })}
      </div>

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6">
        {/* Desktop scroll-spy rail */}
        <nav className="hidden lg:block">
          <div className="sticky top-4 space-y-1">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-secondary font-medium text-secondary-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{section.label}</span>
                  <StatusDot status={sectionStatus(section.id)} />
                </button>
              );
            })}
          </div>
        </nav>

        {/* Continuous form */}
        <div className="min-w-0 space-y-4">
          <SectionBlock
            id="overview"
            title="Overview"
            description="Identity, type, and how this item behaves across the workspace."
            registerRef={registerSection("overview")}
            onNext={scrollToSection}
          >
            {/* AI assist slot (wiring lands in the next phase) */}
            <div className="mb-5 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-950/20">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Describe it, we&apos;ll draft it</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add a few words about the product and AI will suggest the name, description,
                    and other fields. Coming soon.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Input
                      placeholder="e.g. red cotton round-neck t-shirt, sizes S–XL"
                      disabled
                      className="flex-1"
                    />
                    <Button type="button" variant="outline" disabled title="Coming soon">
                      <Sparkles className="h-4 w-4" />
                      Suggest
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {needsReview && (
              <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30">
                <p className="font-medium text-amber-800 dark:text-amber-300">Needs review</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                  This item was quick-created. Complete the details, then clear the flag.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Item type">
                <Select
                  value={itemType}
                  disabled={fieldDisabled}
                  onValueChange={(value) =>
                    setValue("item_type", value as ProductMasterFormValues["item_type"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {itemTypeLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Lifecycle status">
                <Select
                  value={status}
                  disabled={fieldDisabled}
                  onValueChange={(value) =>
                    setValue("status", value as ProductMasterFormValues["status"], {
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {itemStatusLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Classification">
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
              </Field>

              <Field
                label="Variant strategy"
                hint={isMultiSku ? "Sellable SKUs are created in Variants after save." : undefined}
              >
                {itemId || !isPhysical ? (
                  <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                    {variantStrategyLabel(variantStrategy)}
                  </p>
                ) : (
                  <Select
                    value={variantStrategy}
                    disabled={fieldDisabled}
                    onValueChange={(value) =>
                      setValue(
                        "variant_strategy",
                        value as ProductMasterFormValues["variant_strategy"],
                        { shouldDirty: true }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_VARIANT_STRATEGIES.map((strategy) => (
                        <SelectItem key={strategy} value={strategy}>
                          {variantStrategyLabel(strategy)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Item name" htmlFor="name" error={errors.name?.message} full>
                <Input id="name" disabled={fieldDisabled} {...register("name")} />
              </Field>

              <Field label={skuLabel} htmlFor="sku" error={errors.sku?.message}>
                <Input id="sku" disabled={fieldDisabled} className="font-mono" {...register("sku")} />
              </Field>

              <Field label="Base unit of measure">
                <Select
                  value={baseUom}
                  disabled={fieldDisabled}
                  onValueChange={(value) => setValue("base_unit_of_measure", value, { shouldDirty: true })}
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
              </Field>

              <Field label="Category" full>
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
              </Field>

              <Field label="Description" htmlFor="description" error={errors.description?.message} full>
                <textarea
                  id="description"
                  disabled={fieldDisabled}
                  rows={4}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                    "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                  {...register("description")}
                />
              </Field>

              <ToggleRow
                label="Active"
                description="Inactive items are hidden from operational flows."
                checked={watch("is_active")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("is_active", checked, { shouldDirty: true })}
              />
              <ToggleRow
                label="Purchasable"
                description="Allow procurement and purchase orders for this item."
                checked={watch("is_purchasable")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("is_purchasable", checked, { shouldDirty: true })}
              />
              <ToggleRow
                label="Salable"
                description="Allow quotes, orders, and storefront exposure."
                checked={watch("is_salable")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("is_salable", checked, { shouldDirty: true })}
              />
              {needsReview && (
                <ToggleRow
                  label="Needs review"
                  description="Turn off once details are verified."
                  checked={needsReview}
                  disabled={fieldDisabled}
                  onCheckedChange={(checked) => setValue("needs_review", checked, { shouldDirty: true })}
                />
              )}
            </div>
          </SectionBlock>

          <SectionBlock
            id="pricing"
            title="Pricing & Tax"
            description="List price, purchase terms, and statutory tax attributes."
            registerRef={registerSection("pricing")}
            onNext={scrollToSection}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label={`Selling rate (${catalogContext.base_currency})`}
                htmlFor="selling_price"
                error={errors.selling_price?.message}
              >
                <Input
                  id="selling_price"
                  disabled={fieldDisabled}
                  className="text-right font-mono"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register("selling_price")}
                />
              </Field>

              <Field label="Selling unit">
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
              </Field>

              <Field label="Purchase unit">
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
              </Field>

              <Field
                label="Purchase conversion factor"
                htmlFor="purchase_uom_conversion"
                error={errors.purchase_uom_conversion?.message}
                hint={`How many ${baseUom} equal one ${purchaseUom}.`}
              >
                <Input
                  id="purchase_uom_conversion"
                  disabled={fieldDisabled || purchaseUom === baseUom}
                  className="text-right font-mono"
                  inputMode="decimal"
                  placeholder="1"
                  {...register("purchase_uom_conversion")}
                />
              </Field>

              <Field label="Preferred supplier" error={errors.supplier_id?.message} full>
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
              </Field>

              <Field
                label={`Purchase rate (${catalogContext.base_currency})`}
                htmlFor="purchase_price"
                error={errors.purchase_price?.message}
              >
                <Input
                  id="purchase_price"
                  disabled={fieldDisabled}
                  className="text-right font-mono"
                  inputMode="decimal"
                  placeholder="0.00"
                  {...register("purchase_price")}
                />
              </Field>

              <Field label="Default tax category">
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
              </Field>

              <Field label="HSN / SAC code" htmlFor="hsn_sac_code">
                <Input
                  id="hsn_sac_code"
                  disabled={fieldDisabled}
                  className="font-mono"
                  placeholder="e.g. 84713010"
                  {...register("hsn_sac_code")}
                />
              </Field>

              <ToggleRow
                label="Prices are tax inclusive"
                description="Treat the selling rate as inclusive of tax."
                checked={watch("price_is_tax_inclusive")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) =>
                  setValue("price_is_tax_inclusive", checked, { shouldDirty: true })
                }
              />
            </div>
          </SectionBlock>

          <SectionBlock
            id="inventory"
            title="Inventory & Costing"
            description="Stock tracking, valuation, identifiers, and physical attributes."
            registerRef={registerSection("inventory")}
            onNext={scrollToSection}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isPhysical ? (
                <ToggleRow
                  label="Track inventory"
                  description="Maintain stock balances and ledger movements."
                  checked={trackInventory}
                  disabled={fieldDisabled}
                  onCheckedChange={(checked) => setValue("track_inventory", checked, { shouldDirty: true })}
                />
              ) : (
                <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground sm:col-span-2">
                  {itemTypeLabel(itemType)} items do not hold stock.
                </p>
              )}

              {isPhysical && trackInventory && (
                <Field label="Costing method">
                  <Select
                    value={costingMethod}
                    disabled={fieldDisabled}
                    onValueChange={(value) =>
                      setValue("costing_method", value as ProductMasterFormValues["costing_method"], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_COSTING_METHODS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {itemCostingMethodLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {isPhysical && trackInventory && costingMethod === "STANDARD" && (
                <Field
                  label={`Standard cost (${catalogContext.base_currency})`}
                  htmlFor="standard_cost"
                  error={errors.standard_cost?.message}
                >
                  <Input
                    id="standard_cost"
                    disabled={fieldDisabled}
                    className="text-right font-mono"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register("standard_cost")}
                  />
                </Field>
              )}

              {isPhysical && (
                <Field label="Batch / serial tracking">
                  <Select
                    value={trackingMode}
                    disabled={fieldDisabled}
                    onValueChange={(value) =>
                      setValue("tracking_mode", value as ProductMasterFormValues["tracking_mode"], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ITEM_TRACKING_MODES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {itemTrackingModeLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {!isMultiSku && isPhysical && (
                <Field label="Barcode / GTIN" htmlFor="barcode" error={errors.barcode?.message}>
                  <Input id="barcode" disabled={fieldDisabled} className="font-mono" {...register("barcode")} />
                </Field>
              )}

              <Field label="Inventory valuation method" full>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                  {catalogContext.inventory_valuation_method}{" "}
                  <span className="text-muted-foreground">
                    (runtime engine: {catalogContext.runtime_valuation_engine})
                  </span>
                </div>
              </Field>

              <ToggleRow
                label="Bundle / kit"
                description="Fulfilled from a bill of materials rather than its own stock."
                checked={watch("is_bundle")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("is_bundle", checked, { shouldDirty: true })}
              />
              <ToggleRow
                label="Returnable"
                description="Allow this item to participate in return workflows."
                checked={watch("is_returnable")}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => setValue("is_returnable", checked, { shouldDirty: true })}
              />

              {!isMultiSku && isPhysical && (
                <>
                  <Field label="Dead weight (kg)" htmlFor="dead_weight_kg" full>
                    <Input
                      id="dead_weight_kg"
                      disabled={fieldDisabled}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("dead_weight_kg")}
                    />
                  </Field>
                  <Field label="Length (cm)" htmlFor="length_cm">
                    <Input
                      id="length_cm"
                      disabled={fieldDisabled}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("length_cm")}
                    />
                  </Field>
                  <Field label="Width (cm)" htmlFor="width_cm">
                    <Input
                      id="width_cm"
                      disabled={fieldDisabled}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("width_cm")}
                    />
                  </Field>
                  <Field label="Height (cm)" htmlFor="height_cm">
                    <Input
                      id="height_cm"
                      disabled={fieldDisabled}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("height_cm")}
                    />
                  </Field>
                </>
              )}
            </div>

            {valuations.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <h4 className="text-sm font-medium">Live inventory valuation (read-only)</h4>
                <div className="overflow-x-auto rounded-lg border border-border">
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
          </SectionBlock>

          <SectionBlock
            id="variants"
            title="Variants"
            description={
              isMultiSku
                ? "Manage the sellable SKUs that belong to this style."
                : "Category-driven attributes and any additional SKUs."
            }
            registerRef={registerSection("variants")}
            onNext={scrollToSection}
          >
            {itemId ? (
              <div className="space-y-6">
                {!isMultiSku && isPhysical && categoryTemplates.length > 0 && (
                  <div className="space-y-3">
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
                )}
                <ProductVariantPanel
                  itemId={itemId}
                  variants={variants}
                  categoryTemplates={categoryTemplates}
                  skuMask={skuMask}
                  baseSku={sku}
                  variantStrategy={variantStrategy}
                  readOnly={readOnly}
                  onChanged={() => onExtensionsChanged?.()}
                />
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Save the item first to manage variants.
              </p>
            )}
          </SectionBlock>

          <SectionBlock
            id="media"
            title="Media"
            description="Images shown across storefront, catalog, and documents."
            registerRef={registerSection("media")}
            onNext={scrollToSection}
          >
            {itemId ? (
              <ProductMediaGallery
                tenantId={tenantId}
                itemId={itemId}
                variants={variants}
                media={media}
                readOnly={readOnly}
                onChanged={() => onExtensionsChanged?.()}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                Save the item first to upload images.
              </p>
            )}
          </SectionBlock>

          <SectionBlock
            id="catalog"
            title="Catalog & Tags"
            description="SKU mask, custom fields, alternate units, tags, and storefront visibility."
            registerRef={registerSection("catalog")}
          >
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
          </SectionBlock>
        </div>
      </div>

      {/* Sticky action bar — reachable on every device */}
      {!readOnly && (
        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} title="Save (Cmd/Ctrl + Enter)">
            {isPending ? "Saving…" : "Save item"}
          </Button>
        </div>
      )}
    </form>
  );
}
