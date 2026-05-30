"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, LayoutGrid, Pencil, Plus, RotateCw, Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { deleteItemVariant, saveItemVariant } from "@/app/items/actions";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import { VariantMatrixGenerator } from "@/components/products/variant-matrix-generator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RightDrawer } from "@/components/ui/right-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { composeSkuFromMask } from "@/lib/products/sku-mask";
import { itemVariantSchema } from "@/lib/products/variant-schemas";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";
import {
  defaultVariantFormValues,
  variantSnapshotToFormValues,
  type ItemVariantFormValues,
  type ProductVariantSnapshot,
} from "@/lib/products/types";

const PAGE_SIZE = 10;

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  categoryTemplates: AttributeTemplateEntry[];
  skuMask?: string;
  baseSku?: string;
  variantStrategy?: ProductVariantStrategy;
  readOnly?: boolean;
  onChanged: () => void;
};

type StatusFilter = "all" | "active" | "inactive";
type SortKey = "sku" | "price";
type SortDir = "asc" | "desc";

function attributeSummary(attributes: Record<string, unknown>): string {
  const entries = Object.entries(attributes).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== ""
  );
  if (!entries.length) return "—";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}

function comboKeyOf(attributes: Record<string, unknown>): string {
  return Object.keys(attributes)
    .filter((key) => String(attributes[key]).trim() !== "")
    .sort()
    .map((key) => `${key}=${String(attributes[key])}`)
    .join("|");
}

function formatPrice(price: string): string {
  if (!price || price === "0") return "—";
  return price;
}

function masterVariantBadgeLabel(variant: ProductVariantSnapshot): string {
  if (variant.is_master && variant.is_sellable === false) return "Style anchor";
  return "Master";
}

