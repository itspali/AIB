"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  saveItemVariantsBulk,
  syncMatrixVariantSupplierPrices,
  type BulkVariantRow,
} from "@/app/items/actions";
import { VariantAxisChipSelector } from "@/components/products/variant-axis-chip-selector";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { composeSkuFromMask, suggestSkuMask } from "@/lib/products/sku-mask";
import {
  COST_PRICE_COLUMN,
  HSN_COLUMN,
  MRP_PRICE_COLUMN,
  SELL_PRICE_COLUMN,
} from "@/lib/products/product-user-labels";
import { splitTemplatesByAxis } from "@/lib/products/variant-composition";
import {
  normalizeMatrixPriceDefault,
  resolveMatrixCostDefault,
} from "@/lib/products/variant-matrix-defaults";
import { editorPanelDividerClass } from "@/lib/products/editor-chrome";
import type { ProductVariantSnapshot } from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  itemId: string;
  categoryTemplates: AttributeTemplateEntry[];
  variants: ProductVariantSnapshot[];
  skuMask: string;
  baseSku: string;
  axisKeys: string[];
  onAxisKeysChange?: (keys: string[]) => void;
  /** When false, SKU axes are chosen in the parent form (VariantCompositionPicker). */
  showAxisPicker?: boolean;
  defaultExpanded?: boolean;
  defaultSellingPrice?: string;
  defaultPurchasePrice?: string;
  defaultStandardCost?: string;
  defaultMrp?: string;
  defaultHsn?: string;
  defaultSupplierId?: string | null;
  onGenerated: () => void;
};

