"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  deleteItemVariant,
  getProductDetail,
  getProductVariants,
  saveItemVariant,
  saveItemVariantAxes,
  saveItemVariantsBulk,
  syncItemVariantCatalogAfterMatrix,
  syncMatrixVariantSupplierPrices,
  type BulkVariantRow,
} from "@/app/items/actions";
import { VariantAxisChipSelector } from "@/components/products/variant-axis-chip-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { composeSkuFromMask, resolveEffectiveSkuMask } from "@/lib/products/sku-mask";
import {
  COST_PRICE_COLUMN,
  GTIN_BARCODE_COLUMN,
  MRP_PRICE_COLUMN,
  SELL_PRICE_COLUMN,
} from "@/lib/products/product-user-labels";
import { splitTemplatesByAxis } from "@/lib/products/variant-composition";
import {
  normalizeMatrixPriceDefault,
  resolveMatrixCostDefault,
} from "@/lib/products/variant-matrix-defaults";
import { editorPanelDividerClass } from "@/lib/products/editor-chrome";
import {
  variantSnapshotToFormValues,
  type ProductDetailSnapshot,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type VariantCompositionMode = "draft" | "live";

export type VariantMatrixCommitResult =
  | { success: true; updatedAt?: string; detail?: ProductDetailSnapshot }
  | { error: string };

export type VariantMatrixDraftState = {
  includedCount: number;
  canCommit: boolean;
  isDirty: boolean;
};

type Props = {
  itemId: string;
  categoryTemplates: AttributeTemplateEntry[];
  variants: ProductVariantSnapshot[];
  skuMask: string;
  baseSku: string;
  axisKeys: string[];
  suggestedAxisKeys?: string[];
  onAxisKeysChange?: (keys: string[]) => void;
  /** When true, axis chips are read-only (sellable variants already exist). */
  axesLocked?: boolean;
  /** When false, axis selection is controlled elsewhere (legacy). */
  showAxisPicker?: boolean;
  /** Draft: rebuild grid in memory; persist via commitDraft on wizard Continue. */
  compositionMode?: VariantCompositionMode;
  onRegisterCommit?: (commit: (() => Promise<VariantMatrixCommitResult>) | null) => void;
  onDraftChange?: (state: VariantMatrixDraftState | null) => void;
  defaultSellingPrice?: string;
  defaultPurchasePrice?: string;
  defaultStandardCost?: string;
  defaultMrp?: string;
  defaultSupplierId?: string | null;
  onGenerated: () => void;
};

type RowOverride = {
  include: boolean;
  sku?: string;
  sellPrice?: string;
  costPrice?: string;
  mrp?: string;
  barcode?: string;
};

function SectionLabel({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {meta}
    </div>
  );
}

function ValueToggleChip({
  label,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-inset ring-primary/40"
          : "border-border bg-card text-foreground shadow-sm ring-1 ring-border/50 hover:border-primary/30 hover:bg-muted/60 dark:bg-card/70 dark:ring-0 dark:hover:bg-muted/40"
      )}
      aria-pressed={selected}
    >
      {label}
    </button>
  );
}

function comboKey(attributes: Record<string, string>): string {
  return Object.keys(attributes)
    .sort()
    .map((key) => `${key}=${attributes[key]}`)
    .join("|");
}

function cartesian(axes: Array<{ key: string; values: string[] }>): Array<Record<string, string>> {
  return axes.reduce<Array<Record<string, string>>>(
    (acc, axis) => {
      const next: Array<Record<string, string>> = [];
      for (const combo of acc) {
        for (const value of axis.values) {
          next.push({ ...combo, [axis.key]: value });
        }
      }
      return next;
    },
    [{}]
  );
}

function formatComboLabel(attributes: Record<string, string>): string {
  return Object.values(attributes).join(" · ");
}

function resolveFieldDefault(
  key: string,
  overrides: Record<string, RowOverride>,
  field: keyof Pick<RowOverride, "sellPrice" | "costPrice" | "mrp" | "barcode">,
  productDefault: string
): string {
  const override = overrides[key]?.[field];
  if (override !== undefined) return override;
  return productDefault;
}

