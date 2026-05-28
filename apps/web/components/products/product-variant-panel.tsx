"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { deleteItemVariant, saveItemVariant } from "@/app/items/actions";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Switch } from "@/components/ui/switch";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { composeSkuFromMask } from "@/lib/products/sku-mask";
import { itemVariantSchema } from "@/lib/products/variant-schemas";
import {
  defaultVariantFormValues,
  variantSnapshotToFormValues,
  type ItemVariantFormValues,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  categoryTemplates: AttributeTemplateEntry[];
  skuMask?: string;
  baseSku?: string;
  readOnly?: boolean;
  onChanged: () => void;
};

function attributeSummary(attributes: Record<string, unknown>): string {
  const entries = Object.entries(attributes).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );
  if (!entries.length) return "—";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

export function ProductVariantPanel({
  itemId,
  variants,
  categoryTemplates,
  skuMask = "",
  baseSku = "",
  readOnly = false,
  onChanged,
}: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariantSnapshot | null>(null);
  const [isPending, startTransition] = useTransition();

  const openCreate = () => {
    setEditingVariant(null);
    setDrawerOpen(true);
  };

  const openEdit = (variant: ProductVariantSnapshot) => {
    setEditingVariant(variant);
    setDrawerOpen(true);
  };

  const handleDelete = (variant: ProductVariantSnapshot) => {
    if (variant.is_master) {
      toast.error("The master variant is edited from the product profile form.");
      return;
    }

    if (!window.confirm(`Delete variant ${variant.sku}? This cannot be undone.`)) return;

    startTransition(async () => {
      const result = await deleteItemVariant(variant.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete variant.");
        return;
      }
      toast.success("Variant deleted.");
      onChanged();
      router.refresh();
    });
  };

  const additionalVariants = useMemo(
    () => variants.filter((variant) => !variant.is_master),
    [variants]
  );

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Variant Management
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Manage additional SKU variants beyond the master profile. The master variant is edited
            in the product form above.
          </p>
        </div>
        {!readOnly && (
          <Button type="button" size="sm" variant="outline" onClick={openCreate} disabled={isPending}>
            <Plus className="h-4 w-4" />
            Add Variant
          </Button>
        )}
      </div>

      <div className="surface-inset overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              <th className="p-3 font-medium text-muted-foreground">SKU</th>
              <th className="p-3 font-medium text-muted-foreground">Barcode</th>
              <th className="p-3 font-medium text-muted-foreground">Attributes</th>
              <th className="p-3 font-medium text-muted-foreground">Status</th>
              {!readOnly && <th className="p-3 font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant) => (
              <tr key={variant.id} className="border-b border-border last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{variant.sku}</span>
                    {variant.is_master && <Badge variant="active">Master</Badge>}
                  </div>
                </td>
                <td className="p-3 font-mono">{variant.barcode ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {attributeSummary(variant.variant_attributes)}
                </td>
                <td className="p-3">
                  <Badge variant={variant.is_active ? "completed" : "locked"}>
                    {variant.is_active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                {!readOnly && (
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {!variant.is_master && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 px-0"
                            disabled={isPending}
                            onClick={() => openEdit(variant)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 px-0 text-destructive hover:text-destructive"
                            disabled={isPending}
                            onClick={() => handleDelete(variant)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {additionalVariants.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No additional variants yet. Enable multi-variant mode or add variants to capture
          size, color, and other SKU-level differences.
        </p>
      )}

      <VariantDrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        itemId={itemId}
        categoryTemplates={categoryTemplates}
        skuMask={skuMask}
        baseSku={baseSku}
        initialValues={
          editingVariant
            ? variantSnapshotToFormValues(editingVariant, itemId)
            : defaultVariantFormValues(itemId)
        }
        isEditing={Boolean(editingVariant)}
        onSaved={() => {
          setDrawerOpen(false);
          onChanged();
          router.refresh();
        }}
      />
    </section>
  );
}

function VariantDrawerForm({
  open,
  onOpenChange,
  itemId,
  categoryTemplates,
  skuMask,
  baseSku,
  initialValues,
  isEditing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  categoryTemplates: AttributeTemplateEntry[];
  skuMask: string;
  baseSku: string;
  initialValues: ItemVariantFormValues;
  isEditing: boolean;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const skuManualRef = useRef(isEditing);

  const form = useForm<ItemVariantFormValues>({
    resolver: zodResolver(itemVariantSchema),
    defaultValues: initialValues,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = form;
  const variantAttributes = watch("variant_attributes");

  useEffect(() => {
    if (open) {
      reset(initialValues);
      skuManualRef.current = isEditing;
    }
  }, [open, initialValues, reset, isEditing]);

  useEffect(() => {
    if (!open || isEditing || skuManualRef.current || !skuMask.trim()) return;
    const composed = composeSkuFromMask(skuMask, baseSku || "ITEM", variantAttributes);
    if (composed) {
      setValue("sku", composed, { shouldDirty: true });
    }
  }, [open, isEditing, skuMask, baseSku, variantAttributes, setValue]);

  const onSubmit = useCallback(
    (values: ItemVariantFormValues) => {
      startTransition(async () => {
        const result = await saveItemVariant({ ...values, item_id: itemId });
        if ("error" in result) {
          toast.error(result.error ?? "Unable to save variant.");
          return;
        }
        toast.success(isEditing ? "Variant updated." : "Variant created.");
        onSaved();
      });
    },
    [itemId, isEditing, onSaved]
  );

  return (
    <RightDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Edit Product Variant" : "Add Product Variant"}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="space-y-2">
            <Label htmlFor="variant_sku">Variant SKU</Label>
            <Input
              id="variant_sku"
              disabled={isPending}
              className="font-mono"
              {...register("sku", {
                onChange: () => {
                  skuManualRef.current = true;
                },
              })}
            />
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variant_barcode">Barcode / GTIN</Label>
            <Input
              id="variant_barcode"
              disabled={isPending}
              className="font-mono"
              {...register("barcode")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Variant active</p>
              <p className="text-xs text-muted-foreground">Inactive variants stay linked but are excluded from flows.</p>
            </div>
            <Switch
              checked={watch("is_active")}
              disabled={isPending}
              onCheckedChange={(checked) => setValue("is_active", checked, { shouldDirty: true })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="variant_dead_weight">Dead weight (kg)</Label>
              <Input
                id="variant_dead_weight"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("dead_weight_kg")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant_length">Length (cm)</Label>
              <Input
                id="variant_length"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("length_cm")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant_width">Width (cm)</Label>
              <Input
                id="variant_width"
                disabled={isPending}
                className="text-right font-mono"
                inputMode="decimal"
                {...register("width_cm")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="variant_height">Height (cm)</Label>
              <Input
                id="variant_height"
                disabled={isPending}
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
              disabled={isPending}
              onChange={(key, value) =>
                setValue(
                  "variant_attributes",
                  { ...variantAttributes, [key]: value },
                  { shouldDirty: true }
                )
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isEditing ? "Save Variant" : "Create Variant"}
          </Button>
        </div>
      </form>
    </RightDrawer>
  );
}
