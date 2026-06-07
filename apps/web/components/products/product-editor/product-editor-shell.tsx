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
  Layers,
  ListTree,
  Lock,
  Package,
  Plus,
  ShoppingCart,
  Tag,
  Tags,
  Wallet,
  Warehouse,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  findSimilarItems,
  type SimilarItem,
  type VariantAssortmentCell,
} from "@/app/items/actions";
import { ProductCatalogExtensions } from "@/components/products/product-catalog-extensions";
import { PanelMutationPrimaryButton } from "@/components/products/panel-mutation-primary-button";
import {
  ProductBaseUnitField,
  ProductUnitsSection,
} from "@/components/products/product-units-section";
import { ProductMediaGallery } from "@/components/products/product-media-gallery";
import { ProductPrimaryImage } from "@/components/products/product-primary-image";
import { ProductVariantPanel } from "@/components/products/product-variant-panel";
import type {
  VariantMatrixCommitResult,
  VariantMatrixDraftState,
} from "@/components/products/variant-matrix-generator";
import type { CompositionCommitResult } from "@/components/products/product-editor/composition-editor";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import type { ProductPanelMutationHeader } from "@/components/products/product-panel-form";
import { ItemExtensionDataProvider } from "@/components/products/item-extension-data-provider";
import {
  VariantAssortmentMatrix,
  type ReachPersistFailures,
  type VariantAssortmentMatrixHandle,
} from "@/components/products/variant-assortment-matrix";
import {
  VariantOpeningStockMatrix,
  type VariantOpeningStockMatrixHandle,
} from "@/components/products/variant-opening-stock-matrix";
import { PriceBookEntryEditor } from "@/components/products/price-book-entry-editor";
import { SupplierCatalogEditor } from "@/components/products/supplier-catalog-editor";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldLabelInfo,
  fieldHelpText,
  mergeFieldLabelInfo,
  SubsectionHeading,
} from "@/components/ui/field-label-info";
import {
  ITEM_EDITOR_FIELD_HELP,
  ITEM_EDITOR_TOGGLE_HELP,
  VariantStrategyFieldHelp,
} from "@/lib/products/item-editor-field-help";
import {
  VARIANT_STRATEGY_FIELD_LABEL,
  VARIANTS_SECTION_LABEL,
  VARIANTS_SECTION_SHORT_LABEL,
  MRP_PRICE_COLUMN,
  CATALOG_REACH_DISTRIBUTION_LOADING,
  CUSTOM_FIELDS_SECTION_HELP,
  CUSTOM_FIELDS_SECTION_LABEL,
  DISCOVERY_TAGS_SECTION_HELP,
  DISCOVERY_TAGS_SECTION_LABEL,
  CATEGORY_FIELDS_SECTION_HELP,
  CATEGORY_FIELDS_SECTION_LABEL,
  categoryFieldsSectionTitle,
  VISIBILITY_LOCATIONS_HELP,
  VISIBILITY_LOCATIONS_SUBSECTION,
  VISIBILITY_OPENING_STOCK_HELP,
  VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED,
  VISIBILITY_OPENING_STOCK_SUBSECTION,
  VISIBILITY_SECTION_HELP,
  VISIBILITY_SECTION_LABEL,
  SAVE_ITEM_LABEL,
  UPDATE_ITEM_LABEL,
} from "@/lib/products/product-user-labels";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  COMPOSITION_FIELD_LABEL,
  COMPOSITION_SECTION_LABEL,
  itemTypeSupportsComposition,
} from "@/lib/products/composition";
import { ProductCompositionSection } from "@/components/products/product-editor/product-composition-section";
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
  computeVolumeCm3FromDimensions,
  formatCalculatedVolumeInfo,
} from "@/lib/products/shipping-dimensions";
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
import { gtinFieldHint, skuFieldHint } from "@/lib/products/catalog-item-settings";
import {
  VARIANT_STRATEGY_CHOICES,
  canSelectSingleVariantStrategy,
  variantStrategyLabel,
} from "@/lib/products/variant-strategy";
import {
  defaultVariantAxisKeys,
  pickDescriptiveVariantAttributes,
  sanitizeVariantAxisKeys,
  splitTemplatesByAxis,
  usedVariantAttributeKeys,
} from "@/lib/products/variant-composition";
import {
  useProductForm,
  type ProductFormMode,
} from "@/lib/products/use-product-form";
import { detailToFormValues } from "@/lib/products/types";
import type {
  ProductCatalogContext,
  ProductDetailSnapshot,
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductValuationSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
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
  editorDeferredActionClass,
  editorDimensionsLwhGridClass,
  editorFieldSpanFullClass,
  editorGridClass,
  editorInsetTableWrapClass,
  editorPageSectionClass,
  editorPanelSectionClass,
  editorSectionBodyClass,
  editorPanelSectionRailClass,
  editorPanelSectionRailStickyClass,
  editorReadOnlyFieldClass,
  editorSectionHeadingClass,
  editorSubsectionClass,
  editorSubsectionHeadingClass,
  editorCatalogBlockClass,
  editorSwitchSize,
  editorPanelLayoutGridClass,
  editorPanelWizardLayoutGridClass,
  editorPageWizardLayoutGridClass,
  editorPanelWizardBleedClass,
  editorPanelWizardScrollClass,
  editorPanelWizardFormScrollClass,
  editorWizardTopBarClass,
  editorWizardLeftRailAsideClass,
  editorWizardLeftRailInnerClass,
  editorWizardLeftRailStickyClass,
  editorPanelBadgesClass,
  editorPanelScrollMarginClass,
  editorPanelDividerClass,
  editorSectionDisclosureButtonClass,
  editorSectionDisclosureLineClass,
  editorSectionDisclosureRowClass,
  editorPanelSectionStackClass,
  PRODUCT_EDITOR_FORM_CLASS,
  EDITOR_PANEL_TOP_TABS_VIEWPORT_MEDIA,
  resolveEditorPanelUseTopTabs,
  resolveWizardUseLeftRail,
  EditorPanelContext,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import { useViewportMatches } from "@/lib/layout/use-viewport-matches";
import { useRightDrawerLayout } from "@/components/ui/right-drawer";
import {
  EDITOR_SECTIONS_HIDDEN_WHILE_CREATING,
  editorSectionIdsForItem,
  type EditorSectionId,
} from "@/lib/products/editor-sections";
import {
  EDITOR_STAGES,
  editorStageById,
  stageForSection,
  type EditorStageId,
} from "@/lib/products/editor-stages";
import { EditorStageAccordionHeader } from "@/components/products/product-editor/editor-stage-accordion-header";
import type { WizardNav } from "@/lib/products/use-product-create-wizard";
import {
  overallCompletenessPercent,
  rollUpStageStatus,
  type StageStatus,
} from "@/lib/products/item-completeness";
import { EditorStepper } from "@/components/products/product-editor/editor-stepper";
import { cn } from "@/lib/utils";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";
import { useMountedEditorSections } from "@/lib/products/use-mounted-editor-sections";

type SectionId = EditorSectionId;
type SectionStatus = "error" | "complete" | "empty";

const SECTIONS: Array<{
  id: SectionId;
  label: string;
  shortLabel: string;
  icon: typeof Package;
}> = [
  { id: "overview", label: "Basics", shortLabel: "Basics", icon: Package },
  { id: "salable", label: "Salable", shortLabel: "Salable", icon: Wallet },
  { id: "purchasable", label: "Purchasable", shortLabel: "Purchasable", icon: ShoppingCart },
  { id: "inventory", label: "Track inventory", shortLabel: "Inventory", icon: Warehouse },
  { id: "variants", label: VARIANTS_SECTION_LABEL, shortLabel: VARIANTS_SECTION_SHORT_LABEL, icon: Layers },
  { id: "composition", label: COMPOSITION_SECTION_LABEL, shortLabel: "Set", icon: Boxes },
  { id: "media", label: "Media", shortLabel: "Media", icon: ListTree },
  {
    id: "product_attributes",
    label: CATEGORY_FIELDS_SECTION_LABEL,
    shortLabel: "Category",
    icon: Package,
  },
  {
    id: "custom_fields",
    label: CUSTOM_FIELDS_SECTION_LABEL,
    shortLabel: "Fields",
    icon: Tag,
  },
  {
    id: "tags",
    label: DISCOVERY_TAGS_SECTION_LABEL,
    shortLabel: "Tags",
    icon: Tags,
  },
  {
    id: "visibility",
    label: VISIBILITY_SECTION_LABEL,
    shortLabel: "Visibility",
    icon: Store,
  },
];

const SECTION_IDS = SECTIONS.map((section) => section.id);

function editorSections(
  itemId: string | null | undefined,
  hasComposition: boolean
) {
  const ids = new Set(editorSectionIdsForItem(itemId, { hasComposition }));
  return SECTIONS.filter((section) => ids.has(section.id));
}

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
  selling_price: "salable",
  mrp: "salable",
  selling_uom: "salable",
  purchase_uom: "purchasable",
  purchase_uom_conversion: "purchasable",
  purchase_price: "purchasable",
  supplier_id: "purchasable",
  hsn_sac_code: "overview",
  tax_code_id: "overview",
  default_tax_category: "overview",
  is_returnable: "salable",
  is_bundle: "overview",
  reorder_point: "inventory",
  standard_cost: "inventory",
  barcode: "overview",
  dead_weight_kg: "overview",
  volume: "overview",
  length_cm: "overview",
  width_cm: "overview",
  height_cm: "overview",
  custom_fields: "custom_fields",
  alternate_uoms: "overview",
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
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  isNavigatePending?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Drawer header: Cancel / Save (panel layout edit and create wizard). */
  onMutationHeaderChange?: (header: ProductPanelMutationHeader | null) => void;
  /**
   * When present, the editor renders as a guided create wizard: only the active
   * stage's sections show, the rail is replaced by a stepper + completeness
   * indicator, and stage navigation lives in the drawer header (panel) or
   * sticky footer (full page). Omit for the normal sectioned editor.
   */
  wizard?: EditorWizardChrome;
  /**
   * When true, hides the section navigation (chip bar + side rail) so all
   * sections scroll continuously in a single column. Used for the "minimal form"
   * read-only view in the peek drawer.
   */
  hideNav?: boolean;
  /**
   * When set, only the listed sections are rendered (others are hidden). Nav is
   * automatically hidden. Used for the "minimal edit" drawer layout so the user
   * sees only the essential fields.
   */
  pinnedSections?: EditorSectionId[];
};

export type WizardLayout = "steps" | "accordion";