function resetMatrixDraft() {
  return {
    selectValues: {} as Record<string, Record<string, boolean>>,
    freeValues: {} as Record<string, string>,
    overrides: {} as Record<string, RowOverride>,
  };
}

function normalizeVariantAttributes(
  attributes: Record<string, unknown>,
  axisKeys?: string[]
): Record<string, string> {
  const normalized: Record<string, string> = {};
  const keys = axisKeys?.length
    ? axisKeys
    : Object.keys(attributes).sort();
  for (const key of keys) {
    const value = attributes[key];
    if (value === null || value === undefined) continue;
    const trimmed = String(value).trim();
    if (trimmed) normalized[key] = trimmed;
  }
  return normalized;
}

function listSellableVariants(variants: ProductVariantSnapshot[]) {
  return variants.filter((variant) => !variant.is_master);
}

function buildSellableVariantIndex(
  variants: ProductVariantSnapshot[],
  axisKeys: string[]
) {
  const byKey = new Map<string, ProductVariantSnapshot>();
  const bySku = new Map<string, ProductVariantSnapshot>();
  for (const variant of listSellableVariants(variants)) {
    const sku = variant.sku?.trim();
    if (sku) bySku.set(sku, variant);
    const normalized = normalizeVariantAttributes(variant.variant_attributes, axisKeys);
    if (Object.keys(normalized).length) {
      byKey.set(comboKey(normalized), variant);
    }
  }
  return { byKey, bySku };
}

function resolveExistingVariantForRow(
  row: { key: string; sku: string },
  index: ReturnType<typeof buildSellableVariantIndex>
): ProductVariantSnapshot | undefined {
  return index.byKey.get(row.key) ?? index.bySku.get(row.sku.trim());
}

function seedDraftFromVariants(
  variants: ProductVariantSnapshot[],
  axisTemplates: AttributeTemplateEntry[]
) {
  const draft = resetMatrixDraft();
  const sellable = variants.filter((variant) => !variant.is_master);
  if (!sellable.length || !axisTemplates.length) return draft;

  for (const template of axisTemplates) {
    const values = new Set<string>();
    for (const variant of sellable) {
      const raw = variant.variant_attributes[template.key];
      if (raw === null || raw === undefined) continue;
      const trimmed = String(raw).trim();
      if (trimmed) values.add(trimmed);
    }
    if (template.type === "select" && template.options?.length) {
      for (const option of values) {
        if (!template.options.includes(option)) continue;
        draft.selectValues[template.key] = {
          ...(draft.selectValues[template.key] ?? {}),
          [option]: true,
        };
      }
    } else if (values.size) {
      draft.freeValues[template.key] = [...values].join(", ");
    }
  }

  for (const variant of sellable) {
    const attributes = normalizeVariantAttributes(
      variant.variant_attributes,
      axisTemplates.map((template) => template.key)
    );
    if (!Object.keys(attributes).length) continue;
    const key = comboKey(attributes);
    draft.overrides[key] = {
      include: true,
      sku: variant.sku,
      sellPrice:
        variant.price && variant.price !== "0" ? variant.price : undefined,
      barcode: variant.barcode?.trim() || undefined,
    };
  }

  return draft;
}

const compactInputClass = "h-7 text-xs";
const priceColClass = "w-[4.75rem] min-w-[4.75rem]";
const gtinColClass = "w-[7rem] min-w-[7rem]";

const FREE_TEXT_AXIS_EXAMPLES: Record<string, string> = {
  color: "Red, Blue, Green",
  colour: "Red, Blue, Green",
  size: "S, M, L, XL",
  brand: "Nike, Adidas, Puma",
  manufacturer: "Samsung, LG, Sony",
  material: "Cotton, Polyester, Wool",
  finish: "Matte, Gloss",
  style: "Classic, Modern",
  width: "10 cm, 12 cm, 15 cm",
  length: "1 m, 2 m, 3 m",
};

function freeTextAxisPlaceholder(template: AttributeTemplateEntry): string {
  const key = template.key.toLowerCase();
  const label = template.label.trim();
  const labelLower = label.toLowerCase();

  for (const [pattern, example] of Object.entries(FREE_TEXT_AXIS_EXAMPLES)) {
    if (key.includes(pattern) || labelLower.includes(pattern)) {
      return example;
    }
  }

  return `Comma-separated ${labelLower} values`;
}

