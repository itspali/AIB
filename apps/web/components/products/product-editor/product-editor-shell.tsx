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
  ShoppingCart,
  Tag,
  Tags,
  Wallet,
  Warehouse,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import {
  type VariantAssortmentCell,
} from "@/app/items/actions";
import { PanelMutationPrimaryButton } from "@/components/products/panel-mutation-primary-button";
import { ProductPrimaryImage } from "@/components/products/product-primary-image";
import type {
  VariantMatrixCommitResult,
  VariantMatrixDraftState,
} from "@/components/products/variant-matrix-generator";
import type { CompositionCommitResult } from "@/components/products/product-editor/composition-editor";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import type { ProductPanelMutationHeader } from "@/components/products/product-panel-form";
import { ItemExtensionDataProvider } from "@/components/products/item-extension-data-provider";
import {
  type ReachPersistFailures,
  type VariantAssortmentMatrixHandle,
} from "@/components/products/variant-assortment-matrix";
import { type VariantOpeningStockMatrixHandle } from "@/components/products/variant-opening-stock-matrix";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FieldLabelInfo,
  fieldHelpText,
  mergeFieldLabelInfo,
} from "@/components/ui/field-label-info";
import {
  ITEM_EDITOR_FIELD_HELP,
  ITEM_EDITOR_TOGGLE_HELP,
} from "@/lib/products/item-editor-field-help";
import {
  MRP_PRICE_COLUMN,
  CUSTOM_FIELDS_SECTION_LABEL,
  DISCOVERY_TAGS_SECTION_LABEL,
  CATEGORY_FIELDS_SECTION_LABEL,
  categoryFieldsSectionTitle,
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
import {
  EditorToggleRow as ToggleRow,
  editorCardClassName,
} from "@/components/products/product-editor/editor-form-primitives";
import { EditorFieldHelpToggle, EditorFieldHelpProvider } from "@/components/products/product-editor/editor-field-help";
import { ItemEditorStageBody } from "@/components/items/item-editor/item-editor-stage-body";
import { useItemEditorStageModels } from "@/components/items/item-editor/use-item-editor-stage-models";
import {
  EDITOR_SHELL_SECTIONS,
  editorShellSections,
  type EditorSectionStatus,
  type SectionId,
} from "@/lib/products/item-editor/editor-shell-shared";
import { useItemEditorSectionNav } from "@/lib/products/item-editor/use-item-editor-section-nav";
import { useItemEditorSectionStatus } from "@/lib/products/item-editor/use-item-editor-section-status";
import { useItemEditorWizardChrome } from "@/lib/products/item-editor/use-item-editor-wizard-chrome";
import { useItemEditorSaveOrchestration } from "@/lib/products/item-editor/use-item-editor-save-orchestration";
import { useItemDuplicateCheck } from "@/lib/products/item-editor/use-item-duplicate-check";
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
  canSelectSingleVariantStrategy,
  inferVariantStrategy,
} from "@/lib/products/variant-strategy";
import {
  countSellableVariants,
  defaultVariantAxisKeys,
  pickDescriptiveVariantAttributes,
  resolveFormVariantStrategy,
  resolveVariantCompositionMode,
  shouldShowVariantsWizardStage,
  splitTemplatesByAxis,
  usedVariantAttributeKeys,
} from "@/lib/products/variant-composition";
import {
  resolveItemCompositionTemplates,
  sanitizeItemVariantAxisKeys,
} from "@/lib/products/item-composition-templates";
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
  editorSwitchSize,
  editorPanelLayoutGridClass,
  editorPanelWizardLayoutGridClass,
  editorPageWizardLayoutGridClass,
  editorPanelWizardBleedClass,
  editorPanelWizardScrollClass,
  editorPanelWizardFormScrollClass,
  editorWizardTopBarClass,
  editorWizardTopBarGlassClass,
  editorWizardLeftRailAsideClass,
  editorWizardLeftRailGlassAsideClass,
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
  useEditorGlassSections,
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
  type EditorStageId,
} from "@/lib/products/editor-stages";
import type { WizardNav } from "@/lib/products/use-product-create-wizard";
import { EditorStepper } from "@/components/products/product-editor/editor-stepper";
import { cn } from "@/lib/utils";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";
import { useMountedEditorSections } from "@/lib/products/use-mounted-editor-sections";

