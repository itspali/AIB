"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveItemVariantsBulk, type BulkVariantRow } from "@/app/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { composeSkuFromMask, suggestSkuMask } from "@/lib/products/sku-mask";
import type { ProductVariantSnapshot } from "@/lib/products/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  categoryTemplates: AttributeTemplateEntry[];
  variants: ProductVariantSnapshot[];
  skuMask: string;
  baseSku: string;
  onGenerated: () => void;
};

type RowOverride = { include: boolean; sku?: string; price?: string };

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

export function VariantMatrixGenerator({
  open,
  onOpenChange,
  itemId,
  categoryTemplates,
  variants,
  skuMask,
  baseSku,
  onGenerated,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabledAxes, setEnabledAxes] = useState<Record<string, boolean>>({});
  const [selectValues, setSelectValues] = useState<Record<string, Record<string, boolean>>>({});
  const [freeValues, setFreeValues] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});

  useEffect(() => {
    if (!open) {
      setEnabledAxes({});
      setSelectValues({});
      setFreeValues({});
      setOverrides({});
    }
  }, [open]);

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
    return categoryTemplates
      .filter((template) => enabledAxes[template.key])
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
        return { key: template.key, values };
      })
      .filter((axis) => axis.values.length > 0);
  }, [categoryTemplates, enabledAxes, selectValues, freeValues]);

  const effectiveMask = useMemo(() => {
    const trimmed = skuMask.trim();
    if (trimmed) return trimmed;
    const axisTemplates = categoryTemplates.filter((template) => enabledAxes[template.key]);
    return suggestSkuMask(axisTemplates);
  }, [skuMask, categoryTemplates, enabledAxes]);

  const combos = useMemo(() => {
    if (!activeAxes.length) return [];
    return cartesian(activeAxes).map((attributes) => {
      const key = comboKey(attributes);
      const exists = existingCombos.has(key);
      const defaultSku = composeSkuFromMask(effectiveMask, baseSku || "ITEM", attributes);
      return { key, attributes, exists, defaultSku };
    });
  }, [activeAxes, existingCombos, effectiveMask, baseSku]);

  const newCombos = combos.filter((combo) => !combo.exists);

  const includedRows = useMemo(() => {
    return newCombos
      .filter((combo) => overrides[combo.key]?.include ?? true)
      .map((combo) => ({
        sku: overrides[combo.key]?.sku ?? combo.defaultSku,
        price: overrides[combo.key]?.price ?? "",
        attributes: combo.attributes,
      }));
  }, [newCombos, overrides]);

  const handleGenerate = useCallback(() => {
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
      toast.success(`Generated ${result.createdCount} variant(s).`);
      onGenerated();
      onOpenChange(false);
      router.refresh();
    });
  }, [includedRows, itemId, onGenerated, onOpenChange, router]);

  return (
    <RightDrawer open={open} onOpenChange={onOpenChange} title="Generate Variant Matrix">
      <div className="flex h-full flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {categoryTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This product&apos;s category has no attribute templates. Add attributes to the
              category to define variant axes (e.g. Size, Color).
            </p>
          ) : (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-medium">1. Choose variant axes &amp; values</h4>
                {categoryTemplates.map((template) => {
                  const isEnabled = Boolean(enabledAxes[template.key]);
                  return (
                    <div key={template.key} className="rounded-lg border border-border p-3">
                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={isEnabled}
                          disabled={isPending}
                          onCheckedChange={(checked) =>
                            setEnabledAxes((prev) => ({ ...prev, [template.key]: Boolean(checked) }))
                          }
                        />
                        <span className="text-sm font-medium">{template.label}</span>
                        <span className="text-xs text-muted-foreground">({template.key})</span>
                      </label>

                      {isEnabled && template.type === "select" && template.options?.length ? (
                        <div className="mt-3 flex flex-wrap gap-3 pl-6">
                          {template.options.map((option) => (
                            <label key={option} className="flex items-center gap-2">
                              <Checkbox
                                checked={Boolean(selectValues[template.key]?.[option])}
                                disabled={isPending}
                                onCheckedChange={(checked) =>
                                  setSelectValues((prev) => ({
                                    ...prev,
                                    [template.key]: {
                                      ...(prev[template.key] ?? {}),
                                      [option]: Boolean(checked),
                                    },
                                  }))
                                }
                              />
                              <span className="text-sm">{option}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}

                      {isEnabled && !(template.type === "select" && template.options?.length) ? (
                        <div className="mt-3 space-y-1 pl-6">
                          <Label className="text-xs text-muted-foreground">
                            Comma-separated values
                          </Label>
                          <Input
                            disabled={isPending}
                            placeholder="e.g. S, M, L"
                            value={freeValues[template.key] ?? ""}
                            onChange={(event) =>
                              setFreeValues((prev) => ({
                                ...prev,
                                [template.key]: event.target.value,
                              }))
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">2. Preview ({newCombos.length} new)</h4>
                  <span className="font-mono text-xs text-muted-foreground">{effectiveMask}</span>
                </div>

                {combos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Enable axes and pick values to preview the generated SKU grid.
                  </p>
                ) : (
                  <div className="surface-inset overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-left">
                          <th className="p-2" />
                          <th className="p-2 font-medium text-muted-foreground">Combination</th>
                          <th className="p-2 font-medium text-muted-foreground">SKU</th>
                          <th className="p-2 font-medium text-muted-foreground">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combos.map((combo) => {
                          const override = overrides[combo.key];
                          const include = combo.exists ? false : override?.include ?? true;
                          return (
                            <tr key={combo.key} className="border-b border-border last:border-0">
                              <td className="p-2">
                                <Checkbox
                                  checked={include}
                                  disabled={isPending || combo.exists}
                                  onCheckedChange={(checked) =>
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [combo.key]: { ...prev[combo.key], include: Boolean(checked) },
                                    }))
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <div className="flex flex-wrap items-center gap-1">
                                  {Object.entries(combo.attributes).map(([key, value]) => (
                                    <Badge key={key} variant="default">
                                      {value}
                                    </Badge>
                                  ))}
                                  {combo.exists && (
                                    <span className="text-xs text-muted-foreground">exists</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-2">
                                <Input
                                  className="h-8 font-mono"
                                  disabled={isPending || combo.exists || !include}
                                  value={override?.sku ?? combo.defaultSku}
                                  onChange={(event) =>
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [combo.key]: { ...prev[combo.key], sku: event.target.value },
                                    }))
                                  }
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  className="h-8 text-right font-mono"
                                  inputMode="decimal"
                                  placeholder="—"
                                  disabled={isPending || combo.exists || !include}
                                  value={override?.price ?? ""}
                                  onChange={(event) =>
                                    setOverrides((prev) => ({
                                      ...prev,
                                      [combo.key]: { ...prev[combo.key], price: event.target.value },
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || includedRows.length === 0}
            onClick={handleGenerate}
          >
            Generate {includedRows.length || ""} variant{includedRows.length === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}