export type EditorWizardChrome = {
  layout?: WizardLayout;
  stage: EditorStageId;
  isFirst: boolean;
  isLast: boolean;
  /** Save then go to the previous stage. */
  onBack: () => void;
  /** Save then leave the wizard (finish later). */
  onSkip: () => void;
  /** Save then advance (or finish on the last stage). */
  onPrimary: () => void;
  /** Save then jump to an already-reachable stage (stepper clicks). */
  onSelectStage: (stage: EditorStageId) => void;
  /** Receives the form's submit trigger so navigation can save first. */
  registerSubmit: (fn: (nav: WizardNav) => void) => void;
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
  sections,
  activeSection,
  onSelect,
  showStatus,
  sectionStatus,
  compact = false,
  horizontal = false,
  railRef,
}: {
  sections: typeof SECTIONS;
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
        {sections.map((section) => {
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
  const labelInfo = mergeFieldLabelInfo(
    hint && !error ? <p>{hint}</p> : null,
    locked && !error ? <p>{ITEM_EDITOR_FIELD_HELP.lockedField}</p> : null,
    info
  );

  return (
    <div
      className={cn(
        "min-w-0",
        panel ? "space-y-1.5" : "space-y-2",
        full && editorFieldSpanFullClass(panel)
      )}
    >
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={htmlFor}
          className={cn("font-medium text-muted-foreground", panel ? "text-xs" : "text-sm")}
        >
          {label}
        </Label>
        {labelInfo ? <FieldLabelInfo label={label}>{labelInfo}</FieldLabelInfo> : null}
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
            <Lock className="h-2.5 w-2.5" aria-hidden />
            Locked
          </span>
        ) : null}
      </div>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function CommerceUnitField({
  label,
  stockUom,
  value,
  options,
  fieldDisabled,
  onUnitChange,
  conversionHint,
  info,
}: {
  label: string;
  stockUom: string;
  value: string;
  options: UomOption[];
  fieldDisabled: boolean;
  onUnitChange: (code: string) => void;
  conversionHint?: string;
  info?: React.ReactNode;
}) {
  const selectId = `${label.replace(/\s+/g, "-").toLowerCase()}-uom`;
  const usesAlternate = value !== stockUom;

  return (
    <Field
      label={label}
      hint={
        usesAlternate ? conversionHint : ITEM_EDITOR_FIELD_HELP.usingBaseUnit(stockUom)
      }
      info={info}
    >
      <Select value={value} disabled={fieldDisabled} onValueChange={onUnitChange}>
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
    </Field>
  );
}

function ToggleRow({
  label,
  description,
  info,
  checked,
  disabled,
  onCheckedChange,
  variant = "grid",
}: {
  label: string;
  description?: string;
  info?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** `inline` = compact row for panel header; `grid` = full-width field in form grids. */
  variant?: "grid" | "inline";
}) {
  const panel = useEditorPanelLayout();
  const inline = variant === "inline";
  const labelInfo = mergeFieldLabelInfo(
    description && !panel && !inline ? <p>{description}</p> : null,
    info
  );

  return (
    <div
      className={cn(
        "editor-toggle-row flex items-center justify-between gap-2",
        !inline && panel && editorFieldSpanFullClass(panel),
        inline && "shrink-0 gap-2.5 py-0",
        !inline && panel && "py-0.5",
        !inline && !panel && "rounded-lg border border-border px-3 py-2"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 pr-2">
        <p className={cn("font-medium leading-snug", panel ? "text-xs" : "text-sm")}>{label}</p>
        {labelInfo ? <FieldLabelInfo label={label}>{labelInfo}</FieldLabelInfo> : null}
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

function EditorSectionAdvanced({
  open,
  onToggle,
  panel,
  children,
  variant = "advanced",
}: {
  open: boolean;
  onToggle: () => void;
  panel: boolean;
  children: React.ReactNode;
  variant?: "advanced" | "more";
}) {
  const showLabel = variant === "more" ? "Show more" : "Show advanced";
  const hideLabel = variant === "more" ? "Hide more" : "Hide advanced";

  return (
    <div className={cn("col-span-full", panel ? "space-y-2" : "space-y-3")}>
      <div className={editorSectionDisclosureRowClass()}>
        <div className={editorSectionDisclosureLineClass()} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={editorSectionDisclosureButtonClass(panel)}
          onClick={onToggle}
        >
          {open ? hideLabel : showLabel}
        </Button>
      </div>
      {open ? (
        <div
          className={cn(
            variant === "more"
              ? panel
                ? "flex flex-col gap-6"
                : "flex flex-col gap-8"
              : panel
                ? "space-y-4"
                : "space-y-5"
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type SectionHeaderToggleProps = {
  label: string;
  description?: string;
  info?: React.ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Switch in the section title band (section name is the visible label). */
function SectionHeaderToggle({
  label,
  checked,
  disabled,
  onCheckedChange,
}: Pick<SectionHeaderToggleProps, "label" | "checked" | "disabled" | "onCheckedChange">) {
  return (
    <Switch
      size={editorSwitchSize}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
    />
  );
}

/** Anchored section card; registers its element with the parent scroll-spy. */
function SectionBlock({
  id,
  title,
  description,
  headerToggle,
  registerRef,
  panel = false,
  hidden = false,
  hideTitle = false,
  children,
}: {
  id: SectionId;
  title: string;
  description?: string;
  headerToggle?: SectionHeaderToggleProps;
  registerRef: (el: HTMLDivElement | null) => void;
  panel?: boolean;
  /** When true (wizard mode, off-stage), the section is not rendered. */
  hidden?: boolean;
  /** Omit the title band (e.g. wizard stage stepper already names the step). */
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  const titleInfo = headerToggle
    ? mergeFieldLabelInfo(
        headerToggle.description ? <p>{headerToggle.description}</p> : null,
        headerToggle.info
      )
    : null;

  return (
    <div
      ref={registerRef}
      data-section={id}
      className={cn("scroll-mt-20", panel && editorPanelScrollMarginClass())}
    >
      <section className={editorCardClassName(panel, "section")}>
        {!hideTitle ? (
          <div className={editorSectionHeadingClass(panel)}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h3
                    className={cn(
                      "font-semibold",
                      panel
                        ? "text-sm text-foreground"
                        : "text-sm uppercase tracking-wide text-foreground"
                    )}
                  >
                    {title}
                  </h3>
                  {titleInfo ? <FieldLabelInfo label={title}>{titleInfo}</FieldLabelInfo> : null}
                </div>
                {description && !panel ? (
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {headerToggle ? (
                <SectionHeaderToggle
                  label={headerToggle.label}
                  checked={headerToggle.checked}
                  disabled={headerToggle.disabled}
                  onCheckedChange={headerToggle.onCheckedChange}
                />
              ) : null}
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            editorSectionBodyClass(panel),
            hideTitle && panel && "!pt-0"
          )}
        >
          {children}
        </div>
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
  onVariantPatch,
  onVariantsReload,
  isNavigatePending = false,
  onPendingChange,
  onDirtyChange,
  onMutationHeaderChange,
  wizard,
  hideNav = false,
  pinnedSections,
}: Props) {
  // When pinnedSections is provided, nav is always hidden.
  const effectiveHideNav = hideNav || !!pinnedSections;
  const wizardAccordion = wizard?.layout === "accordion";
  const wizardSteps = Boolean(wizard && !wizardAccordion);
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [expandedStage, setExpandedStage] = useState<EditorStageId>("essentials");
  const activeWizardStage: EditorStageId | null = wizardAccordion
    ? expandedStage
    : wizard?.stage ?? null;
  const stageHeaderRefs = useRef<Partial<Record<EditorStageId, HTMLDivElement>>>({});
  const isSectionMounted = useMountedEditorSections(activeSection, {
    wizardStage: activeWizardStage,
  });
  const [tagOptions, setTagOptions] = useState(catalogContext.tags);
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);
  const [duplicates, setDuplicates] = useState<SimilarItem[]>([]);

  const lockedSet = useMemo(() => new Set(lockedFields), [lockedFields]);
  const isLocked = useCallback((field: string) => lockedSet.has(field), [lockedSet]);
  const isPanelLayout = layout === "panel";
  const { ref: panelLayoutRef, width: panelPaneWidth } = useElementWidth<HTMLDivElement>();
  const drawerLayout = useRightDrawerLayout();
  const compactDrawerViewport = useViewportMatches(EDITOR_PANEL_TOP_TABS_VIEWPORT_MEDIA);
  const panelUseTopSectionTabs =
    isPanelLayout && !wizard && resolveEditorPanelUseTopTabs(panelPaneWidth, compactDrawerViewport);
  const panelRailHorizontal = panelUseTopSectionTabs;
  const wizardDrawerWidthVw =
    drawerLayout?.isPartialDrawer === true ? drawerLayout.widthVw : undefined;
  const wizardUseLeftRail = Boolean(
    wizard &&
      resolveWizardUseLeftRail(
        isPanelLayout,
        panelPaneWidth,
        compactDrawerViewport,
        wizardDrawerWidthVw
      )
  );

  const formRef = useRef<HTMLFormElement | null>(null);
  const locationMatrixRef = useRef<VariantAssortmentMatrixHandle>(null);
  const openingStockMatrixRef = useRef<VariantOpeningStockMatrixHandle>(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const panelRailRef = useRef<HTMLElement | null>(null);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLDivElement | null>>>({});
  const ignoreSpyUntilRef = useRef(0);
  const onSavedParentRef = useRef(onSaved);
  onSavedParentRef.current = onSaved;
  const [reachSaveErrors, setReachSaveErrors] = useState<ReachPersistFailures | null>(null);
  const [draftAssortmentCells, setDraftAssortmentCells] = useState<
    VariantAssortmentCell[] | null
  >(null);
  const itemSavedHandlerRef = useRef<
    (savedId: string, savedDetail?: ProductDetailSnapshot | null) => Promise<boolean>
  >(async (savedId, savedDetail) => {
    onSavedParentRef.current?.(savedId, savedDetail ?? null);
    return true;
  });
  const scrollToSectionRef = useRef<(id: SectionId) => void>(() => {});
  const handleItemSaved = useCallback(
    async (savedId: string, savedDetail?: ProductDetailSnapshot | null) =>
      itemSavedHandlerRef.current(savedId, savedDetail),
    []
  );

  const itemSaveLabel = mode === "edit" ? UPDATE_ITEM_LABEL : SAVE_ITEM_LABEL;

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
  } = useProductForm({
    categories,
    catalogContext,
    initialValues,
    mode,
    onSaved: handleItemSaved,
    onPendingChange,
    refreshOnSave: !wizard,
    hydrateOnInitialValuesChange: Boolean(wizard),
  });

  const loadExtensionData =
    Boolean(itemId) &&
    (isSectionMounted("salable") ||
      isSectionMounted("purchasable") ||
      isSectionMounted("variants") ||
      isSectionMounted("visibility"));

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
    getValues,
    formState: { errors, isDirty },
  } = form;

  const name = watch("name");
  const sku = watch("sku");
  const isActive = watch("is_active");
  const trackInventory = watch("track_inventory");
  const defaultReorderPoint = watch("reorder_point");
  const costingMethod = watch("costing_method");
  const trackingMode = watch("tracking_mode");
  const variantAttributes = watch("variant_attributes");
  const skuMask = watch("sku_mask");
  const customFields = watch("custom_fields");
  const alternateUoms = watch("alternate_uoms");
  const tagIds = watch("tag_ids");
  const storefrontVisibility = watch("storefront_visibility");
  const hasListedChannels = useMemo(
    () =>
      Array.isArray(storefrontVisibility) &&
      storefrontVisibility.some((entry) => entry.is_visible),
    [storefrontVisibility]
  );
  const needsReview = watch("needs_review");
  const isSalable = watch("is_salable");
  const isBundle = watch("is_bundle");
  const defaultTaxCategory = watch("default_tax_category");
  const taxCodeId = watch("tax_code_id");
  const isTaxableCategory = isTaxableSupplyCategory(defaultTaxCategory);
  const isPurchasable = watch("is_purchasable");
  const sellingPrice = watch("selling_price");
  const purchasePrice = watch("purchase_price");
  const standardCost = watch("standard_cost");
  const hsnSacCode = watch("hsn_sac_code");
  const supplierId = watch("supplier_id");
  const mrp = watch("mrp");
  const matrixMrpDefault = useMemo(() => mrp?.trim() ?? "", [mrp]);
  const deadWeightKg = watch("dead_weight_kg");
  const shippingVolume = watch("volume");
  const lengthCm = watch("length_cm");
  const widthCm = watch("width_cm");
  const heightCm = watch("height_cm");

  const categoryId = watch("category_id");
  const currentClassification = watch("classification");
  const categoryName = useMemo(
    () => categories.find((category) => category.id === categoryId)?.name ?? null,
    [categories, categoryId]
  );
  const categoryFieldsTitle = useMemo(
    () => categoryFieldsSectionTitle(categoryName),
    [categoryName]
  );

  const showVariantsSection = isMultiSku || variants.length > 1;
  const hasComposition = isBundle;
  const visibleSections = useMemo(
    () =>
      editorSections(itemId, hasComposition)
        .filter((section) => {
          if (section.id === "variants" && !showVariantsSection) return false;
          if (section.id === "composition" && !hasComposition) return false;
          if (section.id === "inventory" && !isPhysical) return false;
          return true;
        })
        .map((section) =>
          section.id === "product_attributes"
            ? {
                ...section,
                label: categoryFieldsTitle,
                shortLabel: categoryName?.trim() || section.shortLabel,
              }
            : section
        ),
    [itemId, hasComposition, showVariantsSection, isPhysical, categoryFieldsTitle, categoryName]
  );
  const visibleSectionIds = useMemo(
    () => visibleSections.map((section) => section.id),
    [visibleSections]
  );

  // Which category attributes compose this item's variants. The category
  // suggests a default (its role hint, choice-typed attrs, or whatever existing
  // variants use); the author's explicit choice is persisted on the item.
  const sellableVariantCount = useMemo(
    () => variants.filter((variant) => variant.is_sellable !== false).length,
    [variants]
  );
  const canSelectSingleSku = canSelectSingleVariantStrategy(sellableVariantCount);

  const usedVariantKeys = useMemo(() => usedVariantAttributeKeys(variants), [variants]);
  const suggestedVariantAxisKeys = useMemo(
    () => defaultVariantAxisKeys(categoryTemplates, usedVariantKeys),
    [categoryTemplates, usedVariantKeys]
  );
  const storedVariantAxes = watch("variant_axes");
  const variantAxisKeys = storedVariantAxes ?? [];
  const descriptiveAttributeTemplates = useMemo(
    () => splitTemplatesByAxis(categoryTemplates, variantAxisKeys).descriptive,
    [categoryTemplates, variantAxisKeys]
  );
  const variantCommitRef = useRef<(() => Promise<VariantMatrixCommitResult>) | null>(null);
  const compositionCommitRef = useRef<(() => Promise<CompositionCommitResult>) | null>(null);
  const [compositionDraft, setCompositionDraft] = useState<VariantMatrixDraftState | null>(null);
  const [compositionSectionDirty, setCompositionSectionDirty] = useState(false);
  const [wizardSubmitPending, setWizardSubmitPending] = useState(false);
  const variantCompositionMode =
    activeWizardStage === "versions" && Boolean(wizard) && isMultiSku ? "draft" : "live";
  const compositionDeferSave = Boolean(wizard && activeWizardStage === "composition");
  const variantAxisCategoryRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const previousCategory = variantAxisCategoryRef.current;
    variantAxisCategoryRef.current = categoryId;
    const current = getValues("variant_axes") ?? [];
    const filtered = sanitizeVariantAxisKeys(current, categoryTemplates);
    const categoryChanged = previousCategory !== undefined && previousCategory !== categoryId;
    if (categoryChanged || filtered.length !== current.length) {
      setValue("variant_axes", filtered, { shouldDirty: categoryChanged });
    }
  }, [categoryId, categoryTemplates, getValues, setValue]);

  useEffect(() => {
    const current = getValues("variant_attributes") ?? {};
    const descriptiveOnly = pickDescriptiveVariantAttributes(
      current,
      categoryTemplates,
      variantAxisKeys
    );
    if (JSON.stringify(descriptiveOnly) !== JSON.stringify(current)) {
      setValue("variant_attributes", descriptiveOnly, { shouldDirty: false });
    }
  }, [categoryTemplates, getValues, setValue, variantAxisKeys]);

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

  const hasShippingDimensionValues = useCallback(
    (values: {
      dead_weight_kg?: string | null;
      volume?: string | null;
      length_cm?: string | null;
      width_cm?: string | null;
      height_cm?: string | null;
    }) =>
      Number(values.dead_weight_kg) > 0 ||
      Number(values.length_cm) > 0 ||
      Number(values.width_cm) > 0 ||
      Number(values.height_cm) > 0,
    []
  );

  const barcode = watch("barcode");

  const [showBasicsAdvanced, setShowBasicsAdvanced] = useState(
    () => (initialValues?.alternate_uoms?.length ?? 0) > 0
  );

  const [showBasicsMore, setShowBasicsMore] = useState(
    () =>
      Boolean(initialValues?.barcode?.trim()) ||
      hasShippingDimensionValues(initialValues ?? {})
  );

  useEffect(() => {
    if ((alternateUoms?.length ?? 0) > 0) {
      setShowBasicsAdvanced(true);
    }
  }, [alternateUoms?.length]);

  useEffect(() => {
    if (
      barcode?.trim() ||
      hasShippingDimensionValues({
        dead_weight_kg: deadWeightKg,
        length_cm: lengthCm,
        width_cm: widthCm,
        height_cm: heightCm,
      })
    ) {
      setShowBasicsMore(true);
    }
  }, [barcode, deadWeightKg, lengthCm, widthCm, heightCm, hasShippingDimensionValues]);

  useEffect(() => {
    const computed = computeVolumeCm3FromDimensions(lengthCm, widthCm, heightCm);
    if (form.getValues("volume") === computed) return;
    setValue("volume", computed, { shouldDirty: true });
  }, [lengthCm, widthCm, heightCm, form, setValue]);

  const [showSalableAdvanced, setShowSalableAdvanced] = useState(
    () =>
      Boolean(
        initialValues?.selling_uom?.trim() &&
          initialValues.selling_uom !== initialValues?.base_unit_of_measure
      )
  );

  useEffect(() => {
    if (sellingUom.trim() && sellingUom !== baseUom) {
      setShowSalableAdvanced(true);
    }
  }, [sellingUom, baseUom]);

  const purchaseConversionFromCatalog = useMemo(
    () => conversionFactorForAlternate(alternateUoms ?? [], purchaseUom),
    [alternateUoms, purchaseUom]
  );
  const showPurchaseConversionField =
    purchaseUom !== baseUom && !purchaseConversionFromCatalog;

  const showSellingUnitField = commerceUomOptions.length > 1;
  const showPurchaseUnitField = purchaseCommerceUomOptions.length > 1;

  const [showPurchasableAdvanced, setShowPurchasableAdvanced] = useState(() =>
    Boolean(
      initialValues?.purchase_uom?.trim() &&
        initialValues.purchase_uom !== initialValues?.base_unit_of_measure &&
        !conversionFactorForAlternate(
          initialValues?.alternate_uoms ?? [],
          initialValues.purchase_uom
        )
    )
  );

  useEffect(() => {
    if (showPurchaseConversionField) {
      setShowPurchasableAdvanced(true);
    }
  }, [showPurchaseConversionField]);

  useEffect(() => {
    if (!purchaseConversionFromCatalog) return;
    if (form.getValues("purchase_uom_conversion") === purchaseConversionFromCatalog) return;
    setValue("purchase_uom_conversion", purchaseConversionFromCatalog, { shouldDirty: false });
  }, [purchaseConversionFromCatalog, form, setValue]);

  useEffect(() => {
    if (purchaseUom === baseUom) return;
    const factor = conversionFactorForAlternate(alternateUoms ?? [], purchaseUom);
    if (!factor) return;
    if (form.getValues("purchase_uom_conversion") === factor) return;
    setValue("purchase_uom_conversion", factor, { shouldDirty: true });
  }, [alternateUoms, baseUom, form, purchaseUom, setValue]);

  useEffect(() => {
    if (showSellingUnitField) return;
    if (sellingUom === baseUom) return;
    setValue("selling_uom", baseUom, { shouldDirty: true });
  }, [baseUom, sellingUom, setValue, showSellingUnitField]);

  useEffect(() => {
    if (showPurchaseUnitField) return;
    if (purchaseUom === baseUom) return;
    setValue("purchase_uom", baseUom, { shouldDirty: true });
    setValue("purchase_uom_conversion", "1", { shouldDirty: true });
  }, [baseUom, purchaseUom, setValue, showPurchaseUnitField]);

  const showStatus = !readOnly;

  // Resolve scroll root: drawer panel scroll container, else nearest overflow ancestor.
  useLayoutEffect(() => {
    if (isPanelLayout && panelScrollRef.current) {
      scrollRootRef.current = panelScrollRef.current;
      setScrollRoot(panelScrollRef.current);
      return;
    }
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
  }, [isPanelLayout, panelPaneWidth, panelUseTopSectionTabs]);

  // Scroll-spy: highlight the section whose top has most recently crossed the anchor line.
  useEffect(() => {
    const scrollRootEl = scrollRootRef.current;
    if (!scrollRootEl) return;

    const updateActive = () => {
      if (Date.now() < ignoreSpyUntilRef.current) return;

      const stickyNavHeight = isPanelLayout
        ? panelUseTopSectionTabs
          ? (chipBarRef.current?.offsetHeight ?? 0)
          : 0
        : (chipBarRef.current?.offsetHeight ?? 0);
      const anchorLine = resolveScrollSpyAnchorLine(
        scrollRootEl,
        resolveEditorScrollSpyOffset(isPanelLayout, stickyNavHeight, panelRailHorizontal)
      );
      const nextActive = resolveActiveSectionByScrollPosition(
        visibleSectionIds,
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
  }, [isPanelLayout, panelUseTopSectionTabs, scrollRoot, visibleSectionIds]);

  useEffect(() => {
    if (itemId) return;
    if (EDITOR_SECTIONS_HIDDEN_WHILE_CREATING.includes(activeSection)) {
      setActiveSection("overview");
    }
  }, [itemId, activeSection]);

  const scrollToSection = useCallback(
    (id: SectionId) => {
      ignoreSpyUntilRef.current = Date.now() + 900;
      setActiveSection(id);
      const el = sectionRefs.current[id];
      if (!el) return;

      const stickyNavHeight = isPanelLayout
        ? panelUseTopSectionTabs
          ? (chipBarRef.current?.offsetHeight ?? 0)
          : 0
        : (chipBarRef.current?.offsetHeight ?? 0);
      if (isPanelLayout && panelScrollRef.current) {
        const root = panelScrollRef.current;
        const rootRect = root.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const top =
          root.scrollTop + (elRect.top - rootRect.top) - (stickyNavHeight > 0 ? stickyNavHeight + 8 : 12);
        root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
      scrollElementInDashboardRoot(el, {
        offsetTop: isPanelLayout ? 20 : 96,
        additionalOffset: stickyNavHeight > 0 ? stickyNavHeight + 8 : 0,
        scrollRootRef,
      });
    },
    [isPanelLayout, panelUseTopSectionTabs]
  );

  scrollToSectionRef.current = scrollToSection;
  itemSavedHandlerRef.current = async (savedId, savedDetail) => {
    setReachSaveErrors(null);
    if (savedId && locationMatrixRef.current) {
      const persistResult = await locationMatrixRef.current.persist({
        storefrontVisibility: getValues("storefront_visibility"),
      });
      if (!persistResult.ok) {
        setReachSaveErrors(persistResult.failures);
        scrollToSectionRef.current("visibility");
        onSavedParentRef.current?.(savedId, savedDetail ?? null);
        return false;
      }
    }
    if (
      savedId &&
      trackInventory &&
      trackingMode === "NONE" &&
      openingStockMatrixRef.current
    ) {
      const openingResult = await openingStockMatrixRef.current.persist();
      if (!openingResult.ok) {
        setReachSaveErrors(openingResult.failures);
        scrollToSectionRef.current("visibility");
        onSavedParentRef.current?.(savedId, savedDetail ?? null);
        return false;
      }
    }
    onSavedParentRef.current?.(savedId, savedDetail ?? null);
    return true;
  };

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

  const submitPending = isPending || wizardSubmitPending;

  const wizardPrimaryLabel = useMemo(() => {
    if (submitPending) {
      if (activeWizardStage === "versions" && variantCompositionMode === "draft") {
        return "Saving variants…";
      }
      if (activeWizardStage === "composition") {
        return "Saving composition…";
      }
      return "Saving…";
    }
    if (!wizard) return itemSaveLabel;
    if (wizard.isLast) return "Finish";
    if (wizard.isFirst) return "Save & continue";
    return "Continue";
  }, [itemSaveLabel, submitPending, variantCompositionMode, wizard]);

  // Hand the save trigger to the wizard host so its nav buttons can save first.
  useEffect(() => {
    wizard?.registerSubmit((nav) => {
      void (async () => {
        setWizardSubmitPending(true);
        try {
          if (nav.type === "back" && !isDirty && itemId) {
            onSaved(itemId, detail);
            return;
          }

          let committedDetail: ProductDetailSnapshot | undefined;

          if (
            activeWizardStage === "versions" &&
            isMultiSku &&
            variantCompositionMode === "draft" &&
            variantCommitRef.current
          ) {
            const result = await variantCommitRef.current();
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            if (result.updatedAt) {
              setValue("updated_at", result.updatedAt, { shouldDirty: false });
            }
            committedDetail = result.detail;
          }

          if (
            nav.type === "primary" &&
            activeWizardStage === "composition" &&
            hasComposition &&
            compositionCommitRef.current
          ) {
            const result = await compositionCommitRef.current();
            if ("error" in result) {
              toast.error(result.error);
              return;
            }
            if (!isDirty && itemId) {
              onSaved(itemId, detail);
              return;
            }
          }

          const skipProfileSave =
            nav.type === "primary" &&
            activeWizardStage === "versions" &&
            variantCompositionMode === "draft" &&
            Boolean(committedDetail) &&
            itemId;

          if (skipProfileSave && committedDetail) {
            const hydrated = {
              ...detailToFormValues(committedDetail),
              storefront_visibility: mergeStorefrontVisibility(
                catalogContext.storefronts,
                detailToFormValues(committedDetail).storefront_visibility
              ),
            };
            form.reset(hydrated);
            onSaved(itemId, committedDetail);
            return;
          }

          await handleSave();
        } finally {
          setWizardSubmitPending(false);
        }
      })();
    });
  }, [
    activeWizardStage,
    wizard,
    catalogContext.storefronts,
    detail,
    form,
    handleSave,
    hasComposition,
    isDirty,
    isMultiSku,
    itemId,
    onSaved,
    setValue,
    variantCompositionMode,
  ]);

  useEffect(() => {
    if (!onMutationHeaderChange || !isPanelLayout || readOnly) {
      onMutationHeaderChange?.(null);
      return;
    }

    if (wizard && wizardSteps) {
      onMutationHeaderChange({
        variant: "wizard",
        isFirst: wizard.isFirst,
        isLast: wizard.isLast,
        onBack: wizard.onBack,
        onCancel,
        onSkip: wizard.onSkip,
        onPrimary: wizard.onPrimary,
        isPending: submitPending,
        isNavigatePending,
        primaryLabel: wizardPrimaryLabel,
      });
      return () => onMutationHeaderChange(null);
    }

    onMutationHeaderChange({
      variant: "edit",
      onCancel,
      onSave: () => {
        void handleSave();
      },
      isPending: submitPending,
      isNavigatePending,
      saveLabel: submitPending ? "Saving…" : itemSaveLabel,
    });
    return () => onMutationHeaderChange(null);
  }, [
    itemSaveLabel,
    onMutationHeaderChange,
    isPanelLayout,
    readOnly,
    wizard,
    wizardSteps,
    onCancel,
    handleSave,
    submitPending,
    isNavigatePending,
    wizardPrimaryLabel,
  ]);

  const panelPrimaryAction = useMemo(() => {
    if (readOnly || !isPanelLayout) return null;
    if (wizard && wizardSteps) {
      return {
        label: wizardPrimaryLabel,
        onClick: wizard.onPrimary,
      };
    }
    return {
      label: submitPending ? "Saving…" : itemSaveLabel,
      onClick: () => {
        void handleSave();
      },
    };
  }, [
    itemSaveLabel,
    readOnly,
    isPanelLayout,
    wizard,
    wizardSteps,
    submitPending,
    wizardPrimaryLabel,
    handleSave,
  ]);

  useEffect(() => {
    onDirtyChange?.(
      isDirty || Boolean(compositionDraft?.isDirty) || compositionSectionDirty
    );
  }, [compositionDraft?.isDirty, compositionSectionDirty, isDirty, onDirtyChange]);

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

  const reachLocationsPersistErrorMessage = useMemo(() => {
    if (!reachSaveErrors) return undefined;
    const parts = [
      reachSaveErrors.locations,
      reachSaveErrors.reorder,
      reachSaveErrors.channels,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : undefined;
  }, [reachSaveErrors]);

  const reachOpeningPersistErrorMessage = reachSaveErrors?.opening;
  const reachOpeningPersistErrorAction = reachSaveErrors?.openingAction;

  const sectionErrors = useMemo(() => {
    const map: Record<SectionId, boolean> = {
      overview: false,
      salable: false,
      purchasable: false,
      inventory: false,
      variants: false,
      composition: false,
      media: false,
      product_attributes: false,
      custom_fields: false,
      tags: false,
      visibility: false,
    };
    (Object.keys(errors) as Array<keyof ProductMasterFormValues>).forEach((key) => {
      const section = FIELD_SECTION[key];
      if (section) map[section] = true;
    });
    if (reachLocationsPersistErrorMessage || reachOpeningPersistErrorMessage) {
      map.visibility = true;
    }
    return map;
  }, [errors, reachLocationsPersistErrorMessage, reachOpeningPersistErrorMessage]);

  const sectionStatus = useCallback(
    (id: SectionId): SectionStatus => {
      if (sectionErrors[id]) return "error";
      switch (id) {
        case "overview":
          return name?.trim() && sku?.trim() && baseUom?.trim() ? "complete" : "empty";
        case "salable":
          if (!isSalable) return "empty";
          return Number(sellingPrice) > 0 || Number(mrp) > 0 ? "complete" : "empty";
        case "purchasable":
          if (!isPurchasable) return "empty";
          return Number(purchasePrice) > 0 ? "complete" : "empty";
        case "inventory": {
          if (!isPhysical) return "complete";
          if (!trackInventory) return "empty";
          return Number(standardCost) > 0 ? "complete" : "empty";
        }
        case "variants":
          if (compositionDraft?.includedCount) return "complete";
          return variants.some((variant) => !variant.is_master) ? "complete" : "empty";
        case "composition":
          return "empty";
        case "media":
          return media.length > 0 ? "complete" : "empty";
        case "product_attributes":
          return Object.values(variantAttributes).some((value) => String(value ?? "").trim())
            ? "complete"
            : "empty";
        case "custom_fields":
          return Array.isArray(customFields) && customFields.length > 0 ? "complete" : "empty";
        case "tags":
          return Array.isArray(tagIds) && tagIds.length > 0 ? "complete" : "empty";
        case "visibility":
          return Array.isArray(storefrontVisibility) &&
            storefrontVisibility.some((entry) => entry.is_visible)
            ? "complete"
            : "empty";
        default:
          return "empty";
      }
    },
    [
      sectionErrors,
      name,
      sku,
      isSalable,
      isPurchasable,
      isPhysical,
      sellingPrice,
      mrp,
      purchasePrice,
      trackInventory,
      standardCost,
      deadWeightKg,
      shippingVolume,
      lengthCm,
      widthCm,
      heightCm,
      variants.length,
      compositionDraft?.includedCount,
      media.length,
      tagIds,
      customFields,
      storefrontVisibility,
      variantAttributes,
      alternateUoms,
      baseUom,
    ]
  );

  // --- Wizard (guided create) derived state -------------------------------
  // Only the active stage's sections render; the rest of the chrome (stepper,
  // completeness, footer) is computed from the same sectionStatus.
  const wizardSectionSet = useMemo(
    () =>
      wizardSteps && wizard ? new Set(editorStageById(wizard.stage).sections) : null,
    [wizard, wizardSteps]
  );
  const sectionInStage = useCallback(
    (id: SectionId) => !wizardSectionSet || wizardSectionSet.has(id),
    [wizardSectionSet]
  );
  const sectionInExpandedStage = useCallback(
    (id: SectionId) => {
      if (!wizardAccordion) return true;
      const stage = stageForSection(id);
      if (!stage) return true;
      return expandedStage === stage;
    },
    [wizardAccordion, expandedStage]
  );

  const pinnedSet = useMemo(
    () => (pinnedSections ? new Set(pinnedSections) : null),
    [pinnedSections]
  );

  const sectionVisible = useCallback(
    (id: SectionId) =>
      sectionInExpandedStage(id) &&
      sectionInStage(id) &&
      (id !== "inventory" || isPhysical) &&
      (id !== "composition" || hasComposition) &&
      (!pinnedSet || pinnedSet.has(id)),
    [sectionInExpandedStage, sectionInStage, pinnedSet, isPhysical, hasComposition]
  );
  const wizardStages = useMemo(
    () =>
      EDITOR_STAGES.filter((stage) => {
        if (stage.id === "versions" && !showVariantsSection) return false;
        if (stage.id === "composition" && !hasComposition) return false;
        return true;
      }),
    [showVariantsSection, hasComposition]
  );
  const applicableWizardSections = useCallback(
    (sections: EditorSectionId[]) =>
      sections.filter(
        (section) =>
          (section !== "inventory" || isPhysical) &&
          (section !== "variants" || showVariantsSection) &&
          (section !== "composition" || hasComposition)
      ),
    [hasComposition, isPhysical, showVariantsSection]
  );

  const wizardStageStatuses = useMemo(() => {
    const map = {} as Record<EditorStageId, StageStatus>;
    for (const stage of wizardStages) {
      map[stage.id] = rollUpStageStatus(
        applicableWizardSections(stage.sections).map((section) => sectionStatus(section))
      );
    }
    return map;
  }, [wizardStages, sectionStatus, applicableWizardSections]);
  const wizardPercent = useMemo(
    () =>
      overallCompletenessPercent(
        wizardStages
          .flatMap((stage) => applicableWizardSections(stage.sections))
          .map((section) => sectionStatus(section))
      ),
    [wizardStages, sectionStatus, applicableWizardSections]
  );

  useEffect(() => {
    if (wizardAccordion) {
      setExpandedStage("essentials");
    }
  }, [wizardAccordion, itemId]);

  const jumpToStage = useCallback(
    (stageId: EditorStageId) => {
      setExpandedStage(stageId);
      ignoreSpyUntilRef.current = Date.now() + 900;
      requestAnimationFrame(() => {
        const el = stageHeaderRefs.current[stageId];
        if (!el) return;
        if (isPanelLayout && panelScrollRef.current) {
          const root = panelScrollRef.current;
          const rootRect = root.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const top = root.scrollTop + (elRect.top - rootRect.top) - 12;
          root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          return;
        }
        scrollElementInDashboardRoot(el, {
          offsetTop: isPanelLayout ? 20 : 96,
          scrollRootRef,
        });
      });
    },
    [isPanelLayout]
  );

  const toggleExpandedStage = useCallback((stageId: EditorStageId) => {
    setExpandedStage((prev) => (prev === stageId ? prev : stageId));
    ignoreSpyUntilRef.current = Date.now() + 400;
  }, []);

  const registerStageHeader = useCallback(
    (stageId: EditorStageId) => (el: HTMLDivElement | null) => {
      if (el) {
        stageHeaderRefs.current[stageId] = el;
      } else {
        delete stageHeaderRefs.current[stageId];
      }
    },
    []
  );

  const renderStageAccordionHeader = useCallback(
    (stageId: EditorStageId) => {
      if (!wizardAccordion) return null;
      const stage = wizardStages.find((entry) => entry.id === stageId);
      if (!stage) return null;
      const index = wizardStages.findIndex((entry) => entry.id === stageId);
      return (
        <EditorStageAccordionHeader
          stage={stage}
          index={index}
          status={wizardStageStatuses[stageId] ?? "empty"}
          expanded={expandedStage === stageId}
          onToggle={() => toggleExpandedStage(stageId)}
          registerRef={registerStageHeader(stageId)}
          panel={isPanelLayout}
        />
      );
    },
    [
      wizardAccordion,
      wizardStages,
      wizardStageStatuses,
      expandedStage,
      toggleExpandedStage,
      registerStageHeader,
      isPanelLayout,
    ]
  );

  const wizardStepperActiveStage = wizardAccordion ? expandedStage : wizard?.stage ?? "essentials";
  const wizardStepperOnSelect = wizardAccordion
    ? jumpToStage
    : wizard?.onSelectStage;

  const handleCatalogChange = useCallback(
    (
      key: "custom_fields" | "tag_ids" | "storefront_visibility",
      value:
        | ProductMasterFormValues["custom_fields"]
        | ProductMasterFormValues["tag_ids"]
        | ProductMasterFormValues["storefront_visibility"]
    ) => {
      switch (key) {
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
    },
    [setValue]
  );

  const primaryImageUrl = useMemo(
    () => (detail ? pickPrimaryImagePreviewUrl(detail.media, detail.variant_id, detail.variants) : null),
    [detail]
  );

  const displayName = name?.trim()
    ? name
    : mode === "create"
      ? "New item"
      : "Untitled item";

  const mobileChips = useMemo(
    () =>
      visibleSections.map((section) => ({
        id: section.id,
        label: section.label,
        leading: showStatus ? <StatusDot status={sectionStatus(section.id)} /> : undefined,
      })),
    [sectionStatus, showStatus, visibleSections]
  );

  return (
    <EditorPanelContext.Provider value={isPanelLayout}>
    <ItemExtensionDataProvider itemId={itemId} catalogContext={catalogContext} enabled={loadExtensionData}>
    <form
      ref={formRef}
      onSubmit={handleSave}
      className={cn(
        PRODUCT_EDITOR_FORM_CLASS,
        "flex flex-col",
        isPanelLayout &&
          cn(
            "product-editor-panel h-full min-h-0 w-full flex-1 gap-2",
            wizard && isPanelLayout ? "overflow-visible" : "overflow-hidden"
          ),
        !isPanelLayout &&
          (wizard ? "h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden" : "gap-4")
      )}
    >
      {/* Summary header — wizard focuses on the stepper + fields */}
      {!isPanelLayout && mode !== "create" && !wizard ? (
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
            {mode !== "create" ? (
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
            ) : null}
          </div>
        </div>
      ) : null}

      {(!isPanelLayout || panelUseTopSectionTabs) && !wizard && !effectiveHideNav ? (
        <div
          className={cn(
            panelUseTopSectionTabs &&
              "shrink-0 border-b border-border/80 bg-background/95 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/90"
          )}
        >
          <SectionScrollChipBar
            barRef={chipBarRef}
            chips={mobileChips}
            activeId={activeSection}
            onSelect={(id) => scrollToSection(id as SectionId)}
            embedded={panelUseTopSectionTabs}
            dense={panelUseTopSectionTabs}
          />
        </div>
      ) : null}

      <div
        ref={panelLayoutRef}
        className={cn(
          isPanelLayout && "min-h-0 min-w-0 flex-1 overflow-hidden",
          wizard
            ? cn(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                wizard && isPanelLayout ? "overflow-visible" : "overflow-hidden",
                isPanelLayout && "h-full",
                wizardUseLeftRail && isPanelLayout && editorPanelWizardBleedClass(),
                wizardUseLeftRail &&
                  (isPanelLayout
                    ? editorPanelWizardLayoutGridClass()
                    : editorPageWizardLayoutGridClass())
              )
            : cn(
                isPanelLayout &&
                  (panelUseTopSectionTabs || effectiveHideNav
                    ? "flex h-full min-h-0 flex-col"
                    : cn(editorPanelLayoutGridClass(false), "h-full min-h-0 items-stretch")),
                !isPanelLayout && "lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:items-start lg:gap-6"
              )
        )}
      >
        {wizard && !wizardUseLeftRail ? (
          <div className={editorWizardTopBarClass(isPanelLayout)}>
            <EditorStepper
              stages={wizardStages}
              activeStage={wizardStepperActiveStage}
              statuses={wizardStageStatuses}
              percent={wizardPercent}
              onSelect={wizardStepperOnSelect}
              freeNavigation={wizardAccordion}
              compact
              showDescription={false}
            />
          </div>
        ) : null}

        {wizard && wizardUseLeftRail ? (
          <aside className={editorWizardLeftRailAsideClass(isPanelLayout)}>
            <div className={editorWizardLeftRailInnerClass(isPanelLayout)}>
              <div className={editorWizardLeftRailStickyClass()}>
                <EditorStepper
                  stages={wizardStages}
                  activeStage={wizardStepperActiveStage}
                  statuses={wizardStageStatuses}
                  percent={wizardPercent}
                  onSelect={wizardStepperOnSelect}
                  freeNavigation={wizardAccordion}
                  vertical
                  compact
                  showDescription={false}
                />
              </div>
            </div>
          </aside>
        ) : !wizard && !panelUseTopSectionTabs && !effectiveHideNav ? (
          <EditorSectionRail
            sections={visibleSections}
            activeSection={activeSection}
            onSelect={scrollToSection}
            showStatus={showStatus}
            sectionStatus={sectionStatus}
            compact={isPanelLayout}
            horizontal={false}
            railRef={panelRailRef}
          />
        ) : null}

        {/* Continuous form */}
        <div
          ref={isPanelLayout ? panelScrollRef : undefined}
          className={cn(
            "min-w-0",
            isPanelLayout &&
              "min-h-0 overflow-y-auto overscroll-contain [overflow-anchor:none]",
              editorPanelSectionStackClass(),
            isPanelLayout &&
              (wizard || panelUseTopSectionTabs || effectiveHideNav
                ? "flex-1"
                : "h-full max-h-full"),
            !isPanelLayout && "space-y-4",
            wizard &&
              cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                wizardUseLeftRail &&
                  (isPanelLayout
                    ? editorPanelWizardFormScrollClass()
                    : "lg:h-full lg:flex-none lg:pl-4 lg:pr-1"),
                wizard && !wizardUseLeftRail && isPanelLayout && "pt-4",
                isPanelLayout && wizard && editorPanelWizardScrollClass(),
                isPanelLayout && !wizard && "pb-1",
                !isPanelLayout && "pb-16 md:pb-1"
              )
          )}
        >
          {isPanelLayout && mode !== "create" && !wizard ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <div className={editorPanelBadgesClass()}>
                <Badge variant="active">{itemTypeLabel(itemType)}</Badge>
                <Badge variant="default">{variantStrategyLabel(variantStrategy)}</Badge>
                {needsReview ? <Badge variant="action_required">Needs review</Badge> : null}
              </div>
              {itemId ? (
                <div className="flex flex-wrap items-center gap-3">
                  <ToggleRow
                    variant="inline"
                    label="Active"
                    info={fieldHelpText(ITEM_EDITOR_TOGGLE_HELP.active)}
                    checked={isActive}
                    disabled={disableInput("is_active")}
                    onCheckedChange={(checked) => {
                      setValue("is_active", checked, { shouldDirty: true });
                      setValue("status", itemLifecycleStatusFromActive(checked), { shouldDirty: true });
                    }}
                  />
                  {needsReview ? (
                    <ToggleRow
                      variant="inline"
                      label="Needs review"
                      info={fieldHelpText(ITEM_EDITOR_TOGGLE_HELP.needsReview)}
                      checked={needsReview}
                      disabled={disableInput("needs_review")}
                      onCheckedChange={(checked) =>
                        setValue("needs_review", checked, { shouldDirty: true })
                      }
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {renderStageAccordionHeader("essentials")}
          <SectionBlock
            id="overview"
            title="Basics"
            description={
              wizard
                ? undefined
                : "Start here: name, classification, base unit, tax, and how many variants this product has."
            }
            registerRef={registerSection("overview")}
            hidden={!sectionVisible("overview")}
            panel={isPanelLayout}
          >
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
                        href={`/items/${match.id}`}
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
              <Field
                label="Item name"
                htmlFor="name"
                error={errors.name?.message}
                hint={ITEM_EDITOR_FIELD_HELP.itemName}
              >
                <Input id="name" disabled={disableInput("name")} {...register("name")} />
              </Field>

              <Field
                label={isMultiSku ? "Product code" : "SKU"}
                htmlFor="sku"
                error={errors.sku?.message}
                hint={
                  isMultiSku
                    ? ITEM_EDITOR_FIELD_HELP.productCodeMultiSku
                    : skuFieldHint(catalogContext.catalog_items, mode === "create")
                }
              >
                <Input
                  id="sku"
                  disabled={disableInput("sku")}
                  className="font-mono"
                  {...register("sku")}
                />
              </Field>

              <Field
                label="Description"
                htmlFor="description"
                error={errors.description?.message}
                full
                hint={ITEM_EDITOR_FIELD_HELP.description}
              >
                <textarea
                  id="description"
                  disabled={disableInput("description")}
                  className="flex w-full text-sm placeholder:text-muted-foreground"
                  {...register("description")}
                />
              </Field>

              <Field
                label={VARIANT_STRATEGY_FIELD_LABEL}
                hint={ITEM_EDITOR_FIELD_HELP.variantStrategySelect}
                info={<VariantStrategyFieldHelp />}
              >
                {!isPhysical ? (
                  <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                    {variantStrategyLabel(variantStrategy)}
                  </p>
                ) : (
                  <div className="space-y-2">
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
                        <SelectValue>{variantStrategyLabel(variantStrategy)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {VARIANT_STRATEGY_CHOICES.map((choice) => (
                          <SelectItemWithDescription
                            key={choice.value}
                            value={choice.value}
                            label={choice.label}
                            description={choice.description}
                            disabled={choice.value === "SINGLE_SKU" && !canSelectSingleSku}
                          />
                        ))}
                      </SelectContent>
                    </Select>
                    {itemId && !canSelectSingleSku ? (
                      <p className="text-xs text-muted-foreground">
                        Remove extra sellable SKUs under Variants before switching back to Single.
                      </p>
                    ) : null}
                  </div>
                )}
              </Field>

              <Field label="Category" hint={ITEM_EDITOR_FIELD_HELP.category}>
                <Select
                  value={watch("category_id") ?? "none"}
                  disabled={disableInput("category_id")}
                  onValueChange={(value) =>
                    setValue("category_id", value === "none" ? null : value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
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

              <Field
                label="Item type"
                hint={ITEM_EDITOR_FIELD_HELP.itemType}
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
                    hint={ITEM_EDITOR_FIELD_HELP.classification}
                    locked={isLocked("classification")}
                  >
                    <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                      {classificationLabel("SERVICE")}
                    </p>
                  </Field>
                ) : (
                  <Field
                    label="Supply-chain role"
                    hint={`${ITEM_EDITOR_FIELD_HELP.classification} ${ITEM_EDITOR_FIELD_HELP.supplyChainRoleSelect}`}
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
                        <SelectValue />
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

                {itemTypeSupportsComposition(itemType) ? (
                  <Field
                    label={COMPOSITION_FIELD_LABEL}
                    hint={ITEM_EDITOR_TOGGLE_HELP.composition}
                    full
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                        {hasComposition
                          ? "Save, then add components in the Composition step."
                          : "Off = a single standalone item."}
                      </p>
                      <Switch
                        size={editorSwitchSize}
                        checked={isBundle}
                        disabled={disableInput("is_bundle")}
                        onCheckedChange={(checked) =>
                          setValue("is_bundle", checked, { shouldDirty: true })
                        }
                        aria-label={COMPOSITION_FIELD_LABEL}
                      />
                    </div>
                  </Field>
                ) : null}

              <Field
                label="Tax category"
                hint={
                  isTaxableCategory
                    ? ITEM_EDITOR_FIELD_HELP.taxCategoryTaxable
                    : ITEM_EDITOR_FIELD_HELP.taxCategoryNonTaxable
                }
              >
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
                    hint={
                      itemTaxCodePickerOptions.length > 0
                        ? `${ITEM_EDITOR_FIELD_HELP.taxRule} ${ITEM_EDITOR_FIELD_HELP.taxRuleSelect}`
                        : ITEM_EDITOR_FIELD_HELP.taxRule
                    }
                    info={
                      itemTaxCodePickerOptions.length === 0 ? (
                        <p>{ITEM_EDITOR_FIELD_HELP.taxRuleNoRules}</p>
                      ) : undefined
                    }
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
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItemWithDescription
                          value="none"
                          label="No tax rule"
                          description="Taxable item with no rate chosen yet. Pick a rate when you know the product code."
                        />
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
                  <Field
                    label="HSN / SAC code"
                    htmlFor="hsn_sac_code"
                    hint={
                      itemTaxCodePickerOptions.length > 0
                        ? `${ITEM_EDITOR_FIELD_HELP.hsnRequired} ${ITEM_EDITOR_FIELD_HELP.hsnExample}`
                        : `${ITEM_EDITOR_FIELD_HELP.hsnIntro} ${ITEM_EDITOR_FIELD_HELP.hsnExample}`
                    }
                  >
                    <Input
                      id="hsn_sac_code"
                      disabled={disableInput("hsn_sac_code")}
                      className="font-mono"
                      {...register("hsn_sac_code")}
                    />
                  </Field>
                ) : null}

              <ProductBaseUnitField
                catalogContext={catalogContext}
                baseUom={baseUom}
                isPhysical={isPhysical}
                stockUnitDisabled={disableInput("base_unit_of_measure", "base_unit_of_measure")}
                stockUnitLocked={isLocked("base_unit_of_measure")}
                onBaseUomChange={(code) =>
                  setValue("base_unit_of_measure", code, { shouldDirty: true })
                }
              />

              <EditorSectionAdvanced
                variant="more"
                open={showBasicsMore}
                onToggle={() => setShowBasicsMore((open) => !open)}
                panel={isPanelLayout}
              >
                {!isMultiSku ? (
                  <Field
                    label="GTIN"
                    htmlFor="barcode"
                    error={errors.barcode?.message}
                    hint={gtinFieldHint(catalogContext.catalog_items.scan_identifier_policy)}
                  >
                    <Input
                      id="barcode"
                      disabled={disableInput("barcode")}
                      className="font-mono"
                      {...register("barcode")}
                    />
                  </Field>
                ) : (
                  <p className={editorEmptyStateClass(isPanelLayout)}>
                    {ITEM_EDITOR_FIELD_HELP.gtinMultiSku}
                  </p>
                )}
                {isPhysical ? (
                  <div className={cn(isPanelLayout ? "space-y-3" : "space-y-4")}>
                    {isMultiSku ? (
                      <p className={editorEmptyStateClass(isPanelLayout)}>
                        Variants inherit these dimensions until you override them per SKU in
                        Variants.
                      </p>
                    ) : null}
                    <div className={editorGridClass(isPanelLayout)}>
                      <div
                        className={cn(
                          editorFieldSpanFullClass(isPanelLayout),
                          editorDimensionsLwhGridClass()
                        )}
                      >
                        <Field
                          label="Length (cm)"
                          htmlFor="length_cm"
                          error={errors.length_cm?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.lengthCm}
                        >
                          <Input
                            id="length_cm"
                            disabled={disableInput("length_cm")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("length_cm")}
                          />
                        </Field>
                        <Field
                          label="Width (cm)"
                          htmlFor="width_cm"
                          error={errors.width_cm?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.widthCm}
                        >
                          <Input
                            id="width_cm"
                            disabled={disableInput("width_cm")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("width_cm")}
                          />
                        </Field>
                        <Field
                          label="Height (cm)"
                          htmlFor="height_cm"
                          error={errors.height_cm?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.heightCm}
                        >
                          <Input
                            id="height_cm"
                            disabled={disableInput("height_cm")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("height_cm")}
                          />
                        </Field>
                      </div>
                      <Field
                        label="Weight (kg)"
                        htmlFor="dead_weight_kg"
                        error={errors.dead_weight_kg?.message}
                        full
                        hint={ITEM_EDITOR_FIELD_HELP.weightShipping}
                      >
                        <Input
                          id="dead_weight_kg"
                          disabled={disableInput("dead_weight_kg")}
                          className="text-right font-mono"
                          inputMode="decimal"
                          {...register("dead_weight_kg")}
                        />
                      </Field>
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          editorFieldSpanFullClass(isPanelLayout)
                        )}
                      >
                        {formatCalculatedVolumeInfo(lengthCm, widthCm, heightCm)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </EditorSectionAdvanced>

              <EditorSectionAdvanced
                open={showBasicsAdvanced}
                onToggle={() => setShowBasicsAdvanced((open) => !open)}
                panel={isPanelLayout}
              >
                <ProductUnitsSection
                  catalogContext={catalogContext}
                  baseUom={baseUom}
                  alternateUoms={alternateUoms ?? []}
                  alternatesDisabled={fieldDisabled}
                  onAlternateUomsChange={(rows) =>
                    setValue("alternate_uoms", rows, { shouldDirty: true })
                  }
                />
              </EditorSectionAdvanced>
            </div>

            {(itemId || needsReview) && !(isPanelLayout && itemId) ? (
              <div className={editorSubsectionClass(isPanelLayout)}>
                {itemId ? (
                  <h4 className={editorSubsectionHeadingClass(isPanelLayout)}>Status</h4>
                ) : null}
                <div className={editorGridClass(isPanelLayout)}>
                  {itemId ? (
                    <ToggleRow
                      label="Active"
                      description={ITEM_EDITOR_TOGGLE_HELP.active}
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
                      description={ITEM_EDITOR_TOGGLE_HELP.needsReview}
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
            id="salable"
            title="Salable"
            description="Return policy, rates, price book, and sales unit."
            headerToggle={{
              label: "Salable",
              description: ITEM_EDITOR_TOGGLE_HELP.salable,
              checked: isSalable,
              disabled: disableInput("is_salable"),
              onCheckedChange: (checked) =>
                setValue("is_salable", checked, { shouldDirty: true }),
            }}
            registerRef={registerSection("salable")}
            hidden={!sectionVisible("salable")}
            panel={isPanelLayout}
          >
            {pricingFieldsLocked ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Pricing fields are read-only for your role. Contact your workspace owner to request
                access.
              </p>
            ) : null}

            {isSalable ? (
              <>
                <div className={editorGridClass(isPanelLayout)}>
                  <Field
                    label={`Selling rate (${catalogContext.base_currency})`}
                    htmlFor="selling_price"
                    error={errors.selling_price?.message}
                    hint={ITEM_EDITOR_FIELD_HELP.sellingRate}
                  >
                    <Input
                      id="selling_price"
                      disabled={disableInput("selling_price")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("selling_price")}
                    />
                  </Field>
                  <Field
                    label={`${MRP_PRICE_COLUMN} (${catalogContext.base_currency})`}
                    htmlFor="mrp"
                    error={errors.mrp?.message}
                    hint={ITEM_EDITOR_FIELD_HELP.mrp}
                  >
                    <Input
                      id="mrp"
                      disabled={disableInput("mrp")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("mrp")}
                    />
                  </Field>
                </div>
                <ToggleRow
                  label="Returnable"
                  description={ITEM_EDITOR_TOGGLE_HELP.returnable}
                  checked={watch("is_returnable")}
                  disabled={disableInput("is_returnable")}
                  onCheckedChange={(checked) =>
                    setValue("is_returnable", checked, { shouldDirty: true })
                  }
                />
                {showSellingUnitField ? (
                  <EditorSectionAdvanced
                    open={showSalableAdvanced}
                    onToggle={() => setShowSalableAdvanced((open) => !open)}
                    panel={isPanelLayout}
                  >
                    <CommerceUnitField
                      label="Default sales unit"
                      stockUom={baseUom}
                      value={sellingUom}
                      options={commerceUomOptions}
                      fieldDisabled={disableInput("selling_uom")}
                      onUnitChange={(code) => setValue("selling_uom", code, { shouldDirty: true })}
                      info={ITEM_EDITOR_FIELD_HELP.salesUnit}
                    />
                  </EditorSectionAdvanced>
                ) : null}
              </>
            ) : null}
            {itemId && isSalable ? (
              <div className={editorPanelDividerClass()}>
                {isSectionMounted("salable") ? (
                  <PriceBookEntryEditor
                    itemId={itemId}
                    variants={variants}
                    uomCodes={priceBookUomCodes}
                    readOnly={readOnly || disableInput("selling_price")}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Price book entries load when you open Salable.
                  </p>
                )}
              </div>
            ) : null}
          </SectionBlock>

          <SectionBlock
            id="purchasable"
            title="Purchasable"
            description="Purchase rate and vendor quotes."
            headerToggle={{
              label: "Purchasable",
              description: ITEM_EDITOR_TOGGLE_HELP.purchasable,
              checked: isPurchasable,
              disabled: disableInput("is_purchasable"),
              onCheckedChange: (checked) =>
                setValue("is_purchasable", checked, { shouldDirty: true }),
            }}
            registerRef={registerSection("purchasable")}
            hidden={!sectionVisible("purchasable")}
            panel={isPanelLayout}
          >
            {pricingFieldsLocked ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Pricing fields are read-only for your role. Contact your workspace owner to request
                access.
              </p>
            ) : null}

            {isPurchasable ? (
              <>
                <div className={editorGridClass(isPanelLayout)}>
                  <Field
                    label={`Purchase rate (${catalogContext.base_currency})`}
                    htmlFor="purchase_price"
                    error={errors.purchase_price?.message}
                    hint={ITEM_EDITOR_FIELD_HELP.purchaseRate}
                  >
                    <Input
                      id="purchase_price"
                      disabled={disableInput("purchase_price")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("purchase_price")}
                    />
                  </Field>
                </div>
                <div className={editorPanelDividerClass()}>
                  {itemId ? (
                    isSectionMounted("purchasable") ? (
                      <SupplierCatalogEditor
                        embedded
                        itemId={itemId}
                        variants={variants}
                        suppliers={catalogContext.suppliers}
                        readOnly={readOnly || disableInput("purchase_price")}
                      />
                    ) : (
                      <p className="text-xs leading-snug text-muted-foreground">
                        Vendor quotes load when you open Purchasable.
                      </p>
                    )
                  ) : (
                    <div className={editorDeferredActionClass(isPanelLayout)}>
                      <p className="text-xs leading-snug text-muted-foreground">
                        Save the item to add vendor quotes with purchase rate and supplier code.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 gap-1 px-0 font-medium text-primary hover:bg-transparent hover:text-primary",
                          isPanelLayout ? "text-xs" : "text-sm"
                        )}
                        disabled
                        aria-disabled
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Add vendor
                      </Button>
                    </div>
                  )}
                </div>
                {showPurchaseConversionField ? (
                  <EditorSectionAdvanced
                    open={showPurchasableAdvanced}
                    onToggle={() => setShowPurchasableAdvanced((open) => !open)}
                    panel={isPanelLayout}
                  >
                    <div className={editorGridClass(isPanelLayout)}>
                      <Field
                        label="Purchase conversion factor"
                        htmlFor="purchase_uom_conversion"
                        error={errors.purchase_uom_conversion?.message}
                        hint={ITEM_EDITOR_FIELD_HELP.purchaseConversionFactor(baseUom, purchaseUom)}
                      >
                        <Input
                          id="purchase_uom_conversion"
                          disabled={disableInput("purchase_uom_conversion")}
                          className="text-right font-mono"
                          inputMode="decimal"
                          {...register("purchase_uom_conversion")}
                        />
                      </Field>
                    </div>
                  </EditorSectionAdvanced>
                ) : null}
              </>
            ) : null}
          </SectionBlock>

          {isPhysical ? (
            <SectionBlock
              id="inventory"
              title="Track inventory"
              description="Stock tracking, costing, and live valuation."
              headerToggle={{
                label: "Track inventory",
                description: isLocked("track_inventory")
                  ? ITEM_EDITOR_TOGGLE_HELP.trackInventoryLocked
                  : ITEM_EDITOR_TOGGLE_HELP.trackInventory,
                info: !trackInventory ? ITEM_EDITOR_TOGGLE_HELP.trackInventoryOff : undefined,
                checked: trackInventory,
                disabled: disableInput("track_inventory", "track_inventory"),
                onCheckedChange: (checked) =>
                  setValue("track_inventory", checked, { shouldDirty: true }),
              }}
              registerRef={registerSection("inventory")}
              hidden={!sectionVisible("inventory")}
              panel={isPanelLayout}
            >
              {trackInventory ? (
                  <div className={editorGridClass(isPanelLayout)}>
                    <Field
                      label="Reorder point"
                      htmlFor="reorder_point"
                      error={errors.reorder_point?.message}
                      hint={ITEM_EDITOR_FIELD_HELP.reorderPoint}
                    >
                      <Input
                        id="reorder_point"
                        disabled={disableInput("reorder_point")}
                        className="text-right font-mono"
                        inputMode="decimal"
                        {...register("reorder_point")}
                      />
                    </Field>
                    <Field label="Costing method" hint={ITEM_EDITOR_FIELD_HELP.costingMethod}>
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
                    {costingMethod === "STANDARD" ? (
                      <Field
                        label={`Standard cost (${catalogContext.base_currency})`}
                        htmlFor="standard_cost"
                        error={errors.standard_cost?.message}
                        hint={ITEM_EDITOR_FIELD_HELP.standardCost}
                      >
                        <Input
                          id="standard_cost"
                          disabled={disableInput("standard_cost")}
                          className="text-right font-mono"
                          inputMode="decimal"
                          {...register("standard_cost")}
                        />
                      </Field>
                    ) : null}
                    <Field
                      label="Batch / serial tracking"
                      locked={isLocked("tracking_mode")}
                      hint={ITEM_EDITOR_FIELD_HELP.trackingMode}
                    >
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
                  </div>
                ) : null}

                {trackInventory && valuations.length > 0 ? (
                  <div className={editorPanelDividerClass()}>
                    <SubsectionHeading
                      title="Live inventory valuation (read-only)"
                      compact={isPanelLayout}
                    />
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
                ) : null}
            </SectionBlock>
          ) : null}

          {itemId && showVariantsSection ? (
            <>
            {renderStageAccordionHeader("versions")}
            <SectionBlock
              id="variants"
              title={VARIANTS_SECTION_LABEL}
              description={
                isPanelLayout
                  ? undefined
                  : isMultiSku
                    ? "Choose what varies, then add or generate sellable variants (SKUs)."
                    : "Category attributes and any additional variants for this product."
              }
              registerRef={registerSection("variants")}
              hidden={!sectionVisible("variants")}
              panel={isPanelLayout}
            >
              <div className={cn(isPanelLayout ? "space-y-4" : "space-y-6")}>
                <ProductVariantPanel
                  itemId={itemId}
                  variants={variants}
                  categoryTemplates={categoryTemplates}
                  variantAxisKeys={isMultiSku ? variantAxisKeys : undefined}
                  suggestedVariantAxisKeys={isMultiSku ? suggestedVariantAxisKeys : undefined}
                  onVariantAxisKeysChange={
                    isMultiSku
                      ? (keys) => setValue("variant_axes", keys, { shouldDirty: true })
                      : undefined
                  }
                  skuMask={skuMask}
                  baseSku={sku}
                  defaultSellingPrice={sellingPrice}
                  defaultPurchasePrice={purchasePrice}
                  defaultStandardCost={standardCost}
                  defaultMrp={matrixMrpDefault}
                  defaultHsn={hsnSacCode}
                  defaultSupplierId={supplierId}
                  variantDefaults={{
                    price: sellingPrice,
                    dead_weight_kg: deadWeightKg,
                    volume:
                      computeVolumeCm3FromDimensions(lengthCm, widthCm, heightCm) ||
                      shippingVolume,
                    length_cm: lengthCm,
                    width_cm: widthCm,
                    height_cm: heightCm,
                  }}
                  variantStrategy={variantStrategy}
                  defaultShowDimensionColumns={isPhysical && isMultiSku}
                  compositionMode={variantCompositionMode}
                  onRegisterVariantCommit={(commit) => {
                    variantCommitRef.current = commit;
                  }}
                  onCompositionDraftChange={setCompositionDraft}
                  readOnly={readOnly}
                  onVariantPatch={onVariantPatch}
                  onVariantsReload={onVariantsReload}
                  tenantId={tenantId}
                  media={media}
                  onMediaChanged={() => onExtensionsChanged?.()}
                />
              </div>
            </SectionBlock>
            </>
          ) : null}

          {itemId && hasComposition ? (
            <>
            {renderStageAccordionHeader("composition")}
            <SectionBlock
              id="composition"
              title={COMPOSITION_SECTION_LABEL}
              description="Items included when this product is sold as a set."
              registerRef={registerSection("composition")}
              hidden={!sectionVisible("composition")}
              panel={isPanelLayout}
            >
              <ProductCompositionSection
                itemId={itemId}
                parentItemType={itemType}
                classification={currentClassification}
                variants={variants}
                isMultiSku={isMultiSku}
                currency={catalogContext.base_currency}
                readOnly={readOnly}
                deferSave={compositionDeferSave}
                onRegisterCommit={(commit) => {
                  compositionCommitRef.current = commit;
                }}
                onDirtyChange={setCompositionSectionDirty}
              />
            </SectionBlock>
            </>
          ) : null}

          {itemId ? (
            <>
            {renderStageAccordionHeader("reach")}
            <SectionBlock
              id="media"
              title="Media"
              description="Images shown across storefront, catalog, and documents."
              registerRef={registerSection("media")}
              hidden={!sectionVisible("media")}
              panel={isPanelLayout}
            >
              <ProductMediaGallery
                tenantId={tenantId}
                itemId={itemId}
                variants={variants}
                media={media}
                readOnly={readOnly}
                layout={
                  activeWizardStage === "reach" || (isPanelLayout && isMultiSku)
                    ? "variant-rows"
                    : "scope-select"
                }
                density="compact"
                onChanged={() => onExtensionsChanged?.()}
              />
            </SectionBlock>

          {isPhysical && descriptiveAttributeTemplates.length > 0 ? (
            <SectionBlock
              id="product_attributes"
              title={categoryFieldsTitle}
              description={CATEGORY_FIELDS_SECTION_HELP}
              registerRef={registerSection("product_attributes")}
              hidden={!sectionVisible("product_attributes")}
              panel={isPanelLayout}
            >
              <VariantAttributeFields
                templates={descriptiveAttributeTemplates}
                values={variantAttributes}
                disabled={fieldDisabled}
                emptyMessage="Choose a category with shared product attributes."
                onChange={(key, value) =>
                  setValue(
                    "variant_attributes",
                    { ...variantAttributes, [key]: value },
                    { shouldDirty: true }
                  )
                }
              />
            </SectionBlock>
          ) : null}

          <SectionBlock
            id="custom_fields"
            title={CUSTOM_FIELDS_SECTION_LABEL}
            description={CUSTOM_FIELDS_SECTION_HELP}
            registerRef={registerSection("custom_fields")}
            hidden={!sectionVisible("custom_fields")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              blocks={["custom_fields"]}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              disabled={fieldDisabled}
              values={{
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
              }}
              onChange={handleCatalogChange}
            />
          </SectionBlock>

          <SectionBlock
            id="tags"
            title={DISCOVERY_TAGS_SECTION_LABEL}
            description={DISCOVERY_TAGS_SECTION_HELP}
            registerRef={registerSection("tags")}
            hidden={!sectionVisible("tags")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              blocks={["tags"]}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              disabled={fieldDisabled}
              values={{
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
              }}
              onTagsChanged={setTagOptions}
              onChange={handleCatalogChange}
            />
          </SectionBlock>

          <SectionBlock
            id="visibility"
            title={VISIBILITY_SECTION_LABEL}
            description={VISIBILITY_SECTION_HELP}
            registerRef={registerSection("visibility")}
            hidden={!sectionVisible("visibility")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              blocks={["channels"]}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              disabled={fieldDisabled}
              values={{
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
              }}
              onChange={handleCatalogChange}
            />
            {itemId && variants.length > 0 ? (
              <div className={cn(isPanelLayout ? "mt-3 space-y-3" : "mt-4 space-y-4")}>
                {isSectionMounted("visibility") ? (
                  <>
                    <div className={editorCatalogBlockClass(isPanelLayout)}>
                      <SubsectionHeading
                        title={VISIBILITY_LOCATIONS_SUBSECTION}
                        compact={isPanelLayout}
                        error={reachLocationsPersistErrorMessage}
                        info={fieldHelpText(
                          [
                            VISIBILITY_LOCATIONS_HELP,
                            hasListedChannels
                              ? "Listed channels appear as columns on the right for per-variant listings."
                              : null,
                            trackInventory
                              ? "Reorder inherits the product default from Inventory until you override it here."
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        )}
                      />
                      <VariantAssortmentMatrix
                        ref={locationMatrixRef}
                        itemId={itemId}
                        variants={variants}
                        trackInventory={trackInventory}
                        defaultReorderPoint={defaultReorderPoint}
                        deferSaveToParent={!readOnly && !fieldDisabled}
                        storefrontVisibility={storefrontVisibility}
                        persistError={reachLocationsPersistErrorMessage}
                        onAssortmentCellsChange={setDraftAssortmentCells}
                        readOnly={readOnly || fieldDisabled}
                        embedded
                      />
                    </div>
                    {trackInventory ? (
                      <div className={editorCatalogBlockClass(isPanelLayout)}>
                        <SubsectionHeading
                          title={VISIBILITY_OPENING_STOCK_SUBSECTION}
                          compact={isPanelLayout}
                          error={reachOpeningPersistErrorMessage}
                          errorAction={reachOpeningPersistErrorAction}
                          info={fieldHelpText(
                            trackingMode === "NONE"
                              ? VISIBILITY_OPENING_STOCK_HELP
                              : VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED
                          )}
                        />
                        {trackingMode === "NONE" ? (
                          <VariantOpeningStockMatrix
                            ref={openingStockMatrixRef}
                            itemId={itemId}
                            variants={variants}
                            purchasePrice={purchasePrice}
                            standardCost={standardCost}
                            stockedCellsOverride={draftAssortmentCells ?? undefined}
                            persistError={reachOpeningPersistErrorMessage}
                            persistErrorAction={reachOpeningPersistErrorAction}
                            readOnly={readOnly || fieldDisabled}
                            embedded
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {CATALOG_REACH_DISTRIBUTION_LOADING}
                  </p>
                )}
              </div>
            ) : null}
          </SectionBlock>
            </>
          ) : null}

          {!readOnly && panelPrimaryAction ? (
            <div className="flex justify-end pt-2">
              <PanelMutationPrimaryButton
                label={panelPrimaryAction.label}
                disabled={submitPending || isNavigatePending}
                onClick={panelPrimaryAction.onClick}
              />
            </div>
          ) : null}

        </div>
      </div>

      {/* Sticky action bar — full page only; drawer uses header actions */}
      {!readOnly && !isPanelLayout && (
        <div
          className={cn(
            "sticky bottom-0 z-10 shrink-0 flex items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
            wizardSteps ? "justify-between" : "justify-end",
            isPanelLayout
              ? "-mx-4 border-t border-border/60 px-4 py-2"
              : "border-t border-border py-3"
          )}
        >
          {wizardSteps && wizard ? (
            <>
              <div>
                {!wizard.isFirst ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitPending || isNavigatePending}
                    onClick={wizard.onBack}
                  >
                    Back
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitPending || isNavigatePending}
                    onClick={onCancel}
                  >
                    {isNavigatePending ? "Leaving…" : "Cancel"}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!wizard.isFirst && !wizard.isLast ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={submitPending || isNavigatePending}
                    onClick={wizard.onSkip}
                  >
                    Skip &amp; finish later
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={submitPending || isNavigatePending}
                  onClick={wizard.onPrimary}
                  title="Save (Cmd/Ctrl + Enter)"
                >
                  {wizardPrimaryLabel}
                </Button>
              </div>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={submitPending || isNavigatePending}
                onClick={onCancel}
              >
                {isNavigatePending ? "Leaving…" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submitPending || isNavigatePending} title="Save (Cmd/Ctrl + Enter)">
                {submitPending ? "Saving…" : itemSaveLabel}
              </Button>
            </>
          )}
        </div>
      )}
    </form>
    </ItemExtensionDataProvider>
    </EditorPanelContext.Provider>
  );
}