export function ProductVariantPanel({
  itemId,
  variants,
  categoryTemplates,
  skuMask = "",
  baseSku = "",
  variantStrategy = "SINGLE_SKU",
  readOnly = false,
  onChanged,
}: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariantSnapshot | null>(null);
  const [variantPendingDelete, setVariantPendingDelete] = useState<ProductVariantSnapshot | null>(
    null
  );
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const openCreate = () => {
    setEditingVariant(null);
    setDrawerOpen(true);
  };

  const openEdit = (variant: ProductVariantSnapshot) => {
    setEditingVariant(variant);
    setDrawerOpen(true);
  };

  const requestDelete = (variant: ProductVariantSnapshot) => {
    if (variant.is_master) {
      toast.error(
        variant.is_sellable === false
          ? "The style anchor is edited from the product profile form."
          : "The master variant is edited from the product profile form."
      );
      return;
    }
    setVariantPendingDelete(variant);
  };

  const confirmDelete = () => {
    const variant = variantPendingDelete;
    if (!variant) return;

    startTransition(async () => {
      const result = await deleteItemVariant(variant.id);
      setVariantPendingDelete(null);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete variant.");
        return;
      }
      toast.success("Variant removed.");
      onChanged();
      router.refresh();
    });
  };

  const setVariantActive = useCallback(
    (variant: ProductVariantSnapshot, isActive: boolean) => {
      const payload = {
        ...variantSnapshotToFormValues(variant, itemId),
        is_active: isActive,
      };
      startTransition(async () => {
        const result = await saveItemVariant(payload);
        if ("error" in result) {
          toast.error(result.error ?? "Unable to update variant.");
          return;
        }
        onChanged();
        router.refresh();
      });
    },
    [itemId, onChanged, router]
  );

  const additionalVariants = useMemo(
    () => variants.filter((variant) => !variant.is_master),
    [variants]
  );

  const filteredVariants = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = variants.filter((variant) => {
      if (statusFilter === "active" && !variant.is_active) return false;
      if (statusFilter === "inactive" && variant.is_active) return false;
      if (!term) return true;
      const haystack = [
        variant.sku,
        variant.barcode ?? "",
        attributeSummary(variant.variant_attributes),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });

    return [...rows].sort((a, b) => {
      // Master always pins to the top regardless of sort.
      if (a.is_master !== b.is_master) return a.is_master ? -1 : 1;
      let cmp = 0;
      if (sortKey === "sku") {
        cmp = a.sku.localeCompare(b.sku);
      } else {
        cmp = Number(a.price || 0) - Number(b.price || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [variants, search, statusFilter, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filteredVariants.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedVariants = filteredVariants.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const selectableOnPage = pagedVariants.filter((variant) => !variant.is_master);
  const allOnPageSelected =
    selectableOnPage.length > 0 && selectableOnPage.every((v) => selectedIds.has(v.id));

  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const variant of selectableOnPage) {
        if (checked) next.add(variant.id);
        else next.delete(variant.id);
      }
      return next;
    });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const runBulkActive = (isActive: boolean) => {
    const targets = variants.filter((v) => selectedIds.has(v.id) && !v.is_master);
    if (!targets.length) return;

    startTransition(async () => {
      let failed = 0;
      for (const variant of targets) {
        const result = await saveItemVariant({
          ...variantSnapshotToFormValues(variant, itemId),
          is_active: isActive,
        });
        if ("error" in result) failed += 1;
      }
      if (failed) {
        toast.error(`${failed} variant(s) could not be updated.`);
      } else {
        toast.success(`${targets.length} variant(s) ${isActive ? "activated" : "discontinued"}.`);
      }
      setSelectedIds(new Set());
      onChanged();
      router.refresh();
    });
  };

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Variant Management
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {variantStrategy === "MULTI_SKU"
              ? "Generate and manage sellable SKU variants. The style anchor is edited in the product profile form."
              : "Manage SKU variants beyond the master profile. The master variant is edited in the product form above."}
          </p>
          {skuMask.trim() && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">SKU mask: {skuMask}</p>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMatrixOpen(true)}
              disabled={isPending}
            >
              <LayoutGrid className="h-4 w-4" />
              Generate Matrix
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={openCreate} disabled={isPending}>
              <Plus className="h-4 w-4" />
              Add Variant
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search SKU, barcode, attributes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!readOnly && selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-2">
          <span className="text-sm">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => runBulkActive(true)}>
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => runBulkActive(false)}
            >
              Discontinue
            </Button>
          </div>
        </div>
      )}

      <div className="surface-inset overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left">
              {!readOnly && (
                <th className="p-3">
                  <Checkbox
                    checked={allOnPageSelected}
                    disabled={selectableOnPage.length === 0}
                    onCheckedChange={(checked) => toggleSelectAllOnPage(Boolean(checked))}
                    aria-label="Select all on page"
                  />
                </th>
              )}
              <th className="p-3 font-medium text-muted-foreground">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("sku")}
                >
                  SKU <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-3 font-medium text-muted-foreground">Barcode</th>
              <th className="p-3 font-medium text-muted-foreground">Attributes</th>
              <th className="p-3 font-medium text-muted-foreground">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("price")}
                >
                  Price <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-3 font-medium text-muted-foreground">Status</th>
              {!readOnly && <th className="p-3 font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pagedVariants.map((variant) => (
              <tr key={variant.id} className="border-b border-border last:border-0">
                {!readOnly && (
                  <td className="p-3">
                    {!variant.is_master && (
                      <Checkbox
                        checked={selectedIds.has(variant.id)}
                        onCheckedChange={(checked) => toggleSelect(variant.id, Boolean(checked))}
                        aria-label={`Select ${variant.sku}`}
                      />
                    )}
                  </td>
                )}
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{variant.sku}</span>
                    {variant.is_master && (
                      <Badge variant={variant.is_sellable === false ? "default" : "active"}>
                        {masterVariantBadgeLabel(variant)}
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="p-3 font-mono">{variant.barcode ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {attributeSummary(variant.variant_attributes)}
                </td>
                <td className="p-3 text-right font-mono">{formatPrice(variant.price)}</td>
                <td className="p-3">
                  {readOnly || variant.is_master ? (
                    <Badge variant={variant.is_active ? "completed" : "locked"}>
                      {variant.is_active ? "Active" : "Inactive"}
                    </Badge>
                  ) : (
                    <Switch
                      checked={variant.is_active}
                      disabled={isPending}
                      aria-label="Toggle active"
                      onCheckedChange={(checked) => setVariantActive(variant, checked)}
                    />
                  )}
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
                            onClick={() => requestDelete(variant)}
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
            {pagedVariants.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 5 : 7} className="p-6 text-center text-muted-foreground">
                  No variants match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {additionalVariants.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No additional variants yet. Use “Generate Matrix” to bulk-create size/color combinations,
          or add variants one at a time.
        </p>
      )}

      <VariantDrawerForm
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        itemId={itemId}
        categoryTemplates={categoryTemplates}
        siblingVariants={variants.filter((v) => v.id !== editingVariant?.id)}
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

      <VariantMatrixGenerator
        open={matrixOpen}
        onOpenChange={setMatrixOpen}
        itemId={itemId}
        categoryTemplates={categoryTemplates}
        variants={variants}
        skuMask={skuMask}
        baseSku={baseSku}
        onGenerated={() => {
          onChanged();
          router.refresh();
        }}
      />

      <AlertDialog
        open={variantPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setVariantPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove variant {variantPendingDelete?.sku}?</AlertDialogTitle>
            <AlertDialogDescription>
              Variants without inventory history are deleted permanently. If this variant already
              has stock movements, it is discontinued (deactivated) instead so its ledger stays
              intact.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              Remove variant
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function VariantDrawerForm({
  open,
  onOpenChange,
  itemId,
  categoryTemplates,
  siblingVariants,
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
  siblingVariants: ProductVariantSnapshot[];
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

  const regenerateSku = useCallback(() => {
    const composed = composeSkuFromMask(skuMask, baseSku || "ITEM", variantAttributes);
    if (composed) {
      setValue("sku", composed, { shouldDirty: true });
      skuManualRef.current = false;
    }
  }, [skuMask, baseSku, variantAttributes, setValue]);

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
      // Required-attribute validation (driven by category templates).
      for (const template of categoryTemplates) {
        if (template.required && !values.variant_attributes[template.key]?.trim()) {
          toast.error(`${template.label} is required for this category.`);
          return;
        }
      }

      // Attribute-combination uniqueness (client-side check against siblings).
      const combo = comboKeyOf(values.variant_attributes);
      if (combo) {
        const clash = siblingVariants.some(
          (variant) => comboKeyOf(variant.variant_attributes) === combo
        );
        if (clash) {
          toast.error("Another variant already uses this exact attribute combination.");
          return;
        }
      }

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
    [categoryTemplates, siblingVariants, itemId, isEditing, onSaved]
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
            <div className="flex items-center justify-between">
              <Label htmlFor="variant_sku">Variant SKU</Label>
              {skuMask.trim() && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={isPending}
                  onClick={regenerateSku}
                >
                  <RotateCw className="h-3 w-3" />
                  Regenerate
                </Button>
              )}
            </div>
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
            {skuMask.trim() && (
              <p className="font-mono text-xs text-muted-foreground">Mask: {skuMask}</p>
            )}
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

          <div className="space-y-2">
            <Label htmlFor="variant_price">Variant price (default book)</Label>
            <Input
              id="variant_price"
              disabled={isPending}
              className="text-right font-mono"
              inputMode="decimal"
              placeholder="Leave blank to inherit item price"
              {...register("price")}
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
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
