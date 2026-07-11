"use client";

import { useMemo, type ReactNode } from "react";
import { Check, Layers, Package, XCircle } from "lucide-react";
import { formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import {
  itemCostingMethodLabel,
  itemOperationalStatusLabel,
  itemTrackingModeLabel,
  itemTypeLabel,
  resolveItemTrackInventory,
} from "@/lib/products/item-model";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import { itemTaxCodePickerLabel } from "@/lib/tax/item-tax-code-picker";
import {
  BUY_PRICE_COLUMN,
  SELL_PRICE_COLUMN,
  SUMMARY_INHERITED_SUFFIX,
  SUMMARY_INVENTORY_ALL_VARIANTS_HELP,
  SUMMARY_INVENTORY_BUNDLE_OFF,
  SUMMARY_INVENTORY_OFF,
  SUMMARY_INVENTORY_SECTION,
  SUMMARY_INVENTORY_VARIANT_HELP,
  SUMMARY_INVENTORY_VARIANT_SECTION,
  SUMMARY_MASTER_DEFAULTS_HELP,
  SUMMARY_MASTER_DEFAULTS_SECTION,
  SUMMARY_MEDIA_EMPTY,
  SUMMARY_MEDIA_PRODUCT_HELP,
  SUMMARY_MEDIA_SECTION,
  SUMMARY_MEDIA_VARIANT_HELP,
  SUMMARY_PRODUCT_PROFILE,
  SUMMARY_PRODUCT_SECTION,
  SUMMARY_PRODUCT_SECTION_HELP,
  CATEGORY_FIELDS_SECTION_HELP,
  categoryFieldsSectionTitle,
  SUMMARY_VARIANT_LINE_HELP,
  SUMMARY_VARIANT_LINE_SECTION,
  SUMMARY_VIEWING_VARIANT,
  VARIANT_DEFAULT_BADGE,
  VARIANT_NOT_SOLD_BADGE,
  VARIANT_SKU_LABEL,
  VARIANTS_EMPTY_STATE,
  VARIANTS_PEEK_DESCRIPTION,
  VARIANTS_SECTION_LABEL,
  CATALOG_REACH_CHANNELS_EMPTY,
  CATALOG_REACH_CUSTOM_FIELDS_EMPTY,
  CATALOG_REACH_RECORD_SUBSECTION,
  CATALOG_REACH_TAB_LABEL,
  CATALOG_REACH_TAGS_EMPTY,
  CUSTOM_FIELDS_SECTION_HELP,
  CUSTOM_FIELDS_SECTION_LABEL,
  DISCOVERY_TAGS_SECTION_HELP,
  DISCOVERY_TAGS_SECTION_LABEL,
  VISIBILITY_CHANNELS_SUBSECTION,
  VISIBILITY_SECTION_HELP,
  VISIBILITY_SECTION_LABEL,
} from "@/lib/products/product-user-labels";
import {
  computeVolumeCm3FromDimensions,
  resolveShippingDimensionDefault,
} from "@/lib/products/shipping-dimensions";
import {
  filterSharedMedia,
  findMasterVariant,
  resolveMediaVariantSkuBadge,
  sortMediaEntries,
} from "@/lib/products/media-variants";
import {
  resolveEffectivePrimaryMediaId,
  resolveVariantMediaGallery,
} from "@/lib/products/primary-image";
import { variantStrategyLabel } from "@/lib/products/variant-strategy";
import { ProductMediaSummaryGallery } from "@/components/products/product-media-gallery";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  formatDescriptiveVariantAttributes,
  formatVariantAxisLabels,
} from "@/lib/products/variant-composition";
import {
  isDetailVariantSkuContext,
  resolveDetailIdentitySku,
  resolveMasterFormSku,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import { ProfileSectionCard } from "@/components/products/profile-section-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useElementWidth } from "@/lib/layout/use-element-width";
import {
  isPeekSectionLoaded,
  peekPanelToSection,
  resolveSellableVariantCount,
  resolveTotalVariantCount,
  type ProductPeekPanelId,
} from "@/lib/products/peek-panels";
import { cn } from "@/lib/utils";

type Props = {
  detail: ProductDetailSnapshot;
  currency: string;
  catalogContext?: ProductCatalogContext | null;
  categoryTemplates?: AttributeTemplateEntry[];
  /** Replaces the read-only gallery with an editor slot (e.g. ProductMediaGallery). */
  mediaEditable?: boolean;
  mediaEditorSlot?: ReactNode;
  peekPanel?: ProductPeekPanelId;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  peekPanelLoading?: ProductPeekPanelId | null;
  isValuationsLoading?: boolean;
  showContextBanner?: boolean;
};

const fieldLabelClass = "text-xs text-muted-foreground";
const fieldValueClass = "text-sm font-medium leading-snug text-foreground";
const fieldValueNumericClass = cn(fieldValueClass, "tabular-nums");

function fmtMoney(value: string | null | undefined, currency: string) {
  const num = value ? parseFloat(value) : NaN;
  if (!value || isNaN(num)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

function fmtQty(value: string | null | undefined, uom?: string) {
  if (!value) return "—";
  const num = parseFloat(value);
  if (isNaN(num)) return "—";
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
  return uom ? `${formatted} ${uom}` : formatted;
}

function fmtDim(value: string | null | undefined) {
  const num = parseFloat(String(value ?? ""));
  if (!value || isNaN(num) || num <= 0) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(num);
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

function hasPriceValue(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "0");
}

function InventoryRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Skeleton className="h-3.5 w-24 shimmer" />
      <Skeleton className="h-4 w-20 shimmer" />
    </div>
  );
}

function InventorySectionSkeleton({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <ProfileSectionCard title={title} description={description}>
      <InventoryRowSkeleton />
      <InventoryRowSkeleton />
      <InventoryRowSkeleton />
      <div className="mt-2 overflow-hidden rounded-md border border-border/60">
        <div className="border-b border-border bg-muted/40 px-2.5 py-1.5">
          <div className="flex justify-between gap-3">
            <Skeleton className="h-3 w-16 shimmer" />
            <Skeleton className="h-3 w-14 shimmer" />
            <Skeleton className="h-3 w-14 shimmer" />
          </div>
        </div>
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="flex justify-between gap-3 border-b border-border/40 px-2.5 py-2 last:border-0"
          >
            <Skeleton className="h-4 w-24 shimmer" />
            <Skeleton className="h-4 w-12 shimmer" />
            <Skeleton className="h-4 w-16 shimmer" />
          </div>
        ))}
      </div>
    </ProfileSectionCard>
  );
}