type SectionStatus = EditorSectionStatus;

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
  onSaved: (
    itemId: string,
    detail?: ProductDetailSnapshot | null,
    options?: import("@/lib/products/item-editor/editor-shell-shared").ItemSavedOptions
  ) => void;
  onExtensionsChanged?: () => void;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  isNavigatePending?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** Full-page wizard header: mirrors drawer footer primary label. */
  onWizardPrimaryLabelChange?: (label: string | null) => void;
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
  sections: ReadonlyArray<{
    id: SectionId;
    label: string;
    shortLabel: string;
    icon: typeof Package;
  }>;
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
  onWizardPrimaryLabelChange,
  onMutationHeaderChange,
  wizard,
  hideNav = false,
  pinnedSections,
}: Props) {
  // When pinnedSections is provided, nav is always hidden.
  const effectiveHideNav = hideNav || !!pinnedSections;
  const wizardAccordion = wizard?.layout === "accordion";
  const wizardSteps = Boolean(wizard && !wizardAccordion);
  const glassWizard = useEditorGlassSections();
  const [tagOptions, setTagOptions] = useState(catalogContext.tags);

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
  /** Drawer wizard: footer-only navigation — no stage header or stepper rail. */
  const wizardShowStepper = Boolean(wizard && wizardSteps && !isPanelLayout);

  const formRef = useRef<HTMLFormElement | null>(null);
  const locationMatrixRef = useRef<VariantAssortmentMatrixHandle>(null);
  const openingStockMatrixRef = useRef<VariantOpeningStockMatrixHandle>(null);
  const [draftAssortmentCells, setDraftAssortmentCells] = useState<
    VariantAssortmentCell[] | null
  >(null);
  const chipBarRef = useRef<HTMLDivElement | null>(null);
  const panelRailRef = useRef<HTMLElement | null>(null);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingSaveOptionsRef = useRef<
    import("@/lib/products/item-editor/editor-shell-shared").ItemSavedOptions | undefined
  >(undefined);
  const itemSavedHandlerRef = useRef<
    (
      savedId: string,
      savedDetail?: ProductDetailSnapshot | null,
      options?: import("@/lib/products/item-editor/editor-shell-shared").ItemSavedOptions
    ) => Promise<boolean>
  >(async () => true);
  const scrollToSectionRef = useRef<(id: SectionId) => void>(() => {});
  const handleItemSaved = useCallback(
    async (savedId: string, savedDetail?: ProductDetailSnapshot | null) =>
      itemSavedHandlerRef.current(savedId, savedDetail),
    []
  );

  const sellableVariantCount = useMemo(() => countSellableVariants(variants), [variants]);

  const getVariantStrategyContext = useCallback(
    () => ({
      sellableVariantCount,
      totalVariantRows: variants.length,
    }),
    [sellableVariantCount, variants.length]
  );

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
    getVariantStrategyContext,
  });

  /** Form `item_id` plus saved detail fallback (create wizard after first save). */
  const resolvedItemId = itemId ?? detail?.id ?? null;

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

  const storedVariantAxes = watch("variant_axes");
  const extraSkuOptions = watch("extra_sku_options") ?? [];
  const variantAxisKeys = storedVariantAxes ?? [];
  const compositionTemplates = useMemo(
    () => resolveItemCompositionTemplates(categoryTemplates, extraSkuOptions),
    [categoryTemplates, extraSkuOptions]
  );

  useEffect(() => {
    const inferred = inferVariantStrategy({
      sellableVariantCount,
      totalVariantRows: variants.length,
      persistedStrategy: variantStrategy,
      selectedAxisCount: variantAxisKeys.length,
    });
    const effective = resolveFormVariantStrategy(inferred, {
      itemId: resolvedItemId,
      variantAxisKeys,
      sellableVariantCount,
      variants,
    });
    if (effective !== variantStrategy) {
      setValue("variant_strategy", effective, { shouldDirty: false });
    }
  }, [
    sellableVariantCount,
    variants,
    variantStrategy,
    variantAxisKeys,
    resolvedItemId,
    setValue,
  ]);

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

  const showVariantsSection = isPhysical;
  const showCompositeItemSection = itemTypeSupportsComposition(itemType);
  const hasComposition = isBundle;
  const visibleSections = useMemo(
    () =>
      editorShellSections(resolvedItemId, hasComposition)
        .filter((section) => {
          if (section.id === "purchasable") return false;
          if (section.id === "salable") return false;
          if (section.id === "variants" && !showVariantsSection) return false;
          if (section.id === "composition" && !hasComposition) return false;
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
    [resolvedItemId, hasComposition, showVariantsSection, isPhysical, categoryFieldsTitle, categoryName]
  );
  const visibleSectionIds = useMemo(
    () => visibleSections.map((section) => section.id),
    [visibleSections]
  );

  const {
    activeSection,
    scrollRootRef,
    ignoreSpyUntilRef,
    scrollToSection,
    scrollToSectionRef: sectionNavScrollToSectionRef,
    registerSection,
  } = useItemEditorSectionNav({
    isPanelLayout,
    panelUseTopSectionTabs,
    panelRailHorizontal,
    itemId: resolvedItemId,
    formRef,
    panelScrollRef,
    chipBarRef,
    panelPaneWidth: panelPaneWidth ?? 0,
    visibleSectionIds,
  });
  scrollToSectionRef.current = sectionNavScrollToSectionRef.current;

  const variantCommitRef = useRef<(() => Promise<VariantMatrixCommitResult>) | null>(null);
  const compositionCommitRef = useRef<(() => Promise<CompositionCommitResult>) | null>(null);
  const [compositionDraft, setCompositionDraft] = useState<VariantMatrixDraftState | null>(null);
  const [compositionSectionDirty, setCompositionSectionDirty] = useState(false);

  const { sectionStatus: baseSectionStatus } = useItemEditorSectionStatus({
    errors,
    name,
    sku,
    baseUom,
    isSalable,
    isPurchasable,
    isPhysical,
    sellingPrice,
    mrp,
    purchasePrice,
    trackInventory,
    standardCost,
    variants,
    compositionDraft,
    media,
    variantAttributes,
    customFields,
    tagIds,
    storefrontVisibility,
  });

  const showVariantsWizardStage = shouldShowVariantsWizardStage({
    isMultiSku,
    variantAxisKeys,
    sellableVariantCount,
    variants,
  });

  const {
    activeWizardStage,
    sectionVisible,
    wizardStages,
    wizardStageStatuses,
    wizardPercent,
    renderStageAccordionHeader,
    wizardStepperActiveStage,
    wizardStepperOnSelect,
  } = useItemEditorWizardChrome({
    wizard,
    wizardAccordion,
    wizardSteps,
    isPanelLayout,
    isPhysical,
    hasComposition,
    showVariantsSection,
    showVariantsWizardStage,
    showCompositeItemSection,
    pinnedSections,
    itemId: resolvedItemId,
    sectionStatus: baseSectionStatus,
    panelScrollRef,
    scrollRootRef,
    ignoreSpyUntilRef,
  });

  const variantCompositionMode = resolveVariantCompositionMode({
    activeWizardStage,
    wizardActive: Boolean(wizard),
    wizardSteps,
  });
  const compositionDeferSave = Boolean(wizard && activeWizardStage === "composition");

  const {
    handleSave,
    submitPending,
    wizardPrimaryLabel,
    panelPrimaryAction,
    reachLocationsPersistErrorMessage,
    reachOpeningPersistErrorMessage,
    reachOpeningPersistErrorAction,
  } = useItemEditorSaveOrchestration({
    mode,
    isPanelLayout,
    readOnly,
    wizard,
    wizardSteps,
    activeWizardStage,
    variantCompositionMode,
    isMultiSku,
    hasComposition,
    isDirty,
    isPending,
    isNavigatePending,
    itemId: resolvedItemId,
    detail,
    catalogContext,
    form,
    getValues,
    setValue,
    handleSubmit,
    onSubmit,
    onSaved,
    onCancel,
    onMutationHeaderChange,
    onDirtyChange,
    compositionDraft,
    compositionSectionDirty,
    trackInventory,
    trackingMode,
    scrollToSection,
    scrollToSectionRef,
    itemSavedHandlerRef,
    pendingSaveOptionsRef,
    locationMatrixRef,
    openingStockMatrixRef,
    variantCommitRef,
    compositionCommitRef,
  });

  useEffect(() => {
    onWizardPrimaryLabelChange?.(wizard && wizardSteps ? wizardPrimaryLabel : null);
    return () => onWizardPrimaryLabelChange?.(null);
  }, [onWizardPrimaryLabelChange, wizard, wizardSteps, wizardPrimaryLabel]);

  const sectionStatus = useCallback(
    (id: SectionId): SectionStatus => {
      if (
        id === "visibility" &&
        (reachLocationsPersistErrorMessage || reachOpeningPersistErrorMessage)
      ) {
        return "error";
      }
      return baseSectionStatus(id);
    },
    [
      baseSectionStatus,
      reachLocationsPersistErrorMessage,
      reachOpeningPersistErrorMessage,
    ]
  );

  const isSectionMounted = useMountedEditorSections(activeSection, {
    wizardStage: activeWizardStage,
  });

  const loadExtensionData =
    Boolean(resolvedItemId) &&
    (      isSectionMounted("overview") ||
      isSectionMounted("purchasable") ||
      isSectionMounted("salable") ||
      isSectionMounted("variants") ||
      isSectionMounted("variant_rows") ||
      isSectionMounted("visibility"));

  // Category attributes that compose SKUs; category suggests defaults, author choice persists on item.
  const canSelectSingleSku = canSelectSingleVariantStrategy(sellableVariantCount);

  const usedVariantKeys = useMemo(() => usedVariantAttributeKeys(variants), [variants]);
  const suggestedVariantAxisKeys = useMemo(
    () => defaultVariantAxisKeys(compositionTemplates, usedVariantKeys),
    [compositionTemplates, usedVariantKeys]
  );
  const descriptiveAttributeTemplates = useMemo(
    () => splitTemplatesByAxis(compositionTemplates, variantAxisKeys).descriptive,
    [compositionTemplates, variantAxisKeys]
  );
  const variantAxisCategoryRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const previousCategory = variantAxisCategoryRef.current;
    variantAxisCategoryRef.current = categoryId;
    const current = getValues("variant_axes") ?? [];
    const filtered = sanitizeItemVariantAxisKeys(current, categoryTemplates, extraSkuOptions);
    const categoryChanged = previousCategory !== undefined && previousCategory !== categoryId;
    if (categoryChanged || filtered.length !== current.length) {
      setValue("variant_axes", filtered, { shouldDirty: categoryChanged });
    }
  }, [categoryId, categoryTemplates, extraSkuOptions, getValues, setValue]);

  useEffect(() => {
    const current = getValues("variant_attributes") ?? {};
    const descriptiveOnly = pickDescriptiveVariantAttributes(
      current,
      compositionTemplates,
      variantAxisKeys
    );
    if (JSON.stringify(descriptiveOnly) !== JSON.stringify(current)) {
      setValue("variant_attributes", descriptiveOnly, { shouldDirty: false });
    }
  }, [compositionTemplates, getValues, setValue, variantAxisKeys]);

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

  const {
    similarItems,
    nameCheckLoading,
    similarExpanded,
    setSimilarExpanded,
    checkDuplicatesOnNameBlur,
  } = useItemDuplicateCheck({
    itemId: resolvedItemId,
    readOnly,
    name,
    allowDuplicateItemNames: catalogContext.catalog_items.allow_duplicate_item_names,
    form,
  });

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
        initialValues.purchase_uom !== initialValues?.base_unit_of_measure
    )
  );

  useEffect(() => {
    if (purchaseUom.trim() && purchaseUom !== baseUom) {
      setShowPurchasableAdvanced(true);
    }
  }, [purchaseUom, baseUom]);

  useEffect(() => {
    if (showPurchaseConversionField) {
      setShowPurchasableAdvanced(true);
    }
  }, [showPurchaseConversionField]);

  const purchaseUnitConversionHint = useMemo(() => {
    if (!purchaseConversionFromCatalog || purchaseUom === baseUom) return undefined;
    return ITEM_EDITOR_FIELD_HELP.purchaseUnitFromAlternates(
      purchaseConversionFromCatalog,
      baseUom,
      purchaseUom
    );
  }, [baseUom, purchaseConversionFromCatalog, purchaseUom]);

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

  const stageBody = useItemEditorStageModels({
    renderStageAccordionHeader,
    sectionVisible,
    registerSection,
    isSectionMounted,
    isPanelLayout,
    wizard,
    mode,
    readOnly,
    similarItems,
    nameCheckLoading,
    similarExpanded,
    setSimilarExpanded,
    checkDuplicatesOnNameBlur,
    needsReview,
    register,
    errors,
    setValue,
    watch,
    disableInput,
    isLocked,
    catalogContext,
    categoryOptions,
    isMultiSku,
    variantStrategy,
    isPhysical,
    itemType,
    canSelectSingleSku,
    itemId: resolvedItemId,
    currentClassification,
    classificationOptions,
    hasComposition,
    isBundle,
    defaultTaxCategory,
    isTaxableCategory,
    itemTaxCodePickerOptions,
    taxCodeId,
    baseUom,
    alternateUoms,
    fieldDisabled,
    lengthCm,
    widthCm,
    heightCm,
    isActive,
    pricingFieldsLocked,
    isSalable,
    showSalableAdvanced,
    setShowSalableAdvanced,
    showSellingUnitField,
    sellingUom,
    commerceUomOptions,
    variants,
    priceBookUomCodes,
    isPurchasable,
    showPurchasableAdvanced,
    setShowPurchasableAdvanced,
    showPurchaseUnitField,
    showPurchaseConversionField,
    purchaseUom,
    purchaseCommerceUomOptions,
    purchaseUnitConversionHint,
    trackInventory,
    costingMethod,
    trackingMode,
    valuations,
    name,
    showVariantsSection,
    sellableVariantCount,
    categoryTemplates,
    compositionTemplates,
    extraSkuOptions,
    variantAxisKeys,
    suggestedVariantAxisKeys,
    skuMask,
    sku,
    sellingPrice,
    purchasePrice,
    standardCost,
    matrixMrpDefault,
    hsnSacCode,
    supplierId,
    deadWeightKg,
    shippingVolume,
    variantCompositionMode,
    variantCommitRef,
    setCompositionDraft,
    compositionDeferSave,
    compositionCommitRef,
    setCompositionSectionDirty,
    onVariantPatch,
    onVariantsReload,
    tenantId,
    media,
    onExtensionsChanged,
    activeWizardStage,
    descriptiveAttributeTemplates,
    categoryFieldsTitle,
    variantAttributes,
    tagOptions,
    setTagOptions,
    customFields,
    tagIds,
    storefrontVisibility,
    handleCatalogChange,
    defaultReorderPoint,
    hasListedChannels,
    reachLocationsPersistErrorMessage,
    locationMatrixRef,
    setDraftAssortmentCells,
    reachOpeningPersistErrorMessage,
    reachOpeningPersistErrorAction,
    openingStockMatrixRef,
    draftAssortmentCells,
  });

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

  const showWizardDrawerStageChrome = Boolean(wizard && isPanelLayout && wizardSteps);
  const wizardDrawerStageLabel =
    showWizardDrawerStageChrome && activeWizardStage
      ? editorStageById(activeWizardStage).label
      : null;

  return (
    <EditorPanelContext.Provider value={isPanelLayout}>
    <EditorFieldHelpProvider>
    <ItemExtensionDataProvider itemId={resolvedItemId} catalogContext={catalogContext} enabled={loadExtensionData}>
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
                  {sku?.trim() ? sku : "â€”"}
                </p>
                {detail ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Created {formatDate(detail.created_at)} Â· Updated {formatDate(detail.updated_at)}
                  </p>
                ) : null}
              </div>
            </div>
            {(
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="active">{itemTypeLabel(itemType)}</Badge>
                {resolvedItemId ? (
                  <Badge variant={isActive ? "completed" : "locked"}>
                    {itemOperationalStatusLabel(isActive)}
                  </Badge>
                ) : null}
                {needsReview ? <Badge variant="action_required">Needs review</Badge> : null}
              </div>
            )}
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
                wizardShowStepper && wizardUseLeftRail && isPanelLayout && editorPanelWizardBleedClass(),
                wizardShowStepper &&
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
        {wizardShowStepper && !wizardUseLeftRail ? (
          <div
            className={
              glassWizard
                ? editorWizardTopBarGlassClass(isPanelLayout)
                : editorWizardTopBarClass(isPanelLayout)
            }
          >
            <EditorStepper
              stages={wizardStages}
              activeStage={wizardStepperActiveStage}
              statuses={wizardStageStatuses}
              percent={wizardPercent}
              onSelect={wizardStepperOnSelect}
              freeNavigation={wizardAccordion}
              compact
              showDescription={false}
              surface={glassWizard ? "glass" : "default"}
            />
          </div>
        ) : null}

        {wizardShowStepper && wizardUseLeftRail ? (
          <aside
            className={
              glassWizard
                ? editorWizardLeftRailGlassAsideClass(isPanelLayout)
                : editorWizardLeftRailAsideClass(isPanelLayout)
            }
          >
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
                  surface={glassWizard ? "glass" : "default"}
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
                wizardShowStepper &&
                  wizardUseLeftRail &&
                  (isPanelLayout
                    ? editorPanelWizardFormScrollClass()
                    : "lg:h-full lg:flex-none lg:pl-4 lg:pr-1"),
                wizardShowStepper && !wizardUseLeftRail && isPanelLayout && "pt-4",
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
                {needsReview ? <Badge variant="action_required">Needs review</Badge> : null}
              </div>
              {resolvedItemId ? (
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
          {!readOnly ? (
            wizardDrawerStageLabel ? (
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-foreground">{wizardDrawerStageLabel}</h2>
                <EditorFieldHelpToggle />
              </div>
            ) : (
              <div className="flex justify-end">
                <EditorFieldHelpToggle />
              </div>
            )
          ) : null}
          <ItemEditorStageBody {...stageBody} />

          {!readOnly && panelPrimaryAction && !(wizard && wizardSteps && isPanelLayout) ? (
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

      {/* Sticky action bar â€” full page only; drawer uses header actions */}
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
                    {isNavigatePending ? "Leavingâ€¦" : "Cancel"}
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
                {isNavigatePending ? "Leavingâ€¦" : "Cancel"}
              </Button>
              <Button type="submit" disabled={submitPending || isNavigatePending} title="Save (Cmd/Ctrl + Enter)">
                {submitPending ? "Saving…" : mode === "edit" ? UPDATE_ITEM_LABEL : SAVE_ITEM_LABEL}
              </Button>
            </>
          )}
        </div>
      )}
    </form>
    </ItemExtensionDataProvider>
    </EditorFieldHelpProvider>
    </EditorPanelContext.Provider>
  );
}