type RowOverride = {
  include: boolean;
  sku?: string;
  sellPrice?: string;
  costPrice?: string;
  mrp?: string;
  hsn?: string;
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
        "rounded-md px-2 py-0.5 text-xs transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected
          ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/40"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
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
  field: keyof Pick<RowOverride, "sellPrice" | "costPrice" | "mrp" | "hsn">,
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

const compactInputClass = "h-7 text-xs";
const priceColClass = "w-[4.75rem] min-w-[4.75rem]";
const hsnColClass = "w-[5.5rem] min-w-[5.5rem]";

export function VariantMatrixGenerator({
  itemId,
  categoryTemplates,
  variants,
  skuMask,
  baseSku,
  axisKeys,
  onAxisKeysChange,
  showAxisPicker = false,
  defaultExpanded = true,
  defaultSellingPrice = "",
  defaultPurchasePrice = "",
  defaultStandardCost = "",
  defaultMrp = "",
  defaultHsn = "",
  defaultSupplierId = null,
  onGenerated,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [isPending, startTransition] = useTransition();
  const [selectValues, setSelectValues] = useState(resetMatrixDraft().selectValues);
  const [freeValues, setFreeValues] = useState(resetMatrixDraft().freeValues);
  const [overrides, setOverrides] = useState(resetMatrixDraft().overrides);

  const sellDefault = normalizeMatrixPriceDefault(defaultSellingPrice);
  const costDefault = resolveMatrixCostDefault(defaultPurchasePrice, defaultStandardCost);
  const mrpDefault = normalizeMatrixPriceDefault(defaultMrp);
  const hsnDefault = defaultHsn?.trim() ?? "";

  const { axes: axisTemplates } = useMemo(
    () => splitTemplatesByAxis(categoryTemplates, axisKeys),
    [categoryTemplates, axisKeys]
  );

  const existingCombos = useMemo(() => {
    const set = new Set<string>();
    for (const variant of variants) {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(variant.variant_attributes)) {
        if (value === null || value === undefined) continue;
        normalized[key] = String(value);
      }
      set.add(comboKey(normalized));
    }
    return set;
  }, [variants]);

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

  const effectiveMask = useMemo(() => {
    const trimmed = skuMask.trim();
    if (trimmed) return trimmed;
    return suggestSkuMask(axisTemplates);
  }, [skuMask, axisTemplates]);

  const combos = useMemo(() => {
    if (!activeAxes.length) return [];
    return cartesian(activeAxes).map((attributes) => {
      const key = comboKey(attributes);
      const exists = existingCombos.has(key);
      const defaultSku = composeSkuFromMask(effectiveMask, baseSku || "ITEM", attributes);
      return { key, attributes, exists, defaultSku, label: formatComboLabel(attributes) };
    });
  }, [activeAxes, existingCombos, effectiveMask, baseSku]);

  const newCombos = combos.filter((combo) => !combo.exists);

  const resolveSellPrice = useCallback(
    (key: string) => resolveFieldDefault(key, overrides, "sellPrice", sellDefault),
    [overrides, sellDefault]
  );

  const resolveCostPrice = useCallback(
    (key: string) => resolveFieldDefault(key, overrides, "costPrice", costDefault),
    [overrides, costDefault]
  );

  const includedRows = useMemo(() => {
    return newCombos
      .filter((combo) => overrides[combo.key]?.include ?? true)
      .map((combo) => ({
        sku: overrides[combo.key]?.sku ?? combo.defaultSku,
        price: resolveSellPrice(combo.key) || null,
        costPrice: resolveCostPrice(combo.key),
        attributes: combo.attributes,
      }));
  }, [newCombos, overrides, resolveSellPrice, resolveCostPrice]);

  const clearDraft = useCallback(() => {
    const empty = resetMatrixDraft();
    setSelectValues(empty.selectValues);
    setFreeValues(empty.freeValues);
    setOverrides(empty.overrides);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!axisKeys.length) {
      toast.error(
        showAxisPicker
          ? "Select at least one attribute under “Varies by”."
          : "Choose what varies above, then pick values here."
      );
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
      is_active: true,
      variant_attributes: row.attributes,
    }));

    startTransition(async () => {
      const result = await saveItemVariantsBulk(itemId, payload);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to generate variants.");
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
    itemId,
    onGenerated,
    router,
    showAxisPicker,
  ]);

  const patchOverride = useCallback((comboKeyValue: string, patch: Partial<RowOverride>) => {
    setOverrides((prev) => ({
      ...prev,
      [comboKeyValue]: { ...prev[comboKeyValue], ...patch },
    }));
  }, []);

  if (categoryTemplates.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Add attribute templates to this product&apos;s category first (e.g. Size, Color).
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 py-1 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="text-sm font-medium text-foreground">Generate variants</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>

      {expanded ? (
        <div className="space-y-4 pb-1">
          {showAxisPicker ? (
            <div className="space-y-2">
              <VariantAxisChipSelector
                templates={categoryTemplates}
                axisKeys={axisKeys}
                disabled={isPending}
                compact
                onChange={(keys) => {
                  if (onAxisKeysChange) onAxisKeysChange(keys);
                }}
              />
            </div>
          ) : axisKeys.length === 0 ? (
            <p className="text-xs text-muted-foreground">Choose what varies above first.</p>
          ) : null}

          {axisKeys.length > 0 ? (
            <section className={cn("space-y-2", editorPanelDividerClass())}>
              <SectionLabel title="Values" />
              <div className="space-y-2.5">
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
                            onToggle={() =>
                              setSelectValues((prev) => ({
                                ...prev,
                                [template.key]: {
                                  ...(prev[template.key] ?? {}),
                                  [option]: !prev[template.key]?.[option],
                                },
                              }))
                            }
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
                        placeholder="Red, Blue, Green"
                        value={freeValues[template.key] ?? ""}
                        onChange={(event) =>
                          setFreeValues((prev) => ({
                            ...prev,
                            [template.key]: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )
                )}
              </div>
            </section>
          ) : null}

                {combos.length > 0 ? (
                  <section className={cn("space-y-2", editorPanelDividerClass())}>
                    <SectionLabel
                      title="Preview"
                      meta={
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {newCombos.length} new
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
                        className={cn(
                          priceColClass,
                          "px-2 py-1.5 font-medium text-muted-foreground"
                        )}
                      >
                        {COST_PRICE_COLUMN}
                      </th>
                      <th
                        className={cn(
                          priceColClass,
                          "px-2 py-1.5 font-medium text-muted-foreground"
                        )}
                      >
                        {SELL_PRICE_COLUMN}
                      </th>
                      <th
                        className={cn(
                          priceColClass,
                          "px-2 py-1.5 font-medium text-muted-foreground"
                        )}
                      >
                        {MRP_PRICE_COLUMN}
                      </th>
                      <th
                        className={cn(hsnColClass, "px-2 py-1.5 font-medium text-muted-foreground")}
                      >
                        {HSN_COLUMN}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {combos.map((combo) => {
                      const override = overrides[combo.key];
                      const include = combo.exists ? false : override?.include ?? true;
                      const disabledRow = isPending || combo.exists || !include;
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
                      const mrpValue = resolveFieldDefault(
                        combo.key,
                        overrides,
                        "mrp",
                        mrpDefault
                      );
                      const hsnValue = resolveFieldDefault(
                        combo.key,
                        overrides,
                        "hsn",
                        hsnDefault
                      );

                      return (
                        <tr
                          key={combo.key}
                                className={cn(
                                  "border-b border-border/40 last:border-0",
                                  combo.exists && "opacity-50"
                                )}
                        >
                          <td className="px-1.5 py-1">
                            <Checkbox
                              className="h-3.5 w-3.5"
                              checked={include}
                              disabled={isPending || combo.exists}
                              onCheckedChange={(checked) =>
                                patchOverride(combo.key, { include: Boolean(checked) })
                              }
                            />
                          </td>
                          <td className="max-w-[9rem] truncate px-2 py-1 text-foreground">
                            {combo.label}
                            {combo.exists ? (
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
                              placeholder={hsnDefault || "—"}
                              disabled={disabledRow}
                              value={hsnValue}
                              onChange={(event) =>
                                patchOverride(combo.key, { hsn: event.target.value })
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
                ) : axisKeys.length > 0 ? (
                  <p className="text-xs text-muted-foreground">Pick values to preview SKUs.</p>
                ) : null}

          {includedRows.length > 0 ? (
            <div className="flex justify-end pt-1">
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={handleGenerate}
              >
                {isPending
                  ? "Creating…"
                  : `Create ${includedRows.length} variant${includedRows.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
