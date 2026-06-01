"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import Link from "next/link";
import type { FieldErrors } from "react-hook-form";
import {
  Boxes,
  ChevronRight,
  Layers,
  Info,
  ListTree,
  Lock,
  Package,
  Ruler,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { findSimilarItems, type SimilarItem } from "@/app/items/actions";
import { ProductCatalogExtensions } from "@/components/products/product-catalog-extensions";
import { ProductUnitsSection } from "@/components/products/product-units-section";
import { ProductMediaGallery } from "@/components/products/product-media-gallery";
import { ProductPrimaryImage } from "@/components/products/product-primary-image";
import { ProductVariantPanel } from "@/components/products/product-variant-panel";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import { VariantAssortmentMatrix } from "@/components/products/variant-assortment-matrix";
import { VariantChannelAvailabilityMatrix } from "@/components/products/variant-channel-availability-matrix";
import { PriceBookEntryEditor } from "@/components/products/price-book-entry-editor";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemWithDescription,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/lib/categories/types";
import {
  classificationChoice,
  classificationDescription,
  classificationLabel,
} from "@/lib/products/classification-labels";
import { classificationsForItemType } from "@/lib/products/item-type-classification";
import {
  ITEM_COSTING_METHODS,
  ITEM_TRACKING_MODES,
  ITEM_TYPES,
  itemCostingMethodLabel,
  itemLifecycleStatusFromActive,
  itemOperationalStatusLabel,
  itemTrackingModeLabel,
  itemTypeChoice,
  itemTypeDescription,
  itemTypeLabel,
} from "@/lib/products/item-model";
import { conversionFactorForAlternate } from "@/lib/products/item-uom-commerce";
import {
  isTaxableSupplyCategory,
  TAX_CATEGORY_OPTIONS,
  taxCategoryLabel,
} from "@/lib/products/tax-options";
import { resolveItemTaxCodePickerOptions } from "@/lib/tax/item-tax-code-picker";
import {
  resolveItemCommerceUomOptions,
  type UomOption,
} from "@/lib/products/uom-options";
import {
  VARIANT_STRATEGY_CHOICES,
  VARIANT_STRATEGY_FIELD_INTRO,
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
import { formatDate } from "@/lib/dashboard/format";
import {
  isProductFormFieldEditable,
  type ProductFieldPermissions,
} from "@/lib/products/field-permissions";
import {
  resolveActiveSectionByScrollPosition,
  resolveScrollSpyAnchorLine,
  scrollChipIntoCenter,
  scrollElementInDashboardRoot,
} from "@/lib/settings/form-section-spy";
import { useElementWidth } from "@/lib/layout/use-element-width";
import {
  editorEmptyStateClass,
  editorGridClass,
  editorInsetTableWrapClass,
  editorPageSectionClass,
  editorPanelSectionClass,
  editorPanelSectionRailClass,
  editorPanelSectionRailStickyClass,
  editorReadOnlyFieldClass,
  editorSubsectionClass,
  editorSwitchSize,
  editorPanelLayoutGridClass,
  editorPanelBadgesClass,
  editorPanelScrollMarginClass,
  resolveEditorPanelHorizontalRail,
  EditorPanelContext,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";

type SectionId = "overview" | "units" | "pricing" | "inventory" | "variants" | "media" | "catalog";
type SectionStatus = "error" | "complete" | "empty";

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  shortLabel: string;
  icon: typeof Package;
}> = [
  { id: "overview", label: "Overview", shortLabel: "Overview", icon: Package },
  { id: "units", label: "Units of measure", shortLabel: "Units", icon: Ruler },
  { id: "pricing", label: "Pricing", shortLabel: "Pricing", icon: Wallet },
  { id: "inventory", label: "Inventory & Costing", shortLabel: "Inventory", icon: Boxes },
  { id: "variants", label: "Variants", shortLabel: "Variants", icon: Layers },
  { id: "media", label: "Media", shortLabel: "Media", icon: ListTree },
  { id: "catalog", label: "Catalog & Tags", shortLabel: "Catalog", icon: Tag },
];

const SECTION_IDS = SECTIONS.map((section) => section.id);

function resolveEditorScrollSpyOffset(
  isPanelLayout: boolean,
  stickyNavHeight: number,
  panelRailHorizontal: boolean
): number {
  const baseOffset = isPanelLayout ? 20 : 96;
  if (!isPanelLayout && stickyNavHeight > 0) return baseOffset + stickyNavHeight + 8;
  if (isPanelLayout && panelRailHorizontal && stickyNavHeight > 0) {
    return baseOffset + stickyNavHeight + 8;
  }
  return baseOffset;
}

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
  base_unit_of_measure: "units",
  selling_price: "pricing",
  selling_uom: "pricing",
  purchase_uom: "pricing",
  purchase_uom_conversion: "pricing",
  purchase_price: "pricing",
  supplier_id: "pricing",
  hsn_sac_code: "overview",
  tax_code_id: "overview",
  default_tax_category: "overview",
  is_returnable: "pricing",
  standard_cost: "inventory",
  barcode: "inventory",
  dead_weight_kg: "inventory",
  volume: "inventory",
  length_cm: "inventory",
  width_cm: "inventory",
  height_cm: "inventory",
  custom_fields: "catalog",
  alternate_uoms: "units",
};

type Props = {
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  detail?: ProductDetailSnapshot | null;
  valuations?: ProductValuationSnapshot[];
  variants?: ProductVariantSnapshot[];
  media?: ProductMediaSnapshot[];
  initialValues?: ProductMasterFormValues;
  mode?: ProductFormMode;
  layout?: "page" | "panel";
  fieldPermissions?: ProductFieldPermissions;
  /** Fields locked server-side because the item has transactional history. */
  lockedFields?: string[];
  onCancel: () => void;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onExtensionsChanged?: () => void;
  isNavigatePending?: boolean;
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

function EditorSectionRail({
  activeSection,
  onSelect,
  showStatus,
  sectionStatus,
  compact = false,
  horizontal = false,
  railRef,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  showStatus: boolean;
  sectionStatus: (id: SectionId) => SectionStatus;
  compact?: boolean;
  horizontal?: boolean;
  railRef?: RefObject<HTMLElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!horizontal) return;
    const track = trackRef.current;
    if (!track) return;
    const chip = track.querySelector<HTMLElement>(`[data-section-rail="${activeSection}"]`);
    if (chip) scrollChipIntoCenter(track, chip);
  }, [activeSection, horizontal]);

  return (
    <nav
      ref={railRef}
      aria-label="Form sections"
      className={cn(compact ? editorPanelSectionRailClass(horizontal) : "hidden lg:block")}
    >
      <div
        ref={trackRef}
        className={cn(
          !compact && "space-y-0.5",
          compact ? editorPanelSectionRailStickyClass(horizontal) : "sticky top-4"
        )}
      >
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              data-section-rail={section.id}
              onClick={() => onSelect(section.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg text-left transition-colors",
                horizontal && "shrink-0 gap-1.5 px-2 py-1.5 text-xs",
                !horizontal && "w-full",
                !horizontal && compact && "gap-1.5 px-1.5 py-1.5 text-xs",
                !horizontal && !compact && "px-3 py-2 text-sm",
                active
                  ? horizontal
                    ? "border border-primary bg-secondary/80 font-medium text-secondary-foreground ring-1 ring-inset ring-primary"
                    : "bg-secondary font-medium text-secondary-foreground"
                  : horizontal
                    ? "border border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("shrink-0", compact || horizontal ? "h-3.5 w-3.5" : "h-4 w-4")} />
              <span className={cn("leading-snug", horizontal ? "whitespace-nowrap" : "min-w-0 flex-1")}>
                {compact || horizontal ? section.shortLabel : section.label}
              </span>
              {showStatus ? <StatusDot status={sectionStatus(section.id)} /> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function FieldLabelInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`About ${label}`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-3">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  info,
  full,
  locked,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  /** Shown in a popover from the info icon beside the label. */
  info?: React.ReactNode;
  full?: boolean;
  locked?: boolean;
  children: React.ReactNode;
}) {
  const panel = useEditorPanelLayout();
  return (
    <div className={cn("min-w-0", panel ? "space-y-1.5" : "space-y-2", full && "sm:col-span-2")}>
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={htmlFor}
          className={cn("font-medium text-muted-foreground", panel ? "text-xs" : "text-sm")}
        >
          {label}
        </Label>
        {info ? <FieldLabelInfo label={label}>{info}</FieldLabelInfo> : null}
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            Locked
          </span>
        ) : null}
      </div>
      {children}
      {locked && !error ? (
        <p className="text-xs text-muted-foreground">Locked because transactions exist for this item.</p>
      ) : null}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function DefaultUnitField({
  label,
  stockUom,
  value,
  options,
  fieldDisabled,
  useDifferent,
  onUseDifferentChange,
  onUnitChange,
  conversionHint,
}: {
  label: string;
  stockUom: string;
  value: string;
  options: UomOption[];
  fieldDisabled: boolean;
  useDifferent: boolean;
  onUseDifferentChange: (useDifferent: boolean) => void;
  onUnitChange: (code: string) => void;
  conversionHint?: string;
}) {
  const panel = useEditorPanelLayout();
  const selectId = `${label.replace(/\s+/g, "-").toLowerCase()}-uom`;
  const toggleId = `${selectId}-use-different`;

  return (
    <Field
      label={label}
      hint={
        !useDifferent
          ? `Using base unit (${stockUom}).`
          : conversionHint
      }
    >
      <Select
        value={useDifferent ? value : stockUom}
        disabled={fieldDisabled || !useDifferent}
        onValueChange={onUnitChange}
      >
        <SelectTrigger id={selectId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.code}
              {option.name && option.name !== option.code ? ` · ${option.name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className={cn("flex items-center gap-2", panel ? "pt-0.5" : "pt-1")}>
        <Switch
          id={toggleId}
          size={editorSwitchSize}
          checked={useDifferent}
          disabled={fieldDisabled}
          onCheckedChange={onUseDifferentChange}
        />
        <Label
          htmlFor={toggleId}
          className="cursor-pointer text-xs font-normal text-muted-foreground"
        >
          Use different unit
        </Label>
      </div>
    </Field>
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
  const panel = useEditorPanelLayout();
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 sm:col-span-2",
        panel ? "py-0.5" : "rounded-lg border border-border px-3 py-2"
      )}
    >
      <div className="min-w-0 pr-2">
        <p className={cn("font-medium leading-snug", panel ? "text-xs" : "text-sm")}>{label}</p>
        <p className={cn("text-muted-foreground leading-snug", panel ? "text-[11px]" : "text-xs")}>
          {description}
        </p>
      </div>
      <Switch
        size={editorSwitchSize}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function editorCardClassName(panel: boolean, variant: "summary" | "section" = "section") {
  return panel ? editorPanelSectionClass() : editorPageSectionClass(variant);
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
  panel = false,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  registerRef: (el: HTMLDivElement | null) => void;
  onNext?: (id: SectionId) => void;
  panel?: boolean;
  children: React.ReactNode;
}) {
  const next = nextSection(id);
  return (
    <div
      ref={registerRef}
      data-section={id}
      className={cn("scroll-mt-20", panel && editorPanelScrollMarginClass())}
    >
      <section className={editorCardClassName(panel, "section")}>
        <div
          className={cn(
            panel ? "mb-3 border-b border-border/60 pb-2.5" : "mb-4"
          )}
        >
          <h3
            className={cn(
              "font-semibold",
              panel
                ? "text-sm text-foreground"
                : "text-sm uppercase tracking-wide text-muted-foreground"
            )}
          >
            {title}
          </h3>
          {description ? (
            <p
              className={cn(
                "text-muted-foreground",
                panel ? "mt-1 text-xs leading-snug" : "mt-1 text-xs"
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {children}
        {next && onNext && !panel ? (
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
  detail = null,
  valuations = [],
  variants = [],
  media = [],
  initialValues,
  mode = "create",
  layout = "page",
  fieldPermissions,
  lockedFields = [],
  onCancel,
  onSaved,
  onExtensionsChanged,
  isNavigatePending = false,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [tagOptions, setTagOptions] = useState(catalogContext.tags);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [duplicates, setDuplicates] = useState<SimilarItem[]>([]);

  const lockedSet = useMemo(() => new Set(lockedFields), [lockedFields]);
  const isLocked = useCallback((field: string) => lockedSet.has(field), [lockedSet]);
  const isPanelLayout = layout === "panel";
  const { ref: panelLayoutRef, width: panelPaneWidth } = useElementWidth<HTMLDivElement>();
  const panelRailHorizontal =
    isPanelLayout && resolveEditorPanelHorizontalRail(panelPaneWidth);

  const formRef = useRef<HTMLFormElement | null>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const panelRailRef = useRef<HTMLElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({});
  const ignoreSpyUntilRef = useRef(0);

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

  const disableInput = useCallback(
    (formField: keyof ProductMasterFormValues | string, lockKey?: string) => {
      if (fieldDisabled) return true;
      if (lockKey && isLocked(lockKey)) return true;
      if (!readOnly && fieldPermissions && !isProductFormFieldEditable(String(formField), fieldPermissions)) {
        return true;
      }
      return false;
    },
    [fieldDisabled, fieldPermissions, isLocked, readOnly]
  );
  const pricingFieldsLocked =
    !readOnly &&
    fieldPermissions != null &&
    !isProductFormFieldEditable("selling_price", fieldPermissions) &&
    !isProductFormFieldEditable("purchase_price", fieldPermissions);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  const name = watch("name");
  const sku = watch("sku");
  const isActive = watch("is_active");
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
  const isSalable = watch("is_salable");
  const defaultTaxCategory = watch("default_tax_category");
  const taxCodeId = watch("tax_code_id");
  const isTaxableCategory = isTaxableSupplyCategory(defaultTaxCategory);
  const isPurchasable = watch("is_purchasable");
  const sellingPrice = watch("selling_price");
  const purchasePrice = watch("purchase_price");
  const standardCost = watch("standard_cost");
  const deadWeightKg = watch("dead_weight_kg");
  const shippingVolume = watch("volume");
  const lengthCm = watch("length_cm");
  const widthCm = watch("width_cm");
  const heightCm = watch("height_cm");

  const categoryId = watch("category_id");
  const currentClassification = watch("classification");

  const classificationOptions = useMemo(
    () =>
      classificationsForItemType(itemType, {
        includeLegacyPhysicalGood: currentClassification === "PHYSICAL_GOOD",
      }),
    [itemType, currentClassification]
  );

  const itemTaxCodePickerOptions = useMemo(
    () =>
      resolveItemTaxCodePickerOptions(catalogContext.tax_codes, {
        includeTaxCodeId: taxCodeId,
      }),
    [catalogContext.tax_codes, taxCodeId]
  );

  useEffect(() => {
    setTagOptions(catalogContext.tags);
  }, [catalogContext.tags]);

  // Best-effort duplicate detection while creating a new item.
  useEffect(() => {
    if (itemId || readOnly) {
      setDuplicates([]);
      return;
    }
    const trimmed = (name ?? "").trim();
    if (trimmed.length < 2) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(async () => {
      const result = await findSimilarItems(trimmed, { categoryId, limit: 5 });
      if (!cancelled && "matches" in result) setDuplicates(result.matches ?? []);
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [name, categoryId, itemId, readOnly]);

  const priceBookUomCodes = useMemo(
    () =>
      Array.from(new Set([baseUom, ...(alternateUoms ?? []).map((row) => row.uom_code)])).filter(
        Boolean
      ),
    [baseUom, alternateUoms]
  );

  const sellingUom = watch("selling_uom");

  const commerceUomOptions = useMemo(
    () =>
      resolveItemCommerceUomOptions(baseUom, alternateUoms ?? [], catalogContext.uoms, sellingUom),
    [baseUom, alternateUoms, catalogContext.uoms, sellingUom]
  );
  const purchaseCommerceUomOptions = useMemo(
    () =>
      resolveItemCommerceUomOptions(baseUom, alternateUoms ?? [], catalogContext.uoms, purchaseUom),
    [baseUom, alternateUoms, catalogContext.uoms, purchaseUom]
  );

  const [useDifferentSellingUnit, setUseDifferentSellingUnit] = useState(false);
  const [useDifferentPurchaseUnit, setUseDifferentPurchaseUnit] = useState(false);
  const previousStockUomForUnitTogglesRef = useRef(baseUom);

  useEffect(() => {
    if (isDirty) return;
    setUseDifferentSellingUnit(sellingUom !== baseUom);
    setUseDifferentPurchaseUnit(purchaseUom !== baseUom);
  }, [isDirty, sellingUom, purchaseUom, baseUom]);

  useEffect(() => {
    if (previousStockUomForUnitTogglesRef.current === baseUom) return;
    previousStockUomForUnitTogglesRef.current = baseUom;
    setUseDifferentSellingUnit(false);
    setUseDifferentPurchaseUnit(false);
  }, [baseUom]);

  const purchaseConversionFromCatalog = useMemo(
    () => conversionFactorForAlternate(alternateUoms ?? [], purchaseUom),
    [alternateUoms, purchaseUom]
  );
  const showPurchaseConversionField =
    useDifferentPurchaseUnit &&
    purchaseUom !== baseUom &&
    !purchaseConversionFromCatalog;

  useEffect(() => {
    if (!purchaseConversionFromCatalog) return;
    if (form.getValues("purchase_uom_conversion") === purchaseConversionFromCatalog) return;
    setValue("purchase_uom_conversion", purchaseConversionFromCatalog, { shouldDirty: false });
  }, [purchaseConversionFromCatalog, form, setValue]);

  useEffect(() => {
    if (!useDifferentPurchaseUnit || purchaseUom === baseUom) return;
    const factor = conversionFactorForAlternate(alternateUoms ?? [], purchaseUom);
    if (!factor) return;
    if (form.getValues("purchase_uom_conversion") === factor) return;
    setValue("purchase_uom_conversion", factor, { shouldDirty: true });
  }, [alternateUoms, baseUom, form, purchaseUom, setValue, useDifferentPurchaseUnit]);

  const showStatus = !readOnly;

  // Resolve the nearest scrollable ancestor (the dashboard canvas) as the
  // IntersectionObserver root; falls back to the viewport.
  useLayoutEffect(() => {
    let el = formRef.current?.parentElement ?? null;
    while (el) {
      const overflowY = window.getComputedStyle(el).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        scrollRootRef.current = el;
        setScrollRoot(el);
        return;
      }
      el = el.parentElement;
    }
    scrollRootRef.current = null;
    setScrollRoot(null);
  }, []);

  // Scroll-spy: highlight the section whose top has most recently crossed the anchor line.
  useEffect(() => {
    const scrollRootEl = scrollRootRef.current;
    if (!scrollRootEl) return;

    const updateActive = () => {
      if (Date.now() < ignoreSpyUntilRef.current) return;

      const stickyNavHeight = isPanelLayout
        ? panelRailHorizontal
          ? (panelRailRef.current?.offsetHeight ?? 0)
          : 0
        : (chipBarRef.current?.offsetHeight ?? 0);
      const anchorLine = resolveScrollSpyAnchorLine(
        scrollRootEl,
        resolveEditorScrollSpyOffset(isPanelLayout, stickyNavHeight, panelRailHorizontal)
      );
      const nextActive = resolveActiveSectionByScrollPosition(
        SECTION_IDS,
        (id) => sectionRefs.current[id as SectionId] ?? null,
        anchorLine
      );

      if (nextActive) {
        setActiveSection(nextActive);
      }
    };

    updateActive();
    scrollRootEl.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);

    return () => {
      scrollRootEl.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [isPanelLayout, panelRailHorizontal, scrollRoot]);

  const scrollToSection = useCallback(
    (id: SectionId) => {
      ignoreSpyUntilRef.current = Date.now() + 900;
      setActiveSection(id);
      const el = sectionRefs.current[id];
      if (!el) return;

      const stickyNavHeight = isPanelLayout
        ? panelRailHorizontal
          ? (panelRailRef.current?.offsetHeight ?? 0)
          : 0
        : (chipBarRef.current?.offsetHeight ?? 0);
      scrollElementInDashboardRoot(el, {
        offsetTop: isPanelLayout ? 20 : 96,
        additionalOffset: stickyNavHeight > 0 ? stickyNavHeight + 8 : 0,
        scrollRootRef,
      });
    },
    [isPanelLayout, panelRailHorizontal]
  );

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
      units: false,
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
        case "units":
          return baseUom?.trim() ? "complete" : "empty";
        case "pricing":
          return Number(sellingPrice) > 0 || Number(purchasePrice) > 0 ? "complete" : "empty";
        case "inventory": {
          const hasShippingDims =
            Number(deadWeightKg) > 0 ||
            Number(shippingVolume) > 0 ||
            Number(lengthCm) > 0 ||
            Number(widthCm) > 0 ||
            Number(heightCm) > 0;
          return trackInventory || Number(standardCost) > 0 || hasShippingDims
            ? "complete"
            : "empty";
        }
        case "variants":
          return variants.length > 0 ? "complete" : "empty";
        case "media":
          return media.length > 0 ? "complete" : "empty";
        case "catalog": {
          const hasTags = Array.isArray(tagIds) && tagIds.length > 0;
          const hasCustom = Array.isArray(customFields) && customFields.length > 0;
          return hasTags || hasCustom ? "complete" : "empty";
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
      deadWeightKg,
      shippingVolume,
      lengthCm,
      widthCm,
      heightCm,
      variants.length,
      media.length,
      tagIds,
      customFields,
      alternateUoms,
      baseUom,
    ]
  );


  const primaryImageUrl = useMemo(
    () => (detail ? pickPrimaryImagePreviewUrl(detail.media, detail.variant_id) : null),
    [detail]
  );

  const displayName = name?.trim()
    ? name
    : mode === "create"
      ? "New item"
      : "Untitled item";

  const mobileChips = useMemo(
    () =>
      SECTIONS.map((section) => ({
        id: section.id,
        label: section.label,
        leading: showStatus ? <StatusDot status={sectionStatus(section.id)} /> : undefined,
      })),
    [sectionStatus, showStatus]
  );

  return (
    <EditorPanelContext.Provider value={isPanelLayout}>
    <form
      ref={formRef}
      onSubmit={handleSave}
      className={cn(
        "flex flex-col",
        isPanelLayout && "product-editor-panel gap-2",
        !isPanelLayout && "gap-4"
      )}
    >
      {/* Summary header — name/SKU live in the split-pane header when layout is panel */}
      {!isPanelLayout ? (
        <div className={editorCardClassName(false, "summary")}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-3">
              <ProductPrimaryImage imageUrl={primaryImageUrl} alt={displayName} />
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold sm:text-xl">{displayName}</h2>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {sku?.trim() ? sku : "—"}
                </p>
                {detail ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Created {formatDate(detail.created_at)} · Updated {formatDate(detail.updated_at)}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="active">{itemTypeLabel(itemType)}</Badge>
              {itemId ? (
                <Badge variant={isActive ? "completed" : "locked"}>
                  {itemOperationalStatusLabel(isActive)}
                </Badge>
              ) : null}
              <Badge variant="default">{variantStrategyLabel(variantStrategy)}</Badge>
              {needsReview ? <Badge variant="action_required">Needs review</Badge> : null}
            </div>
          </div>
        </div>
      ) : null}

      {!isPanelLayout ? (
        <SectionScrollChipBar
          barRef={chipBarRef}
          chips={mobileChips}
          activeId={activeSection}
          onSelect={(id) => scrollToSection(id as SectionId)}
        />
      ) : null}

      <div
        ref={panelLayoutRef}
        className={cn(
          isPanelLayout
            ? editorPanelLayoutGridClass(panelRailHorizontal)
            : "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6"
        )}
      >
        <EditorSectionRail
          activeSection={activeSection}
          onSelect={scrollToSection}
          showStatus={showStatus}
          sectionStatus={sectionStatus}
          compact={isPanelLayout}
          horizontal={panelRailHorizontal}
          railRef={panelRailRef}
        />

        {/* Continuous form */}
        <div className={cn("min-w-0", isPanelLayout ? "space-y-3" : "space-y-4")}>
          {isPanelLayout ? (
            <div className={editorPanelBadgesClass()}>
              <Badge variant="active">{itemTypeLabel(itemType)}</Badge>
              {itemId ? (
                <Badge variant={isActive ? "completed" : "locked"}>
                  {itemOperationalStatusLabel(isActive)}
                </Badge>
              ) : null}
              <Badge variant="default">{variantStrategyLabel(variantStrategy)}</Badge>
              {needsReview ? <Badge variant="action_required">Needs review</Badge> : null}
            </div>
          ) : null}
          <SectionBlock
            id="overview"
            title="Overview"
            description="What the item is, how it is classified, and how it is taxed."
            registerRef={registerSection("overview")}
            onNext={readOnly ? undefined : scrollToSection}
            panel={isPanelLayout}
          >
            {/* AI assist slot (wiring lands in the next phase) */}
            {!readOnly && (
              <div
                className={cn(
                  "mb-4 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/50 p-4 dark:border-indigo-500/30 dark:bg-indigo-950/20",
                  isPanelLayout && "mb-3 rounded-md border-indigo-200/50 p-3 dark:border-indigo-500/20"
                )}
              >
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
            )}

            {!readOnly && duplicates.length > 0 && (
              <div
                className={cn(
                  "mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30",
                  isPanelLayout && "mb-3 rounded-md px-3 py-2.5"
                )}
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Possible duplicate{duplicates.length > 1 ? "s" : ""}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {duplicates.map((match) => (
                    <li key={match.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-amber-800 dark:text-amber-300">
                        {match.name}
                        {match.code ? (
                          <span className="ml-1 font-mono text-xs text-amber-700/70 dark:text-amber-300/60">
                            {match.code}
                          </span>
                        ) : null}
                      </span>
                      <Link
                        href={`/inventory/items/${match.id}`}
                        prefetch
                        className="shrink-0 text-xs font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {needsReview && (
              <div
                className={cn(
                  "mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30",
                  isPanelLayout && "mb-3 rounded-md px-3 py-2.5"
                )}
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">Needs review</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                  This item was quick-created. Complete the details, then clear the flag.
                </p>
              </div>
            )}

            <div className={editorGridClass(isPanelLayout)}>
              <Field label="Item name" htmlFor="name" error={errors.name?.message} full>
                <Input id="name" disabled={disableInput("name")} {...register("name")} />
              </Field>

              <Field label="SKU" htmlFor="sku" error={errors.sku?.message}>
                <Input id="sku" disabled={disableInput("sku")} className="font-mono" {...register("sku")} />
              </Field>

              <Field label="Category">
                <Select
                  value={watch("category_id") ?? "none"}
                  disabled={disableInput("category_id")}
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
                  disabled={disableInput("description")}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm",
                    "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  )}
                  {...register("description")}
                />
              </Field>
            </div>

            <div className={editorSubsectionClass(isPanelLayout)}>
              <h4 className={cn("font-medium text-foreground", isPanelLayout ? "text-xs" : "text-sm")}>
                Type &amp; structure
              </h4>
              <div className={editorGridClass(isPanelLayout)}>
                <Field
                  label="Item type"
                  hint="Controls whether this item can hold inventory and variants."
                  locked={isLocked("item_type")}
                >
                  <Select
                    value={itemType}
                    disabled={disableInput("item_type", "item_type")}
                    onValueChange={(value) =>
                      setValue("item_type", value as ProductMasterFormValues["item_type"], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {ITEM_TYPES.map((value) => {
                        const choice = itemTypeChoice(value);
                        return (
                          <SelectItemWithDescription
                            key={value}
                            value={value}
                            label={choice?.label ?? itemTypeLabel(value)}
                            description={choice?.description ?? itemTypeDescription(value)}
                          />
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Field>

                {itemType === "SERVICE" ? (
                  <Field
                    label="Supply-chain role"
                    hint="Used for manufacturing and reporting; does not change stock rules."
                    locked={isLocked("classification")}
                  >
                    <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                      {classificationLabel("SERVICE")}
                    </p>
                  </Field>
                ) : (
                  <Field
                    label="Supply-chain role"
                    hint="Used for manufacturing and reporting; does not change stock rules."
                    locked={isLocked("classification")}
                  >
                    <Select
                      value={currentClassification}
                      disabled={disableInput("classification", "classification")}
                      onValueChange={(value) =>
                        setValue(
                          "classification",
                          value as ProductMasterFormValues["classification"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {classificationOptions.map((value) => {
                          const choice = classificationChoice(value);
                          return (
                            <SelectItemWithDescription
                              key={value}
                              value={value}
                              label={choice?.label ?? classificationLabel(value)}
                              description={
                                choice?.description ?? classificationDescription(value)
                              }
                            />
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                )}

                <Field
                  label="Variant"
                  full
                  info={
                    <div className="space-y-3 text-sm text-muted-foreground">
                      <p className="leading-relaxed">{VARIANT_STRATEGY_FIELD_INTRO}</p>
                      {VARIANT_STRATEGY_CHOICES.map((choice) => (
                        <div key={choice.value}>
                          <p className="font-medium text-foreground">{choice.label}</p>
                          <p className="mt-0.5 leading-relaxed">{choice.description}</p>
                        </div>
                      ))}
                    </div>
                  }
                >
                  {itemId || !isPhysical ? (
                    <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                      {variantStrategyLabel(variantStrategy)}
                    </p>
                  ) : (
                    <Select
                      value={variantStrategy}
                      disabled={disableInput("variant_strategy", "variant_strategy")}
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
                      <SelectContent position="popper" sideOffset={4}>
                        {VARIANT_STRATEGY_CHOICES.map((choice) => (
                          <SelectItemWithDescription
                            key={choice.value}
                            value={choice.value}
                            label={choice.label}
                            description={choice.description}
                          />
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
            </div>

            <div className={editorSubsectionClass(isPanelLayout)}>
              <h4 className={cn("font-medium text-foreground", isPanelLayout ? "text-xs" : "text-sm")}>
                Tax
              </h4>
              <div className={editorGridClass(isPanelLayout)}>
                <Field label="Tax category" full={!isTaxableCategory}>
                  <Select
                    value={defaultTaxCategory}
                    disabled={disableInput("default_tax_category")}
                    onValueChange={(value) => {
                      setValue(
                        "default_tax_category",
                        value as ProductMasterFormValues["default_tax_category"],
                        { shouldDirty: true }
                      );
                      if (!isTaxableSupplyCategory(value)) {
                        setValue("hsn_sac_code", "", { shouldDirty: true });
                        setValue("tax_code_id", null, { shouldDirty: true });
                      }
                    }}
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

                {isTaxableCategory ? (
                  <Field
                    label="Tax rule"
                    hint="Pick the full GST rate for this product (e.g. GST 18%). CGST/SGST vs IGST is applied on invoices from location and ship-to state."
                  >
                    <Select
                      value={taxCodeId ?? "none"}
                      disabled={disableInput("tax_code_id")}
                      onValueChange={(value) =>
                        setValue("tax_code_id", value === "none" ? null : value, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No tax rule" />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItem value="none" textValue="No tax rule">
                          <div className="flex flex-col gap-1 py-0.5">
                            <span className="font-medium leading-none">No tax rule</span>
                            <span className="text-xs leading-relaxed text-muted-foreground">
                              Taxable supply without a bound rate — assign a rule when HSN is known.
                            </span>
                          </div>
                        </SelectItem>
                        {itemTaxCodePickerOptions.map((code) => (
                          <SelectItemWithDescription
                            key={code.id}
                            value={code.id}
                            label={code.pickerLabel}
                            description={code.pickerDescription}
                          />
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                ) : null}

                {isTaxableCategory ? (
                  <Field label="HSN / SAC code" htmlFor="hsn_sac_code" full>
                    <Input
                      id="hsn_sac_code"
                      disabled={disableInput("hsn_sac_code")}
                      className="font-mono"
                      placeholder="e.g. 84713010"
                      {...register("hsn_sac_code")}
                    />
                  </Field>
                ) : null}

                {isTaxableCategory ? (
                  itemTaxCodePickerOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      No item tax rules yet. In Settings → Tax Settings, create full-rate rules
                      (e.g. GST 18%) — not separate CGST or SGST component rows.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      HSN / SAC is required for taxable supply. Do not use CGST-only or SGST-only
                      rules on items; those are invoice splits, not product rates.
                    </p>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    Tax rule and HSN / SAC apply only when the category is Taxable. Other categories
                    use supply treatment alone for compliance reporting.
                  </p>
                )}
              </div>
            </div>

            {itemId || needsReview ? (
              <div className={editorSubsectionClass(isPanelLayout)}>
                {itemId ? (
                  <h4 className={cn("font-medium text-foreground", isPanelLayout ? "text-xs" : "text-sm")}>
                    Status
                  </h4>
                ) : null}
                <div className={editorGridClass(isPanelLayout)}>
                  {itemId ? (
                    <ToggleRow
                      label="Active"
                      description="Inactive items are hidden from orders, purchasing, and other operational flows."
                      checked={isActive}
                      disabled={disableInput("is_active")}
                      onCheckedChange={(checked) => {
                        setValue("is_active", checked, { shouldDirty: true });
                        setValue("status", itemLifecycleStatusFromActive(checked), { shouldDirty: true });
                      }}
                    />
                  ) : null}
                  {needsReview ? (
                    <ToggleRow
                      label="Needs review"
                      description="Turn off once details are verified."
                      checked={needsReview}
                      disabled={disableInput("needs_review")}
                      onCheckedChange={(checked) =>
                        setValue("needs_review", checked, { shouldDirty: true })
                      }
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </SectionBlock>

          <SectionBlock
            id="units"
            title="Units of measure"
            description="Base unit, alternate units with conversion factors, and how they relate to pricing."
            registerRef={registerSection("units")}
            onNext={readOnly ? undefined : scrollToSection}
            panel={isPanelLayout}
          >
            <ProductUnitsSection
              catalogContext={catalogContext}
              baseUom={baseUom}
              alternateUoms={alternateUoms ?? []}
              isPhysical={isPhysical}
              stockUnitDisabled={disableInput("base_unit_of_measure", "base_unit_of_measure")}
              stockUnitLocked={isLocked("base_unit_of_measure")}
              alternatesDisabled={fieldDisabled}
              onBaseUomChange={(code) =>
                setValue("base_unit_of_measure", code, { shouldDirty: true })
              }
              onAlternateUomsChange={(rows) =>
                setValue("alternate_uoms", rows, { shouldDirty: true })
              }
            />
          </SectionBlock>

          <SectionBlock
            id="pricing"
            title="Pricing"
            description="Selling and purchase defaults, return policy, and price book entries."
            registerRef={registerSection("pricing")}
            onNext={readOnly ? undefined : scrollToSection}
            panel={isPanelLayout}
          >
            {pricingFieldsLocked ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Pricing fields are read-only for your role. Contact your workspace owner to request
                access.
              </p>
            ) : null}
            <div className={editorGridClass(isPanelLayout)}>
              <ToggleRow
                label="Salable"
                description="Allow quotes, orders, and storefront exposure."
                checked={isSalable}
                disabled={disableInput("is_salable")}
                onCheckedChange={(checked) => setValue("is_salable", checked, { shouldDirty: true })}
              />
              {isSalable ? (
                <>
                  <Field
                    label={`Selling rate (${catalogContext.base_currency})`}
                    htmlFor="selling_price"
                    error={errors.selling_price?.message}
                  >
                    <Input
                      id="selling_price"
                      disabled={disableInput("selling_price")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register("selling_price")}
                    />
                  </Field>

                  <DefaultUnitField
                    label="Default sales unit"
                    stockUom={baseUom}
                    value={sellingUom}
                    options={commerceUomOptions}
                    fieldDisabled={disableInput("selling_uom")}
                    useDifferent={useDifferentSellingUnit}
                    onUseDifferentChange={(checked) => {
                      setUseDifferentSellingUnit(checked);
                      if (!checked) {
                        setValue("selling_uom", baseUom, { shouldDirty: true });
                      }
                    }}
                    onUnitChange={(code) =>
                      setValue("selling_uom", code, { shouldDirty: true })
                    }
                  />

                  <ToggleRow
                    label="Returnable"
                    description="Allow this item to participate in return workflows."
                    checked={watch("is_returnable")}
                    disabled={disableInput("is_returnable")}
                    onCheckedChange={(checked) =>
                      setValue("is_returnable", checked, { shouldDirty: true })
                    }
                  />
                </>
              ) : null}

              <ToggleRow
                label="Purchasable"
                description="Allow procurement and purchase orders for this item."
                checked={isPurchasable}
                disabled={disableInput("is_purchasable")}
                onCheckedChange={(checked) =>
                  setValue("is_purchasable", checked, { shouldDirty: true })
                }
              />
              {isPurchasable ? (
                <>
                  <Field
                    label="Preferred supplier"
                    hint="Optional. Required only to store a default purchase rate on a supplier record."
                    error={errors.supplier_id?.message}
                  >
                    <Select
                      value={watch("supplier_id") ?? "none"}
                      disabled={disableInput("supplier_id")}
                      onValueChange={(value) =>
                        setValue("supplier_id", value === "none" ? null : value, {
                          shouldDirty: true,
                        })
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
                      disabled={disableInput("purchase_price")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...register("purchase_price")}
                    />
                  </Field>

                  <DefaultUnitField
                    label="Default purchase unit"
                    stockUom={baseUom}
                    value={purchaseUom}
                    options={purchaseCommerceUomOptions}
                    fieldDisabled={disableInput("purchase_uom")}
                    useDifferent={useDifferentPurchaseUnit}
                    onUseDifferentChange={(checked) => {
                      setUseDifferentPurchaseUnit(checked);
                      if (!checked) {
                        setValue("purchase_uom", baseUom, { shouldDirty: true });
                        setValue("purchase_uom_conversion", "1", { shouldDirty: true });
                      }
                    }}
                    onUnitChange={(code) => {
                      setValue("purchase_uom", code, { shouldDirty: true });
                      if (code === baseUom) {
                        setValue("purchase_uom_conversion", "1", { shouldDirty: true });
                        return;
                      }
                      const factor = conversionFactorForAlternate(alternateUoms ?? [], code);
                      if (factor) {
                        setValue("purchase_uom_conversion", factor, { shouldDirty: true });
                      }
                    }}
                    conversionHint={
                      purchaseConversionFromCatalog
                        ? `Uses ${purchaseConversionFromCatalog} ${baseUom} per ${purchaseUom} from alternate units.`
                        : undefined
                    }
                  />

                  {purchaseConversionFromCatalog && useDifferentPurchaseUnit && purchaseUom !== baseUom ? (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Conversion factor ({purchaseConversionFromCatalog} {baseUom} per {purchaseUom}) is
                      defined under Units of measure.
                    </p>
                  ) : null}

                  {showPurchaseConversionField ? (
                    <Field
                      label="Purchase conversion factor"
                      htmlFor="purchase_uom_conversion"
                      error={errors.purchase_uom_conversion?.message}
                      hint={`How many ${baseUom} equal one ${purchaseUom}. Add this unit under Units of measure to manage one factor in a single place.`}
                    >
                      <Input
                        id="purchase_uom_conversion"
                        disabled={disableInput("purchase_uom_conversion")}
                        className="text-right font-mono"
                        inputMode="decimal"
                        placeholder="1"
                        {...register("purchase_uom_conversion")}
                      />
                    </Field>
                  ) : null}
                </>
              ) : null}

            </div>

            {itemId && isSalable ? (
              <div className={editorSubsectionClass(isPanelLayout)}>
                {!isPanelLayout ? (
                  <h4 className="text-sm font-medium">Price book entries</h4>
                ) : null}
                <PriceBookEntryEditor
                  itemId={itemId}
                  variants={variants}
                  uomCodes={priceBookUomCodes}
                  readOnly={readOnly || disableInput("selling_price")}
                />
              </div>
            ) : null}
          </SectionBlock>

          <SectionBlock
            id="inventory"
            title="Inventory & Costing"
            description="Stock tracking, valuation, and product identifiers."
            registerRef={registerSection("inventory")}
            onNext={readOnly ? undefined : scrollToSection}
            panel={isPanelLayout}
          >
            <div className={editorGridClass(isPanelLayout)}>
              {isPhysical ? (
                <ToggleRow
                  label="Track inventory"
                  description={
                    isLocked("track_inventory")
                      ? "Locked — transactions exist for this item."
                      : "Maintain stock balances and ledger movements."
                  }
                  checked={trackInventory}
                  disabled={disableInput("track_inventory", "track_inventory")}
                  onCheckedChange={(checked) => setValue("track_inventory", checked, { shouldDirty: true })}
                />
              ) : (
                <p className={editorEmptyStateClass(isPanelLayout, "sm:col-span-2")}>
                  {itemTypeLabel(itemType)} items do not hold stock.
                </p>
              )}

              {isPhysical && !trackInventory ? (
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  Turn on Track inventory to configure costing, lot/serial tracking, bundles, and
                  stock valuation.
                </p>
              ) : null}

              {isPhysical && trackInventory && (
                <Field label="Costing method">
                  <Select
                    value={costingMethod}
                    disabled={disableInput("costing_method")}
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
                    disabled={disableInput("standard_cost")}
                    className="text-right font-mono"
                    inputMode="decimal"
                    placeholder="0.00"
                    {...register("standard_cost")}
                  />
                </Field>
              )}

              {isPhysical && trackInventory && (
                <Field label="Batch / serial tracking" locked={isLocked("tracking_mode")}>
                  <Select
                    value={trackingMode}
                    disabled={disableInput("tracking_mode", "tracking_mode")}
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
                  <Input id="barcode" disabled={disableInput("barcode")} className="font-mono" {...register("barcode")} />
                </Field>
              )}

              {isPhysical && trackInventory ? (
                <Field label="Inventory valuation method" full>
                  <div className={editorReadOnlyFieldClass(isPanelLayout)}>
                    {catalogContext.inventory_valuation_method}{" "}
                    <span className="text-muted-foreground">
                      (runtime engine: {catalogContext.runtime_valuation_engine})
                    </span>
                  </div>
                </Field>
              ) : null}

              {isPhysical && trackInventory ? (
                <ToggleRow
                  label="Bundle / kit"
                  description="Fulfilled from a bill of materials rather than its own stock."
                  checked={watch("is_bundle")}
                  disabled={disableInput("is_bundle")}
                  onCheckedChange={(checked) =>
                    setValue("is_bundle", checked, { shouldDirty: true })
                  }
                />
              ) : null}
            </div>

            {isPhysical && isMultiSku ? (
              <div className={editorSubsectionClass(isPanelLayout)}>
                <h4 className="text-sm font-medium">Shipping & dimensions</h4>
                <p className={editorEmptyStateClass(isPanelLayout)}>
                  Configure weight and carton size on each variant in the Variants section.
                </p>
              </div>
            ) : null}

            {isPhysical && !isMultiSku ? (
              <div className={editorSubsectionClass(isPanelLayout)}>
                <h4 className="text-sm font-medium">Shipping & dimensions</h4>
                <p className="text-xs text-muted-foreground">
                  Used for freight quotes and packaging — not tied to stock tracking.
                </p>
                <div className={cn(editorGridClass(isPanelLayout), "mt-3")}>
                  <Field
                    label="Weight (kg)"
                    htmlFor="dead_weight_kg"
                    error={errors.dead_weight_kg?.message}
                    full
                  >
                    <Input
                      id="dead_weight_kg"
                      disabled={disableInput("dead_weight_kg")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("dead_weight_kg")}
                    />
                  </Field>
                  <Field label="Volume" htmlFor="volume" error={errors.volume?.message}>
                    <Input
                      id="volume"
                      disabled={disableInput("volume")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      placeholder="Optional"
                      {...register("volume")}
                    />
                  </Field>
                  <Field label="Length (cm)" htmlFor="length_cm" error={errors.length_cm?.message}>
                    <Input
                      id="length_cm"
                      disabled={disableInput("length_cm")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("length_cm")}
                    />
                  </Field>
                  <Field label="Width (cm)" htmlFor="width_cm" error={errors.width_cm?.message}>
                    <Input
                      id="width_cm"
                      disabled={disableInput("width_cm")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("width_cm")}
                    />
                  </Field>
                  <Field label="Height (cm)" htmlFor="height_cm" error={errors.height_cm?.message}>
                    <Input
                      id="height_cm"
                      disabled={disableInput("height_cm")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("height_cm")}
                    />
                  </Field>
                </div>
              </div>
            ) : null}

            {trackInventory && valuations.length > 0 && (
              <div className={editorSubsectionClass(isPanelLayout)}>
                <h4 className="text-sm font-medium">Live inventory valuation (read-only)</h4>
                <div className={editorInsetTableWrapClass(isPanelLayout)}>
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
            onNext={readOnly ? undefined : scrollToSection}
            panel={isPanelLayout}
          >
            {itemId ? (
              <div className={cn(isPanelLayout ? "space-y-4" : "space-y-6")}>
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
                {variants.length > 0 && (
                  <VariantAssortmentMatrix itemId={itemId} variants={variants} readOnly={readOnly} />
                )}
                {variants.length > 0 && (
                  <VariantChannelAvailabilityMatrix
                    itemId={itemId}
                    variants={variants}
                    readOnly={readOnly}
                  />
                )}
              </div>
            ) : (
              <p className={editorEmptyStateClass(isPanelLayout)}>
                Save the item first to manage variants.
              </p>
            )}
          </SectionBlock>

          <SectionBlock
            id="media"
            title="Media"
            description="Images shown across storefront, catalog, and documents."
            registerRef={registerSection("media")}
            onNext={readOnly ? undefined : scrollToSection}
            panel={isPanelLayout}
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
              <p className={editorEmptyStateClass(isPanelLayout)}>
                Save the item first to upload images.
              </p>
            )}
          </SectionBlock>

          <SectionBlock
            id="catalog"
            title="Catalog & Tags"
            description="SKU mask, custom fields, tags, and storefront visibility."
            registerRef={registerSection("catalog")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              showSkuMask={isMultiSku}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              categoryTemplates={categoryTemplates}
              disabled={fieldDisabled}
              values={{
                sku_mask: skuMask,
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
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
                }
              }}
            />
          </SectionBlock>
        </div>
      </div>

      {/* Sticky action bar — reachable on every device */}
      {!readOnly && (
        <div
          className={cn(
            "sticky bottom-0 z-10 flex items-center justify-end gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            isPanelLayout
              ? "-mx-4 border-t border-border/60 px-4 py-2"
              : "border-t border-border py-3"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            disabled={isPending || isNavigatePending}
            onClick={onCancel}
          >
            {isNavigatePending ? "Leaving…" : "Cancel"}
          </Button>
          <Button type="submit" disabled={isPending || isNavigatePending} title="Save (Cmd/Ctrl + Enter)">
            {isPending ? "Saving…" : "Save item"}
          </Button>
        </div>
      )}
    </form>
    </EditorPanelContext.Provider>
  );
}
