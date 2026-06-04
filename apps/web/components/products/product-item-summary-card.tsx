"use client";

import { useMemo } from "react";
import { Check, XCircle } from "lucide-react";
import { formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import {
  itemCostingMethodLabel,
  itemOperationalStatusLabel,
  itemTrackingModeLabel,
  itemTypeLabel,
} from "@/lib/products/item-model";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import { itemTaxCodePickerLabel } from "@/lib/tax/item-tax-code-picker";
import {
  BUY_PRICE_COLUMN,
  SELL_PRICE_COLUMN,
  VARIANT_DEFAULT_BADGE,
  VARIANT_NOT_SOLD_BADGE,
  VARIANTS_EMPTY_STATE,
  VARIANTS_PEEK_DESCRIPTION,
  VARIANTS_SECTION_LABEL,
} from "@/lib/products/product-user-labels";
import { variantStrategyLabel } from "@/lib/products/variant-strategy";
import type {
  ProductCatalogContext,
  ProductDetailSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import { ProfileSectionCard } from "@/components/products/profile-section-card";
import { Badge } from "@/components/ui/badge";
import { useElementWidth } from "@/lib/layout/use-element-width";
import { cn } from "@/lib/utils";

type Props = {
  detail: ProductDetailSnapshot;
  currency: string;
  catalogContext?: ProductCatalogContext | null;
};

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

function fmtDim(value: string) {
  const num = parseFloat(value);
  if (!value || isNaN(num) || num <= 0) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(num);
}

function hasText(value: string | null | undefined) {
  return Boolean(value?.trim());
}

const fieldLabelClass = "text-xs text-muted-foreground";
const fieldValueClass = "text-sm font-medium leading-snug text-foreground";
const fieldValueNumericClass = cn(fieldValueClass, "tabular-nums");

function Row({
  label,
  value,
  numeric = false,
  fullWidth = false,
}: {
  label: string;
  value: React.ReactNode;
  /** Right-align numbers with tabular figures; same sans typeface as other values. */
  numeric?: boolean;
  fullWidth?: boolean;
}) {
  const valueClassName = numeric ? fieldValueNumericClass : fieldValueClass;

  if (fullWidth) {
    return (
      <div className="space-y-1 py-1.5">
        <p className={fieldLabelClass}>{label}</p>
        <div className={valueClassName}>{value ?? "—"}</div>
      </div>
    );
  }
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <span className={cn("shrink-0", fieldLabelClass)}>{label}</span>
      <span className={cn("min-w-0 text-right", valueClassName)}>{value ?? "—"}</span>
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

function variantWeightLabel(variant: ProductVariantSnapshot): string | null {
  const kg = fmtDim(variant.dead_weight_kg);
  return kg != null ? `${kg} kg` : null;
}

function BehaviorFlagChip({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
        enabled
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
          : "border-border/70 bg-muted/35 text-muted-foreground"
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
    getEnabled: (d: ProductDetailSnapshot) => d.track_inventory,
  },
  { key: "bundle", label: "Bundle", getEnabled: (d: ProductDetailSnapshot) => d.is_bundle },
] as const;

export function ProductItemSummaryCard({ detail, currency, catalogContext }: Props) {
  const { ref: layoutRef, width: layoutWidth } = useElementWidth<HTMLDivElement>();
  const twoColumns = layoutWidth >= 720;

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

  const totalStock = detail.valuations.reduce(
    (sum, v) => sum + (parseFloat(v.total_quantity_on_hand) || 0),
    0
  );

  const isPhysical = detail.item_type === "PHYSICAL";
  const isMultiSku = detail.variant_strategy === "MULTI_SKU";
  const sellableVariants = detail.variants.filter((v) => v.is_sellable);
  const visibleStorefronts = detail.storefront_visibility.filter((s) => s.is_visible);
  const weightKg = fmtDim(detail.dead_weight_kg);
  const dimensionsCm =
    fmtDim(detail.length_cm) && fmtDim(detail.width_cm) && fmtDim(detail.height_cm)
      ? `${fmtDim(detail.length_cm)} × ${fmtDim(detail.width_cm)} × ${fmtDim(detail.height_cm)} cm`
      : null;
  const volume = fmtDim(detail.volume);
  const hasShipping =
    isPhysical && (weightKg != null || dimensionsCm != null || volume != null);

  const showVariantGtin = detail.variants.some((v) => hasText(v.barcode));
  const showVariantWeight =
    isPhysical && detail.variants.some((v) => variantWeightLabel(v) != null);
  const showVariantSellable = isMultiSku;

  return (
    <div ref={layoutRef} className="p-3 pb-6">
      <div
        className={cn(
          "grid gap-3",
          twoColumns ? "grid-cols-2 items-start" : "grid-cols-1"
        )}
      >
        <ProfileSectionCard
          title="Identity"
          description="Type, status, identifiers, classification, and operational behavior"
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
          <Row label="SKU" value={detail.sku} />
          {hasText(detail.code) &&
          detail.code.trim().toLowerCase() !== detail.sku.trim().toLowerCase() ? (
            <Row label="Item code" value={detail.code} />
          ) : null}
          {hasText(detail.barcode) ? <Row label="GTIN" value={detail.barcode} /> : null}
          <Row
            label="Category"
            value={hasText(detail.category_name) ? detail.category_name : ""}
          />
          <Row label="Supply-chain role" value={classificationLabel(detail.classification)} />
          {isMultiSku && detail.variant_axes.length > 0 ? (
            <Row label="Variant axes" value={detail.variant_axes.join(", ")} />
          ) : null}
          {detail.needs_review ? (
            <Row label="Review" value="Needs review" />
          ) : null}
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

        <ProfileSectionCard title="Pricing" description="Default sell and buy rates">
          <Row label="Selling rate" value={fmtMoney(detail.selling_price, currency)} numeric />
          <Row label="Purchase rate" value={fmtMoney(detail.purchase_price, currency)} numeric />
          {parseFloat(detail.standard_cost) > 0 ? (
            <Row label="Standard cost" value={fmtMoney(detail.standard_cost, currency)} numeric />
          ) : null}
          <Row label="Tax" value={taxCategoryLabel(detail.default_tax_category)} />
          <Row label="Rule" value={taxCodeLabel ?? ""} />
          <Row
            label="HSN"
            value={hasText(detail.hsn_sac_code) ? detail.hsn_sac_code : ""}
          />
        </ProfileSectionCard>

        {detail.track_inventory ? (
          <ProfileSectionCard title="Inventory" description="Stock levels and costing">
            <Row
              label="Total on hand"
              value={fmtQty(String(totalStock), detail.base_unit_of_measure)}
              numeric
            />
            <Row label="Costing method" value={itemCostingMethodLabel(detail.costing_method)} />
            <Row label="Tracking mode" value={itemTrackingModeLabel(detail.tracking_mode)} />
            {detail.valuations.length > 0 ? (
              <div className="mt-2 overflow-x-auto rounded-md border border-border/60">
                <table className="w-full min-w-[16rem]">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-left">
                      <th className={cn("px-2.5 py-1.5", fieldLabelClass)}>Location</th>
                      <th className={cn("px-2.5 py-1.5 text-right", fieldLabelClass)}>On hand</th>
                      <th className={cn("px-2.5 py-1.5 text-right", fieldLabelClass)}>Avg cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.valuations.map((v) => (
                      <tr key={v.location_id} className="border-b border-border/40 last:border-0">
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
        ) : isPhysical ? (
          <ProfileSectionCard title="Inventory" description="Stock tracking">
            <p className="py-1 text-sm text-muted-foreground">Inventory tracking is off for this item.</p>
          </ProfileSectionCard>
        ) : null}

        {hasText(detail.supplier_name) ? (
          <ProfileSectionCard title="Supply" description="Preferred supplier">
            <Row label="Supplier" value={detail.supplier_name} />
          </ProfileSectionCard>
        ) : null}

        {(isMultiSku || detail.variants.length > 0) && (
          <ProfileSectionCard
            title={VARIANTS_SECTION_LABEL}
            description={VARIANTS_PEEK_DESCRIPTION(
              sellableVariants.length,
              detail.variants.length
            )}
          >
            {detail.variants.length === 0 ? (
              <p className="text-sm text-muted-foreground">{VARIANTS_EMPTY_STATE}</p>
            ) : (
              <div className="max-h-48 overflow-x-auto overflow-y-auto rounded-md border border-border/60">
                <table className="w-max min-w-full text-sm">
                  <thead className="sticky top-0 z-[1] bg-muted/80 backdrop-blur">
                    <tr className="border-b border-border text-left">
                      <th
                        className={cn(
                          "whitespace-nowrap px-2.5 py-1.5",
                          fieldLabelClass
                        )}
                      >
                        SKU
                      </th>
                      {showVariantGtin ? (
                        <th
                          className={cn(
                            "whitespace-nowrap px-2.5 py-1.5",
                            fieldLabelClass
                          )}
                        >
                          GTIN
                        </th>
                      ) : null}
                      <th
                        className={cn(
                          "min-w-[10rem] whitespace-nowrap px-2.5 py-1.5",
                          fieldLabelClass
                        )}
                      >
                        Attributes
                      </th>
                      {showVariantSellable ? (
                        <th
                          className={cn(
                            "whitespace-nowrap px-2.5 py-1.5",
                            fieldLabelClass
                          )}
                        >
                          Sellable
                        </th>
                      ) : null}
                      <th
                        className={cn(
                          "whitespace-nowrap px-2.5 py-1.5 text-right",
                          fieldLabelClass
                        )}
                      >
                        {SELL_PRICE_COLUMN}
                      </th>
                      <th
                        className={cn(
                          "whitespace-nowrap px-2.5 py-1.5 text-right",
                          fieldLabelClass
                        )}
                      >
                        {BUY_PRICE_COLUMN}
                      </th>
                      {showVariantWeight ? (
                        <th
                          className={cn(
                            "whitespace-nowrap px-2.5 py-1.5 text-right",
                            fieldLabelClass
                          )}
                        >
                          Weight
                        </th>
                      ) : null}
                      <th
                        className={cn(
                          "whitespace-nowrap px-2.5 py-1.5 text-right",
                          fieldLabelClass
                        )}
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.variants.map((v) => (
                      <tr key={v.id} className="border-b border-border/40 last:border-0">
                        <td className={cn("whitespace-nowrap px-2.5 py-1.5", fieldValueClass)}>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono">{v.sku}</span>
                            {v.is_master ? (
                              <Badge
                                variant={v.is_sellable === false ? "default" : "active"}
                                className="shrink-0 text-[10px]"
                              >
                                {masterVariantBadgeLabel(v)}
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        {showVariantGtin ? (
                          <td
                            className={cn(
                              "whitespace-nowrap px-2.5 py-1.5 font-mono",
                              fieldValueClass
                            )}
                          >
                            {hasText(v.barcode) ? v.barcode : "—"}
                          </td>
                        ) : null}
                        <td
                          className={cn(
                            "max-w-[14rem] px-2.5 py-1.5",
                            fieldValueClass,
                            "font-normal text-muted-foreground"
                          )}
                        >
                          <span className="line-clamp-2">
                            {formatVariantAttributes(v.variant_attributes)}
                          </span>
                        </td>
                        {showVariantSellable ? (
                          <td className={cn("whitespace-nowrap px-2.5 py-1.5", fieldValueClass)}>
                            {v.is_sellable ? "Yes" : "No"}
                          </td>
                        ) : null}
                        <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                          {fmtMoney(v.price, currency)}
                        </td>
                        <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                          {fmtMoney(v.purchase_price, currency)}
                        </td>
                        {showVariantWeight ? (
                          <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueNumericClass)}>
                            {variantWeightLabel(v) ?? "—"}
                          </td>
                        ) : null}
                        <td className={cn("whitespace-nowrap px-2.5 py-1.5 text-right", fieldValueClass)}>
                          <Badge variant={v.is_active ? "completed" : "locked"}>
                            {v.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ProfileSectionCard>
        )}

        {visibleStorefronts.length > 0 ? (
          <ProfileSectionCard title="Reach" description="Visible on storefront channels">
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
          </ProfileSectionCard>
        ) : null}

        {hasShipping ? (
          <ProfileSectionCard title="Shipping" description="Weight and dimensions">
            {weightKg != null ? (
              <Row label="Weight" value={`${weightKg} kg`} numeric />
            ) : null}
            {dimensionsCm ? <Row label="Dimensions (L×W×H)" value={dimensionsCm} numeric /> : null}
            {volume != null ? <Row label="Volume" value={volume} numeric /> : null}
          </ProfileSectionCard>
        ) : null}

        {detail.custom_fields.length > 0 ? (
          <ProfileSectionCard title="Custom fields" description="Catalog extensions">
            {detail.custom_fields.map((field) => (
              <Row key={field.key} label={field.key} value={field.value || "—"} />
            ))}
          </ProfileSectionCard>
        ) : null}

        {detail.tags.length > 0 ? (
          <ProfileSectionCard title="Tags" description="Discovery and grouping">
            <div className="flex flex-wrap gap-1.5 py-1">
              {detail.tags.map((tag) => (
                <Badge key={tag.id} variant="administrative">
                  {tag.name}
                </Badge>
              ))}
            </div>
          </ProfileSectionCard>
        ) : null}

        <ProfileSectionCard title="Media" description="Images and assets">
          <Row
            label="Assets"
            value={
              detail.media.length === 0
                ? "None"
                : `${detail.media.length} file${detail.media.length === 1 ? "" : "s"}`
            }
          />
          {detail.media.length > 0 ? (
            <Row
              label="Primary on storefront"
              value={
                detail.media.filter((m) => m.show_on_storefront).length > 0
                  ? `${detail.media.filter((m) => m.show_on_storefront).length} visible`
                  : "None flagged"
              }
            />
          ) : null}
        </ProfileSectionCard>

        <ProfileSectionCard title="Record" description="Audit trail">
          <Row label="Source" value={detail.source.replace(/_/g, " ")} />
          <Row label="Created" value={formatDate(detail.created_at)} />
          <Row label="Updated" value={formatDate(detail.updated_at)} />
        </ProfileSectionCard>
      </div>
    </div>
  );
}