export function VariantMatrixGenerator({
  itemId,
  categoryTemplates,
  variants,
  skuMask,
  baseSku,
  axisKeys,
  suggestedAxisKeys = [],
  onAxisKeysChange,
  axesLocked = false,
  showAxisPicker = true,
  defaultSellingPrice = "",
  defaultPurchasePrice = "",
  defaultStandardCost = "",
  defaultMrp = "",
  defaultSupplierId = null,
  compositionMode = "live",
  onRegisterCommit,
  onDraftChange,
  onGenerated,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectValues, setSelectValues] = useState(resetMatrixDraft().selectValues);
  const [freeValues, setFreeValues] = useState(resetMatrixDraft().freeValues);
  const [overrides, setOverrides] = useState(resetMatrixDraft().overrides);
  const [draftDirty, setDraftDirty] = useState(false);
  const draftHydratedRef = useRef(false);
  const isDraftMode = compositionMode === "draft";

  const markDraftDirty = useCallback(() => {
    if (isDraftMode && draftHydratedRef.current) {
      setDraftDirty(true);
    }
  }, [isDraftMode]);

  const sellDefault = normalizeMatrixPriceDefault(defaultSellingPrice);
  const costDefault = resolveMatrixCostDefault(defaultPurchasePrice, defaultStandardCost);
  const mrpDefault = normalizeMatrixPriceDefault(defaultMrp);

  const { axes: axisTemplates } = useMemo(
    () => splitTemplatesByAxis(categoryTemplates, axisKeys),
    [categoryTemplates, axisKeys]
  );

  const existingCombos = useMemo(() => {
    const set = new Set<string>();
    for (const variant of variants) {
      if (variant.is_master) continue;
      const normalized = normalizeVariantAttributes(variant.variant_attributes, axisKeys);
      if (!Object.keys(normalized).length) continue;
      set.add(comboKey(normalized));
    }
    return set;
  }, [axisKeys, variants]);

  const existingSkuSet = useMemo(() => {
    const set = new Set<string>();
    for (const variant of variants) {
      if (variant.is_master) continue;
      const sku = variant.sku?.trim();
      if (sku) set.add(sku);
    }
    return set;
  }, [variants]);

  useEffect(() => {
    if (!isDraftMode) {
      draftHydratedRef.current = false;
      setDraftDirty(false);
      return;
    }
    if (draftHydratedRef.current) return;
    const seeded = seedDraftFromVariants(variants, axisTemplates);
    setSelectValues(seeded.selectValues);
    setFreeValues(seeded.freeValues);
    setOverrides(seeded.overrides);
    draftHydratedRef.current = true;
    setDraftDirty(false);
  }, [axisTemplates, isDraftMode, variants]);

  const activeAxes = useMemo(() => {
    return axisTemplates
      .map((template) => {
        let values: string[];
        if (template.type === "select" && template.options?.length) {
          values = template.options.filter((option) => selectValues[template.key]?.[option]);
        } else {
          values = (freeValues[template.key] ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);
        }
        return { key: template.key, label: template.label, values };
      })
      .filter((axis) => axis.values.length > 0);
  }, [axisTemplates, selectValues, freeValues]);

  const effectiveMask = useMemo(
    () => resolveEffectiveSkuMask(skuMask, axisTemplates),
    [skuMask, axisTemplates]
  );

  const combos = useMemo(() => {
    if (!activeAxes.length) return [];
    return cartesian(activeAxes).map((attributes) => {
      const key = comboKey(attributes);
      const defaultSku = composeSkuFromMask(effectiveMask, baseSku || "ITEM", attributes);
      const rowSku = overrides[key]?.sku?.trim();
      const exists =
        existingCombos.has(key) ||
        existingSkuSet.has(defaultSku) ||
        Boolean(rowSku && existingSkuSet.has(rowSku));
      return { key, attributes, exists, defaultSku, label: formatComboLabel(attributes) };
    });
  }, [activeAxes, existingCombos, existingSkuSet, effectiveMask, baseSku, overrides]);

  const newCombos = combos.filter((combo) => !combo.exists);
  const rowSource = isDraftMode ? combos : newCombos;

  const resolveSellPrice = useCallback(
    (key: string) => resolveFieldDefault(key, overrides, "sellPrice", sellDefault),
    [overrides, sellDefault]
  );

  const resolveCostPrice = useCallback(
    (key: string) => resolveFieldDefault(key, overrides, "costPrice", costDefault),
    [overrides, costDefault]
  );

  const includedRows = useMemo(() => {
    return rowSource
      .filter((combo) => overrides[combo.key]?.include ?? true)
      .map((combo) => ({
        key: combo.key,
        sku: overrides[combo.key]?.sku ?? combo.defaultSku,
        price: resolveSellPrice(combo.key) || null,
        costPrice: resolveCostPrice(combo.key),
        barcode: overrides[combo.key]?.barcode?.trim() || null,
        attributes: combo.attributes,
        exists: combo.exists,
      }));
  }, [overrides, resolveCostPrice, resolveSellPrice, rowSource]);

  useEffect(() => {
    if (!isDraftMode) {
      onDraftChange?.(null);
      return;
    }
    onDraftChange?.({
      includedCount: includedRows.length,
      canCommit:
        includedRows.length > 0 &&
        axisKeys.length > 0 &&
        activeAxes.length > 0 &&
        activeAxes.length === axisTemplates.length,
      isDirty: draftDirty,
    });
  }, [
    activeAxes.length,
    axisKeys.length,
    axisTemplates.length,
    draftDirty,
    includedRows.length,
    isDraftMode,
    onDraftChange,
  ]);

  const clearDraft = useCallback(() => {
    const empty = resetMatrixDraft();
    setSelectValues(empty.selectValues);
    setFreeValues(empty.freeValues);
    setOverrides(empty.overrides);
    setDraftDirty(false);
  }, []);

  const finishDraftCommit = useCallback(async (): Promise<VariantMatrixCommitResult> => {
    const detailResult = await getProductDetail(itemId);
    if ("error" in detailResult || !detailResult.detail) {
      return {
        error:
          detailResult.error ??
          "Variants were saved but the product profile could not be refreshed.",
      };
    }
    return {
      success: true,
      updatedAt: detailResult.detail.updated_at,
      detail: detailResult.detail,
    };
  }, [itemId]);

  const commitDraft = useCallback(async (): Promise<VariantMatrixCommitResult> => {
    if (!axisKeys.length) {
      return { success: true };
    }
    if (activeAxes.length !== axisTemplates.length) {
      return { error: "Pick values for each selected axis." };
    }
    if (!includedRows.length) {
      const sellable = variants.filter((variant) => !variant.is_master);
      for (const variant of sellable) {
        const result = await deleteItemVariant(variant.id);
        if ("error" in result) {
          return { error: result.error ?? "Unable to remove variant." };
        }
      }
      const axesResult = await saveItemVariantAxes(itemId, axisKeys);
      if ("error" in axesResult) {
        return { error: axesResult.error ?? "Unable to save variant axes." };
      }
      const syncResult = await syncItemVariantCatalogAfterMatrix(itemId, axisKeys);
      if ("error" in syncResult) {
        return { error: syncResult.error ?? "Unable to sync variant catalog metadata." };
      }
      if ("detail" in syncResult && syncResult.detail) {
        return {
          success: true,
          updatedAt: syncResult.detail.updated_at,
          detail: syncResult.detail,
        };
      }
      return finishDraftCommit();
    }

    const skus = includedRows.map((row) => row.sku.trim());
    if (skus.some((sku) => !sku)) {
      return { error: "Every variant combination needs a SKU." };
    }
    if (new Set(skus).size !== skus.length) {
      return { error: "Generated SKUs must be unique." };
    }

    const variantResult = await getProductVariants(itemId);
    if ("error" in variantResult || !variantResult.bundle) {
      return {
        error: variantResult.error ?? "Unable to load current variants before saving.",
      };
    }

    const freshVariants = variantResult.bundle.variants;
    const sellable = listSellableVariants(freshVariants);
    const variantIndex = buildSellableVariantIndex(freshVariants, axisKeys);

    const targetKeys = new Set(includedRows.map((row) => row.key));
    const targetSkus = new Set(skus);

    for (const variant of sellable) {
      const key = comboKey(
        normalizeVariantAttributes(variant.variant_attributes, axisKeys)
      );
      const sku = variant.sku?.trim();
      if (targetKeys.has(key) || (sku && targetSkus.has(sku))) continue;
      const result = await deleteItemVariant(variant.id);
      if ("error" in result) {
        return { error: result.error ?? "Unable to remove variant." };
      }
    }

    const axesResult = await saveItemVariantAxes(itemId, axisKeys);
    if ("error" in axesResult) {
      return { error: axesResult.error ?? "Unable to save variant axes." };
    }

    const toCreate: BulkVariantRow[] = includedRows
      .filter((row) => !resolveExistingVariantForRow(row, variantIndex))
      .map((row) => ({
        sku: row.sku.trim(),
        price: row.price,
        barcode: row.barcode,
        is_active: true,
        variant_attributes: row.attributes,
      }));

    if (toCreate.length) {
      const bulkResult = await saveItemVariantsBulk(itemId, toCreate);
      if ("error" in bulkResult) {
        return { error: bulkResult.error ?? "Unable to create variants." };
      }
    }

    for (const row of includedRows) {
      const variant = resolveExistingVariantForRow(row, variantIndex);
      if (!variant) continue;

      const barcodeOverride = overrides[row.key]?.barcode;
      const payload = {
        ...variantSnapshotToFormValues(variant, itemId),
        sku: row.sku.trim(),
        price: row.price ?? "0",
        barcode:
          barcodeOverride !== undefined ? barcodeOverride.trim() : (variant.barcode ?? ""),
        variant_attributes: row.attributes,
      };
      const result = await saveItemVariant(payload);
      if ("error" in result) {
        return { error: result.error ?? "Unable to update variant." };
      }
    }

    if (defaultSupplierId) {
      const costRows = includedRows
        .filter((row) => row.costPrice.trim())
        .map((row) => ({ sku: row.sku.trim(), costPrice: row.costPrice.trim() }));
      if (costRows.length) {
        const costResult = await syncMatrixVariantSupplierPrices(
          itemId,
          defaultSupplierId,
          costRows
        );
        if ("error" in costResult) {
          return {
            error:
              costResult.error ??
              "Variants were saved but supplier cost prices could not be updated.",
          };
        }
      }
    }

    const syncResult = await syncItemVariantCatalogAfterMatrix(itemId, axisKeys);
    if ("error" in syncResult) {
      return { error: syncResult.error ?? "Unable to sync variant catalog metadata." };
    }

    setDraftDirty(false);
    if ("detail" in syncResult && syncResult.detail) {
      return {
        success: true,
        updatedAt: syncResult.detail.updated_at,
        detail: syncResult.detail,
      };
    }
    return finishDraftCommit();
  }, [
    activeAxes.length,
    axisKeys,
    axisTemplates.length,
    defaultSupplierId,
    finishDraftCommit,
    includedRows,
    itemId,
  ]);

  useEffect(() => {
    if (!isDraftMode) {
      onRegisterCommit?.(null);
      return;
    }
    onRegisterCommit?.(commitDraft);
    return () => onRegisterCommit?.(null);
  }, [commitDraft, isDraftMode, onRegisterCommit]);

  const handleGenerate = useCallback(() => {
    if (isDraftMode) return;
    if (!axisKeys.length) {
      toast.error("Select at least one attribute under “Varies by”.");
      return;
    }
    if (!activeAxes.length) {
      toast.error("Pick values for each selected axis.");
      return;
    }
    if (!includedRows.length) {
      toast.error("Select at least one variant combination to generate.");
      return;
    }

    const skus = includedRows.map((row) => row.sku.trim());
    if (skus.some((sku) => !sku)) {
      toast.error("Every selected combination needs a SKU.");
      return;
    }
    if (new Set(skus).size !== skus.length) {
      toast.error("Generated SKUs must be unique.");
      return;
    }

    const payload: BulkVariantRow[] = includedRows.map((row) => ({
      sku: row.sku.trim(),
      price: row.price,
      barcode: row.barcode,
      is_active: true,
      variant_attributes: row.attributes,
    }));

    startTransition(async () => {
      const axesResult = await saveItemVariantAxes(itemId, axisKeys);
      if ("error" in axesResult) {
        toast.error(axesResult.error ?? "Unable to save variant axes.");
        return;
      }

      const result = await saveItemVariantsBulk(itemId, payload);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to generate variants.");
        return;
      }

      const syncResult = await syncItemVariantCatalogAfterMatrix(itemId, axisKeys);
      if ("error" in syncResult) {
        toast.error(syncResult.error ?? "Variants were created but catalog metadata could not sync.");
        return;
      }

      if (defaultSupplierId) {
        const costRows = includedRows
          .filter((row) => row.costPrice.trim())
          .map((row) => ({ sku: row.sku.trim(), costPrice: row.costPrice.trim() }));
        if (costRows.length) {
          const costResult = await syncMatrixVariantSupplierPrices(
            itemId,
            defaultSupplierId,
            costRows
          );
          if ("error" in costResult) {
            toast.error(
              costResult.error ??
                "Variants were created but supplier cost prices could not be saved."
            );
          }
        }
      }

      toast.success(`Generated ${result.createdCount} variant(s).`);
      clearDraft();
      onGenerated();
      router.refresh();
    });
  }, [
    activeAxes.length,
    axisKeys.length,
    clearDraft,
    defaultSupplierId,
    includedRows,
    isDraftMode,
    itemId,
    onGenerated,
    router,
  ]);

  const patchOverride = useCallback(
    (comboKeyValue: string, patch: Partial<RowOverride>) => {
      setOverrides((prev) => ({
        ...prev,
        [comboKeyValue]: { ...prev[comboKeyValue], ...patch },
      }));
      markDraftDirty();
    },
    [markDraftDirty]
  );

  if (categoryTemplates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add attribute templates to this product&apos;s category first (e.g. Size, Color).
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {showAxisPicker ? (
        <VariantAxisChipSelector
          templates={categoryTemplates}
          axisKeys={axisKeys}
          suggestedAxisKeys={suggestedAxisKeys}
          disabled={isPending}
          locked={axesLocked}
          compact
          onChange={(keys) => {
            if (axesLocked || !onAxisKeysChange) return;
            onAxisKeysChange(keys);
          }}
        />
      ) : null}

      {axisKeys.length > 0 ? (
        <div className={cn("space-y-2.5", showAxisPicker && editorPanelDividerClass())}>
          {axisTemplates.map((template) =>
            template.type === "select" && template.options?.length ? (
              <div
                key={template.key}
                className="flex flex-wrap items-center gap-x-2 gap-y-1.5"
              >
                <span className="w-16 shrink-0 truncate text-xs font-medium text-muted-foreground">
                  {template.label}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {template.options.map((option) => (
                    <ValueToggleChip
                      key={option}
                      label={option}
                      selected={Boolean(selectValues[template.key]?.[option])}
                      disabled={isPending}
                      onToggle={() => {
                        setSelectValues((prev) => ({
                          ...prev,
                          [template.key]: {
                            ...(prev[template.key] ?? {}),
                            [option]: !prev[template.key]?.[option],
                          },
                        }));
                        markDraftDirty();
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div key={template.key} className="flex items-center gap-2">
                <span className="w-16 shrink-0 truncate text-xs font-medium text-muted-foreground">
                  {template.label}
                </span>
                <Input
                  className={cn(compactInputClass, "flex-1 font-mono")}
                  disabled={isPending}
                  placeholder={freeTextAxisPlaceholder(template)}
                  value={freeValues[template.key] ?? ""}
                  onChange={(event) => {
                    setFreeValues((prev) => ({
                      ...prev,
                      [template.key]: event.target.value,
                    }));
                    markDraftDirty();
                  }}
                />
              </div>
            )
          )}
        </div>
      ) : null}

      {combos.length > 0 ? (
        <section className={cn("space-y-2", editorPanelDividerClass())}>
          <SectionLabel
            title={isDraftMode ? "Variants" : "Preview"}
            meta={
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {isDraftMode
                  ? `${includedRows.length} variant${includedRows.length === 1 ? "" : "s"}`
                  : `${newCombos.length} new`}
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-xs">
              <thead>
                <tr className="border-b border-border/50 text-left">
                  <th className="w-8 px-1.5 py-1.5" />
                  <th className="min-w-[6rem] px-2 py-1.5 font-medium text-muted-foreground">
                    Variant
                  </th>
                  <th className="min-w-[6.5rem] px-2 py-1.5 font-medium text-muted-foreground">
                    SKU
                  </th>
                  <th
                    className={cn(priceColClass, "px-2 py-1.5 font-medium text-muted-foreground")}
                  >
                    {COST_PRICE_COLUMN}
                  </th>
                  <th
                    className={cn(priceColClass, "px-2 py-1.5 font-medium text-muted-foreground")}
                  >
                    {SELL_PRICE_COLUMN}
                  </th>
                  <th
                    className={cn(priceColClass, "px-2 py-1.5 font-medium text-muted-foreground")}
                  >
                    {MRP_PRICE_COLUMN}
                  </th>
                  <th
                    className={cn(gtinColClass, "px-2 py-1.5 font-medium text-muted-foreground")}
                  >
                    {GTIN_BARCODE_COLUMN}
                  </th>
                </tr>
              </thead>
              <tbody>
                {combos.map((combo) => {
                  const override = overrides[combo.key];
                  const include = isDraftMode
                    ? (override?.include ?? true)
                    : combo.exists
                      ? false
                      : (override?.include ?? true);
                  const disabledRow =
                    isPending || (!isDraftMode && combo.exists) || !include;
                  const sellValue = resolveFieldDefault(
                    combo.key,
                    overrides,
                    "sellPrice",
                    sellDefault
                  );
                  const costValue = resolveFieldDefault(
                    combo.key,
                    overrides,
                    "costPrice",
                    costDefault
                  );
                  const mrpValue = resolveFieldDefault(combo.key, overrides, "mrp", mrpDefault);
                  const barcodeValue = overrides[combo.key]?.barcode ?? "";

                  return (
                    <tr
                      key={combo.key}
                      className={cn(
                        "border-b border-border/40 last:border-0",
                        !isDraftMode && combo.exists && "opacity-50"
                      )}
                    >
                      <td className="px-1.5 py-1">
                        <Checkbox
                          className="h-3.5 w-3.5"
                          checked={include}
                          disabled={isPending || (!isDraftMode && combo.exists)}
                          onCheckedChange={(checked) =>
                            patchOverride(combo.key, { include: Boolean(checked) })
                          }
                        />
                      </td>
                      <td className="max-w-[9rem] truncate px-2 py-1 text-foreground">
                        {combo.label}
                        {!isDraftMode && combo.exists ? (
                          <span className="ml-1 text-muted-foreground">(exists)</span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={cn(compactInputClass, "font-mono")}
                          disabled={disabledRow}
                          value={override?.sku ?? combo.defaultSku}
                          onChange={(event) =>
                            patchOverride(combo.key, { sku: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={cn(compactInputClass, "text-right font-mono")}
                          inputMode="decimal"
                          placeholder={costDefault || "—"}
                          disabled={disabledRow}
                          value={costValue}
                          onChange={(event) =>
                            patchOverride(combo.key, { costPrice: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={cn(compactInputClass, "text-right font-mono")}
                          inputMode="decimal"
                          placeholder={sellDefault || "—"}
                          disabled={disabledRow}
                          value={sellValue}
                          onChange={(event) =>
                            patchOverride(combo.key, { sellPrice: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={cn(compactInputClass, "text-right font-mono")}
                          inputMode="decimal"
                          placeholder={mrpDefault || "—"}
                          disabled={disabledRow}
                          value={mrpValue}
                          onChange={(event) =>
                            patchOverride(combo.key, { mrp: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className={cn(compactInputClass, "font-mono")}
                          placeholder="Optional"
                          disabled={disabledRow}
                          value={barcodeValue}
                          onChange={(event) =>
                            patchOverride(combo.key, { barcode: event.target.value })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isDraftMode && includedRows.length > 0 ? (
        <div className="flex justify-end pt-1">
          <Button type="button" size="sm" disabled={isPending} onClick={handleGenerate}>
            {isPending
              ? "Creating…"
              : `Create ${includedRows.length} variant${includedRows.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