function Row({
  label,
  value,
  numeric = false,
  fullWidth = false,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  numeric?: boolean;
  fullWidth?: boolean;
  hint?: string;
}) {
  const valueClassName = numeric ? fieldValueNumericClass : fieldValueClass;

  if (fullWidth) {
    return (
      <div className="space-y-1 py-1.5">
        <p className={fieldLabelClass}>{label}</p>
        <div className={valueClassName}>{value ?? "—"}</div>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className={cn("shrink-0", fieldLabelClass)}>{label}</span>
      <span className={cn("min-w-0 text-right", valueClassName)}>
        {value ?? "—"}
        {hint ? (
          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </span>
    </div>
  );
}

function formatVariantAttributes(attrs: Record<string, unknown>): string {
  const entries = Object.entries(attrs).filter(([, v]) => v != null && String(v).trim() !== "");
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${String(v)}`).join(" · ");
}

function masterVariantBadgeLabel(variant: ProductVariantSnapshot): string {
  if (variant.is_master && variant.is_sellable === false) return VARIANT_NOT_SOLD_BADGE;
  return VARIANT_DEFAULT_BADGE;
}

type ResolvedDimension = { text: string; inherited: boolean };

function resolveDimensionDisplay(
  own: string | null | undefined,
  fallback: string | null | undefined
): ResolvedDimension | null {
  const resolved = resolveShippingDimensionDefault(own, fallback);
  if (!resolved || resolved === "0") return null;
  const ownTrimmed = String(own ?? "").trim();
  const hasOwn = Boolean(ownTrimmed && ownTrimmed !== "0");
  return { text: resolved, inherited: !hasOwn };
}

function formatDimensionsLwh(
  length: ResolvedDimension | null,
  width: ResolvedDimension | null,
  height: ResolvedDimension | null
): { text: string; inherited: boolean } | null {
  if (!length || !width || !height) return null;
  const inherited = length.inherited || width.inherited || height.inherited;
  return {
    text: `${length.text} × ${width.text} × ${height.text} cm`,
    inherited,
  };
}

function BehaviorFlagChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        enabled
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : "border-border/80 bg-muted/40 text-muted-foreground"
      )}
      aria-label={`${label}: ${enabled ? "yes" : "no"}`}
    >
      {enabled ? (
        <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden />
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      {label}
    </span>
  );
}

const BEHAVIOR_FLAG_LABELS = [
  { key: "salable", label: "Salable", getEnabled: (d: ProductDetailSnapshot) => d.is_salable },
  { key: "purchasable", label: "Purchasable", getEnabled: (d: ProductDetailSnapshot) => d.is_purchasable },
  { key: "returnable", label: "Returnable", getEnabled: (d: ProductDetailSnapshot) => d.is_returnable },
  {
    key: "track_inventory",
    label: "Track inventory",
    getEnabled: (d: ProductDetailSnapshot) => resolveItemTrackInventory(d),
  },
  {
    key: "bundle",
    label: "Sold as a set",
    getEnabled: (d: ProductDetailSnapshot) => d.is_bundle,
  },
] as const;

function SummaryContextBanner({
  detail,
  variantSkuContext,
  selectedVariant,
  productCode,
}: {
  detail: ProductDetailSnapshot;
  variantSkuContext: boolean;
  selectedVariant: ProductVariantSnapshot | null;
  productCode: string;
}) {
  const isMultiSku = detail.variant_strategy === "MULTI_SKU";
  const sellableCount = resolveSellableVariantCount(detail);

  if (variantSkuContext && selectedVariant) {
    const attributeLine = formatVariantAttributes(selectedVariant.variant_attributes);
    return (
      <div className="rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-background/80">
            <Layers className="h-4 w-4 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-primary/80">
              {SUMMARY_VIEWING_VARIANT}
            </p>
            <p className="font-mono text-base font-semibold leading-tight text-foreground">
              {selectedVariant.sku}
            </p>
            {attributeLine !== "—" ? (
              <p className="text-sm text-muted-foreground">{attributeLine}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge variant={selectedVariant.is_active ? "completed" : "locked"}>
                {selectedVariant.is_active ? "Active" : "Inactive"}
              </Badge>
              {hasText(productCode) && productCode !== selectedVariant.sku ? (
                <span className="text-xs text-muted-foreground">
                  Product code <span className="font-mono text-foreground">{productCode}</span>
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background/80">
          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {SUMMARY_PRODUCT_PROFILE}
          </p>
          <p className="font-mono text-base font-semibold leading-tight text-foreground">
            {productCode}
          </p>
          <p className="text-sm text-muted-foreground">
            {variantStrategyLabel(detail.variant_strategy)}
            {isMultiSku ? ` · ${sellableCount} sellable variant${sellableCount === 1 ? "" : "s"}` : null}
          </p>
        </div>
      </div>
    </div>
  );
}

function ShippingRows({
  weight,
  dimensions,
  volume,
}: {
  weight: ResolvedDimension | null;
  dimensions: { text: string; inherited: boolean } | null;
  volume: ResolvedDimension | null;
}) {
  const inheritedHint = (inherited: boolean) =>
    inherited ? `(${SUMMARY_INHERITED_SUFFIX})` : undefined;

  if (!weight && !dimensions && !volume) {
    return <p className="py-1 text-sm text-muted-foreground">No shipping dimensions set.</p>;
  }

  return (
    <>
      {weight ? (
        <Row
          label="Weight"
          value={`${weight.text} kg`}
          numeric
          hint={inheritedHint(weight.inherited)}
        />
      ) : null}
      {dimensions ? (
        <Row
          label="Dimensions (L×W×H)"
          value={dimensions.text}
          numeric
          hint={inheritedHint(dimensions.inherited)}
        />
      ) : null}
      {volume ? (
        <Row
          label="Volume"
          value={`${volume.text} cm³`}
          numeric
          hint={inheritedHint(volume.inherited)}
        />
      ) : null}
    </>
  );
}

function resolveShippingFromVariant(
  variant: ProductVariantSnapshot,
  master: ProductVariantSnapshot | null
) {
  const weight = resolveDimensionDisplay(variant.dead_weight_kg, master?.dead_weight_kg);
  const length = resolveDimensionDisplay(variant.length_cm, master?.length_cm);
  const width = resolveDimensionDisplay(variant.width_cm, master?.width_cm);
  const height = resolveDimensionDisplay(variant.height_cm, master?.height_cm);
  const dimensions = formatDimensionsLwh(length, width, height);
  const volumeRaw =
    computeVolumeCm3FromDimensions(
      length?.text ?? null,
      width?.text ?? null,
      height?.text ?? null
    ) ||
    resolveShippingDimensionDefault(variant.volume, master?.volume) ||
    null;
  const volumeText = volumeRaw && volumeRaw !== "0" ? volumeRaw : null;
  const volumeInherited =
    volumeText != null &&
    !hasText(variant.volume?.trim()) &&
    hasText(master?.volume?.trim());
  const volume: ResolvedDimension | null = volumeText
    ? { text: volumeText, inherited: volumeInherited }
    : null;

  return { weight, dimensions, volume };
}

function resolveShippingFromMaster(detail: ProductDetailSnapshot) {
  const weight = fmtDim(detail.dead_weight_kg);
  const dimensions =
    fmtDim(detail.length_cm) && fmtDim(detail.width_cm) && fmtDim(detail.height_cm)
      ? `${fmtDim(detail.length_cm)} × ${fmtDim(detail.width_cm)} × ${fmtDim(detail.height_cm)} cm`
      : null;
  const volume = fmtDim(detail.volume);
  return {
    weight: weight ? { text: weight, inherited: false } : null,
    dimensions: dimensions ? { text: dimensions, inherited: false } : null,
    volume: volume ? { text: volume, inherited: false } : null,
  };
}

function buildSummaryMediaEntries(
  detail: ProductDetailSnapshot,
  variantSkuContext: boolean
) {
  const masterVariant = findMasterVariant(detail.variants);
  const sharedMedia = filterSharedMedia(detail.media, masterVariant);
  const sharedIds = new Set(sharedMedia.map((entry) => entry.id));

  if (variantSkuContext && detail.variant_id) {
    const gallery = resolveVariantMediaGallery(
      detail.media,
      detail.variant_id,
      detail.variants
    );
    return gallery.map((entry) => {
      const inherited = sharedIds.has(entry.id) && entry.variant_id !== detail.variant_id;
      return {
        entry,
        inherited,
        variantSku: inherited
          ? null
          : resolveMediaVariantSkuBadge(entry.variant_id, detail.variants, masterVariant),
      };
    });
  }

  const variantOnly = sortMediaEntries(
    detail.media.filter(
      (entry) =>
        entry.variant_id !== null &&
        entry.variant_id !== masterVariant?.id &&
        !sharedIds.has(entry.id)
    )
  );

  return [
    ...sharedMedia.map((entry) => ({
      entry,
      inherited: false,
      variantSku: resolveMediaVariantSkuBadge(entry.variant_id, detail.variants, masterVariant),
    })),
    ...variantOnly.map((entry) => ({
      entry,
      inherited: false,
      variantSku: resolveMediaVariantSkuBadge(entry.variant_id, detail.variants, masterVariant),
    })),
  ];
}

export function ProductItemSummaryCard({
  detail,
  currency,
  catalogContext,
  categoryTemplates = [],
  mediaEditable = false,
  mediaEditorSlot,
  peekPanel = "essentials",
  onPeekPanelChange,
  peekPanelLoading = null,
  isValuationsLoading = false,
  showContextBanner = true,
}: Props) {
  const { ref: layoutRef, width: layoutWidth } = useElementWidth<HTMLDivElement>();
  const twoColumns = layoutWidth != null && layoutWidth >= 720;

  const taxCodeLabel = useMemo(() => {
    if (!detail.tax_code_id || !catalogContext) return null;
    const row = catalogContext.tax_codes.find((t) => t.id === detail.tax_code_id);
    if (!row) return null;
    return itemTaxCodePickerLabel(row);
  }, [catalogContext, detail.tax_code_id]);

  const priceBookNameById = useMemo(() => {
    const map = new Map<string, string>();
    catalogContext?.price_books.forEach((pb) => map.set(pb.id, pb.name));
    return map;
  }, [catalogContext?.price_books]);

  const isPhysical = detail.item_type === "PHYSICAL";
  const tracksInventory = resolveItemTrackInventory(detail);
  const isMultiSku = detail.variant_strategy === "MULTI_SKU";
  const productAttributeSummary = useMemo(
    () =>
      formatDescriptiveVariantAttributes(
        detail.variant_attributes,
        categoryTemplates,
        detail.variant_axes
      ),
    [categoryTemplates, detail.variant_attributes, detail.variant_axes]
  );
  const variesBySummary = useMemo(
    () => formatVariantAxisLabels(detail.variant_axes, categoryTemplates),
    [categoryTemplates, detail.variant_axes]
  );
  const variantSkuContext = isDetailVariantSkuContext(detail);
  const productCode = isMultiSku ? resolveMasterFormSku(detail) : resolveDetailIdentitySku(detail);
  const masterVariant = detail.variants.find((v) => v.is_master) ?? null;
  const selectedVariant =
    detail.variants.find((v) => v.id === detail.variant_id) ??
    (variantSkuContext ? null : masterVariant);

  const sellableVariants = detail.variants.filter((v) => !v.is_master);
  const showSellableVariantRows = isMultiSku || detail.has_variants;
  const tableVariants = showSellableVariantRows ? sellableVariants : detail.variants;
  const visibleStorefronts = detail.storefront_visibility.filter((s) => s.is_visible);

  const totalStock = detail.valuations.reduce(
    (sum, v) => sum + (parseFloat(v.total_quantity_on_hand) || 0),
    0
  );

  const variantShipping =
    variantSkuContext && selectedVariant
      ? resolveShippingFromVariant(selectedVariant, masterVariant)
      : null;
  const masterShipping = isPhysical && isMultiSku && !variantSkuContext
    ? resolveShippingFromMaster(detail)
    : null;
  const singleShipping =
    isPhysical && !isMultiSku ? resolveShippingFromMaster(detail) : null;

  const showVariantGtin = tableVariants.some((v) => hasText(v.barcode));
  const showVariantWeight =
    isPhysical && tableVariants.some((v) => resolveShippingFromVariant(v, masterVariant).weight);
  const showVariantDimensions =
    isPhysical &&
    tableVariants.some((v) => resolveShippingFromVariant(v, masterVariant).dimensions);

  const variantSellPrice = selectedVariant?.price;
  const variantBuyPrice = selectedVariant?.purchase_price;

  const summaryMediaEntries = useMemo(
    () => buildSummaryMediaEntries(detail, variantSkuContext),
    [detail, variantSkuContext]
  );
  const summaryMediaPrimaryId = useMemo(
    () =>
      resolveEffectivePrimaryMediaId(
        summaryMediaEntries.map(({ entry }) => entry),
        variantSkuContext && detail.variant_id
          ? {
              variantId: detail.variant_id,
              masterVariantId: masterVariant?.id ?? null,
            }
          : { masterVariantId: masterVariant?.id ?? null }
      ),
    [detail.variant_id, masterVariant?.id, summaryMediaEntries, variantSkuContext]
  );
  const storefrontVisibleCount = detail.media.filter((entry) => entry.show_on_storefront).length;
  const usePeekTabs = Boolean(onPeekPanelChange);
  const showVariantsTab =
    isMultiSku ||
    detail.has_variants ||
    resolveTotalVariantCount(detail) > 1 ||
    sellableVariants.length > 0;
  const activeSection = peekPanelToSection(peekPanel);
  const isActivePanelLoading =
    Boolean(activeSection) &&
    !isPeekSectionLoaded(detail, activeSection!) &&
    peekPanelLoading === peekPanel;
  const showPanel = (panel: ProductPeekPanelId) => !usePeekTabs || peekPanel === panel;

  return (
    <div ref={layoutRef} className="space-y-3 p-3 pb-6">
      {showContextBanner ? (
        <SummaryContextBanner
          detail={detail}
          variantSkuContext={variantSkuContext}
          selectedVariant={selectedVariant}
          productCode={productCode}
        />
      ) : null}

      {usePeekTabs ? (
        <Tabs
          value={peekPanel}
          onValueChange={(value) => onPeekPanelChange?.(value as ProductPeekPanelId)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="essentials" className="flex-1">
              Essentials
            </TabsTrigger>
            {showVariantsTab ? (
              <TabsTrigger value="variants" className="flex-1">
                Variants
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="media" className="flex-1">
              Media
            </TabsTrigger>
            <TabsTrigger value="reach" className="flex-1">
              {CATALOG_REACH_TAB_LABEL}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {isActivePanelLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
      <div
        className={cn(
          "grid gap-3",
          twoColumns ? "grid-cols-2 items-start" : "grid-cols-1"
        )}
      >
        {showPanel("media") ? (
        <ProfileSectionCard
          title={SUMMARY_MEDIA_SECTION}
          description={
            variantSkuContext ? SUMMARY_MEDIA_VARIANT_HELP : SUMMARY_MEDIA_PRODUCT_HELP
          }
          className={twoColumns ? "col-span-full" : undefined}
        >
          {mediaEditable && mediaEditorSlot ? (
            mediaEditorSlot
          ) : summaryMediaEntries.length > 0 ? (
            <ProductMediaSummaryGallery
              entries={summaryMediaEntries}
              effectivePrimaryId={summaryMediaPrimaryId}
            />
          ) : (
            <p className="py-1 text-sm text-muted-foreground">{SUMMARY_MEDIA_EMPTY}</p>
          )}
          {summaryMediaEntries.length > 0 ? (
            <div className="mt-2 space-y-0 border-t border-border/40 pt-2">
              <Row
                label="Images"
                value={`${summaryMediaEntries.length} in this view`}
              />
              <Row
                label="Storefront"
                value={
                  storefrontVisibleCount > 0
                    ? `${storefrontVisibleCount} visible`
                    : "None flagged"
                }
              />
            </div>
          ) : null}
        </ProfileSectionCard>
        ) : null}

        {showPanel("essentials") ? (
        <>
        <ProfileSectionCard
          title={SUMMARY_PRODUCT_SECTION}
          description={SUMMARY_PRODUCT_SECTION_HELP}
        >
          {hasText(detail.description) ? (
            <Row
              label="Description"
              fullWidth
              value={
                <span className="font-normal leading-relaxed whitespace-pre-wrap">
                  {detail.description}
                </span>
              }
            />
          ) : null}
          <Row label="Item type" value={itemTypeLabel(detail.item_type)} />
          <Row label="Status" value={itemOperationalStatusLabel(detail.is_active)} />
          <Row label="Variant nature" value={variantStrategyLabel(detail.variant_strategy)} />
          {!variantSkuContext ? (
            <Row
              label={isMultiSku ? "Product code" : "SKU"}
              value={productCode}
            />
          ) : null}
          <Row
            label="Category"
            value={hasText(detail.category_name) ? detail.category_name : ""}
          />
          <Row label="Supply-chain role" value={classificationLabel(detail.classification)} />
          {isMultiSku && variesBySummary ? (
            <Row label="Varies by" value={variesBySummary} />
          ) : null}
          {productAttributeSummary && !usePeekTabs ? (
            <Row
              label={categoryFieldsSectionTitle(detail.category_name)}
              value={productAttributeSummary}
            />
          ) : null}
          {detail.needs_review ? <Row label="Review" value="Needs review" /> : null}
          <div className="border-t border-border/40 pt-2">
            <p className={cn(fieldLabelClass, "mb-1.5")}>Behavior</p>
            <div className="flex flex-wrap gap-1.5">
              {BEHAVIOR_FLAG_LABELS.map((flag) => (
                <BehaviorFlagChip
                  key={flag.key}
                  label={flag.label}
                  enabled={flag.getEnabled(detail)}
                />
              ))}
            </div>
          </div>
        </ProfileSectionCard>

        {variantSkuContext && selectedVariant ? (
          <ProfileSectionCard
            title={SUMMARY_VARIANT_LINE_SECTION}
            description={SUMMARY_VARIANT_LINE_HELP}
          >
            <Row label={VARIANT_SKU_LABEL} value={selectedVariant.sku} />
            <Row
              label="Attributes"
              value={formatVariantAttributes(selectedVariant.variant_attributes)}
            />
            <Row label="GTIN" value={hasText(selectedVariant.barcode) ? selectedVariant.barcode : ""} />
            <Row
              label="Status"
              value={
                <Badge variant={selectedVariant.is_active ? "completed" : "locked"}>
                  {selectedVariant.is_active ? "Active" : "Inactive"}
                </Badge>
              }
            />
            <Row
              label={SELL_PRICE_COLUMN}
              value={fmtMoney(variantSellPrice, currency)}
              numeric
            />
            <Row
              label={BUY_PRICE_COLUMN}
              value={fmtMoney(variantBuyPrice, currency)}
              numeric
            />
            {isPhysical ? (
              <div className="border-t border-border/40 pt-1">
                <p className={cn(fieldLabelClass, "py-2")}>Shipping</p>
                <ShippingRows
                  weight={variantShipping?.weight ?? null}
                  dimensions={variantShipping?.dimensions ?? null}
                  volume={variantShipping?.volume ?? null}
                />
              </div>
            ) : null}
          </ProfileSectionCard>
        ) : null}

        {!variantSkuContext && isMultiSku && isPhysical && masterVariant ? (
          <ProfileSectionCard
            title={SUMMARY_MASTER_DEFAULTS_SECTION}
            description={SUMMARY_MASTER_DEFAULTS_HELP}
          >
            <Row
              label="Master SKU"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-mono">{masterVariant.sku}</span>
                  <Badge variant="default" className="text-[10px]">
                    {masterVariantBadgeLabel(masterVariant)}
                  </Badge>
                </span>
              }
            />
            <ShippingRows
              weight={masterShipping?.weight ?? null}
              dimensions={masterShipping?.dimensions ?? null}
              volume={masterShipping?.volume ?? null}
            />
          </ProfileSectionCard>
        ) : null}

        {!variantSkuContext && !isMultiSku ? (
          <ProfileSectionCard title="Identifiers" description="SKU, tax, and regulatory codes">
            <Row label="SKU" value={productCode} />
            {hasText(detail.barcode) ? <Row label="GTIN" value={detail.barcode} /> : null}
            <Row label="Tax" value={taxCategoryLabel(detail.default_tax_category)} />
            <Row label="Rule" value={taxCodeLabel ?? ""} />
            <Row label="HSN" value={hasText(detail.hsn_sac_code) ? detail.hsn_sac_code : ""} />
            {isPhysical && singleShipping ? (
              <div className="border-t border-border/40 pt-1">
                <p className={cn(fieldLabelClass, "py-2")}>Shipping</p>
                <ShippingRows
                  weight={singleShipping.weight}
                  dimensions={singleShipping.dimensions}
                  volume={singleShipping.volume}
                />
              </div>
            ) : null}
          </ProfileSectionCard>
        ) : null}

        <ProfileSectionCard title="Units" description="Stock and alternate units of measure">
          <Row label="Base unit" value={detail.base_unit_of_measure} />
          {detail.alternate_uoms.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              {detail.alternate_uoms.map((row) => (
                <div
                  key={row.uom_code}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2 py-1.5"
                >
                  <span className={fieldValueClass}>{row.uom_code}</span>
                  <span className={cn(fieldValueClass, "text-muted-foreground tabular-nums")}>
                    1 = {row.conversion_factor} {detail.base_unit_of_measure}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Row label="Alternate units" value="None" />
          )}
          <Row label="Selling UOM" value={detail.selling_uom} />
          <Row label="Purchase UOM" value={detail.purchase_uom} />
          {detail.purchase_uom !== detail.base_unit_of_measure ? (
            <Row
              label="Purchase conversion"
              value={`1 ${detail.purchase_uom} = ${detail.purchase_uom_conversion} ${detail.base_unit_of_measure}`}
              numeric
            />
          ) : null}
        </ProfileSectionCard>

        {!variantSkuContext ? (
          <ProfileSectionCard title="Pricing" description="Default sell and buy rates for this product">
            <Row label="Selling rate" value={fmtMoney(detail.selling_price, currency)} numeric />
            <Row label="Purchase rate" value={fmtMoney(detail.purchase_price, currency)} numeric />
            {parseFloat(detail.standard_cost) > 0 ? (
              <Row label="Standard cost" value={fmtMoney(detail.standard_cost, currency)} numeric />
            ) : null}
            {isMultiSku ? (
              <Row label="Tax" value={taxCategoryLabel(detail.default_tax_category)} />
            ) : null}
            {isMultiSku ? <Row label="Rule" value={taxCodeLabel ?? ""} /> : null}
            {isMultiSku ? (
              <Row label="HSN" value={hasText(detail.hsn_sac_code) ? detail.hsn_sac_code : ""} />
            ) : null}
          </ProfileSectionCard>
        ) : null}

        {tracksInventory ? (
          isValuationsLoading && detail.valuations.length === 0 ? (
            <InventorySectionSkeleton
              title={variantSkuContext ? SUMMARY_INVENTORY_VARIANT_SECTION : SUMMARY_INVENTORY_SECTION}
              description={
                variantSkuContext
                  ? SUMMARY_INVENTORY_VARIANT_HELP
                  : isMultiSku
                    ? SUMMARY_INVENTORY_ALL_VARIANTS_HELP
                    : "Stock levels and costing"
              }
            />
          ) : (
            <ProfileSectionCard
              title={variantSkuContext ? SUMMARY_INVENTORY_VARIANT_SECTION : SUMMARY_INVENTORY_SECTION}
              description={
                variantSkuContext
                  ? SUMMARY_INVENTORY_VARIANT_HELP
                  : isMultiSku
                    ? SUMMARY_INVENTORY_ALL_VARIANTS_HELP
                    : "Stock levels and costing"
              }
            >
              <Row
                label="Total on hand"
                value={fmtQty(String(totalStock), detail.base_unit_of_measure)}
                numeric
              />
              <Row label="Costing method" value={itemCostingMethodLabel(detail.costing_method)} />
              <Row label="Tracking mode" value={itemTrackingModeLabel(detail.tracking_mode)} />
              {detail.valuations.length > 0 ? (
                <div className="table-chrome-frame mt-2 overflow-x-auto rounded-md border border-border/60">
                  <table
                    data-header-tone="subtle"
                    className="table-chrome w-full min-w-[16rem] border-separate border-spacing-0"
                  >
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className={cn("px-2.5 py-1.5", fieldLabelClass)}>Location</th>
                        <th className={cn("px-2.5 py-1.5 text-right", fieldLabelClass)}>On hand</th>
                        <th className={cn("px-2.5 py-1.5 text-right", fieldLabelClass)}>Avg cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.valuations.map((v, index) => (
                        <tr
                          key={`${v.location_id}:${index}`}
                          className="border-b border-border/40 last:border-0"
                        >
                          <td className={cn("px-2.5 py-1.5", fieldValueClass)}>{v.location_name}</td>
                          <td className={cn("px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                            {fmtQty(v.total_quantity_on_hand, detail.base_unit_of_measure)}
                          </td>
                          <td className={cn("px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                            {fmtMoney(v.current_average_cost, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </ProfileSectionCard>
          )
        ) : isPhysical ? (
          <ProfileSectionCard title={SUMMARY_INVENTORY_SECTION} description="Stock tracking">
            <p className="py-1 text-sm text-muted-foreground">
              {detail.is_bundle ? SUMMARY_INVENTORY_BUNDLE_OFF : SUMMARY_INVENTORY_OFF}
            </p>
          </ProfileSectionCard>
        ) : null}

        {hasText(detail.supplier_name) ? (
          <ProfileSectionCard title="Supply" description="Preferred supplier">
            <Row label="Supplier" value={detail.supplier_name} />
          </ProfileSectionCard>
        ) : null}
        </>
        ) : null}

        {showPanel("variants") &&
        (isMultiSku || detail.has_variants || sellableVariants.length > 0 || detail.variants.length > 1) ? (
          <ProfileSectionCard
            title={VARIANTS_SECTION_LABEL}
            description={VARIANTS_PEEK_DESCRIPTION(
              sellableVariants.filter((v) => v.is_sellable !== false).length,
              resolveTotalVariantCount(detail)
            )}
            className={twoColumns ? "col-span-full" : undefined}
          >
            {tableVariants.length === 0 ? (
              <p className="text-sm text-muted-foreground">{VARIANTS_EMPTY_STATE}</p>
            ) : (
              <div className="table-chrome-frame max-h-56 overflow-x-auto overflow-y-auto rounded-md border border-border/60">
                <table data-header-tone="sticky" className="table-chrome w-max min-w-full border-separate border-spacing-0 text-sm">
                  <thead className="sticky top-0 z-[1]">
                    <tr className="border-b border-border text-left">
                      <th className={cn("whitespace-nowrap px-2.5 py-1.5", fieldLabelClass)}>
                        {VARIANT_SKU_LABEL}
                      </th>
                      {showVariantGtin ? (
                        <th className={cn("whitespace-nowrap px-2.5 py-1.5", fieldLabelClass)}>
                          GTIN
                        </th>
                      ) : null}
                      <th className={cn("min-w-[10rem] px-2.5 py-1.5", fieldLabelClass)}>
                        Attributes
                      </th>
                      <th className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldLabelClass)}>
                        {SELL_PRICE_COLUMN}
                      </th>
                      <th className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldLabelClass)}>
                        {BUY_PRICE_COLUMN}
                      </th>
                      {showVariantWeight ? (
                        <th className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldLabelClass)}>
                          Weight
                        </th>
                      ) : null}
                      {showVariantDimensions ? (
                        <th className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldLabelClass)}>
                          Dimensions
                        </th>
                      ) : null}
                      <th className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldLabelClass)}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableVariants.map((v) => {
                      const shipping = resolveShippingFromVariant(v, masterVariant);
                      const isSelected = variantSkuContext && v.id === detail.variant_id;
                      const weightLabel = shipping.weight
                        ? `${shipping.weight.text} kg${shipping.weight.inherited ? "*" : ""}`
                        : "—";
                      const dimLabel = shipping.dimensions
                        ? `${shipping.dimensions.text}${shipping.dimensions.inherited ? "*" : ""}`
                        : "—";

                      return (
                        <tr
                          key={v.id}
                          className={cn(
                            "border-b border-border/40 last:border-0",
                            isSelected && "bg-primary/8"
                          )}
                        >
                          <td className={cn("whitespace-nowrap px-2.5 py-1.5", fieldValueClass)}>
                            <span className="font-mono">{v.sku}</span>
                            {isSelected ? (
                              <Badge variant="active" className="ml-1.5 text-[10px]">
                                Open
                              </Badge>
                            ) : null}
                          </td>
                          {showVariantGtin ? (
                            <td className={cn("whitespace-nowrap px-2.5 py-1.5 font-mono", fieldValueClass)}>
                              {hasText(v.barcode) ? v.barcode : "—"}
                            </td>
                          ) : null}
                          <td
                            className={cn(
                              "max-w-[14rem] px-2.5 py-1.5 font-normal text-muted-foreground",
                              fieldValueClass
                            )}
                          >
                            <span className="line-clamp-2">
                              {formatVariantAttributes(v.variant_attributes)}
                            </span>
                          </td>
                          <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                            {hasPriceValue(v.price) ? fmtMoney(v.price, currency) : "—"}
                          </td>
                          <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                            {hasPriceValue(v.purchase_price) ? fmtMoney(v.purchase_price, currency) : "—"}
                          </td>
                          {showVariantWeight ? (
                            <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                              {weightLabel}
                            </td>
                          ) : null}
                          {showVariantDimensions ? (
                            <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                              {dimLabel}
                            </td>
                          ) : null}
                          <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueClass)}>
                            <Badge variant={v.is_active ? "completed" : "locked"}>
                              {v.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {showVariantWeight || showVariantDimensions ? (
                  <p className="border-t border-border/50 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    * {SUMMARY_INHERITED_SUFFIX} from variant defaults
                  </p>
                ) : null}
              </div>
            )}
          </ProfileSectionCard>
        ) : null}

        {showPanel("reach") ? (
        <>
          {productAttributeSummary ? (
            <ProfileSectionCard
              title={categoryFieldsSectionTitle(detail.category_name)}
              description={CATEGORY_FIELDS_SECTION_HELP}
            >
              <Row label="Attributes" value={productAttributeSummary} />
            </ProfileSectionCard>
          ) : null}

          <ProfileSectionCard
            title={CUSTOM_FIELDS_SECTION_LABEL}
            description={CUSTOM_FIELDS_SECTION_HELP}
          >
            {detail.custom_fields.length > 0 ? (
              detail.custom_fields.map((field) => (
                <Row key={field.key} label={field.key} value={field.value || "—"} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{CATALOG_REACH_CUSTOM_FIELDS_EMPTY}</p>
            )}
          </ProfileSectionCard>

          <ProfileSectionCard
            title={DISCOVERY_TAGS_SECTION_LABEL}
            description={DISCOVERY_TAGS_SECTION_HELP}
          >
            {detail.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 py-0.5">
                {detail.tags.map((tag) => (
                  <Badge key={tag.id} variant="administrative">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{CATALOG_REACH_TAGS_EMPTY}</p>
            )}
          </ProfileSectionCard>

          <ProfileSectionCard
            title={VISIBILITY_SECTION_LABEL}
            description={VISIBILITY_SECTION_HELP}
          >
            <p className={cn(fieldLabelClass, "mb-1.5 font-medium text-foreground/80")}>
              {VISIBILITY_CHANNELS_SUBSECTION}
            </p>
            {visibleStorefronts.length > 0 ? (
              <div className="space-y-1.5">
                {visibleStorefronts.map((row) => (
                  <div
                    key={row.storefront_id}
                    className="flex items-start justify-between gap-2 rounded-md border border-border/50 px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className={fieldValueClass}>{row.storefront_name}</p>
                      <p className={fieldLabelClass}>{row.channel_type}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {row.store_custom_name ? (
                        <p className={fieldValueClass}>{row.store_custom_name}</p>
                      ) : null}
                      {row.store_price_book_id ? (
                        <p className={cn(fieldValueClass, "font-normal text-muted-foreground")}>
                          {priceBookNameById.get(row.store_price_book_id) ?? "Price book"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{CATALOG_REACH_CHANNELS_EMPTY}</p>
            )}
          </ProfileSectionCard>

          <ProfileSectionCard title={CATALOG_REACH_RECORD_SUBSECTION} description="Audit trail">
            <Row label="Source" value={detail.source.replace(/_/g, " ")} />
            <Row label="Created" value={formatDate(detail.created_at)} />
            <Row label="Updated" value={formatDate(detail.updated_at)} />
          </ProfileSectionCard>
        </>
        ) : null}
      </div>
      )}
    </div>
  );
}
