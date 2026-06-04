"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpDown, Pencil, Plus, RotateCw, Ruler, Search, Trash2 } from "lucide-react";
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
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { VARIANT_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import {
  BUY_PRICE_COLUMN,
  MRP_COLUMN,
  SELL_PRICE_COLUMN,
  VARIANT_DEFAULT_BADGE,
  VARIANT_DIMENSIONS_TOGGLE_LABEL,
  VARIANT_NOT_SOLD_BADGE,
  VARIANT_SKU_LABEL,
  VARIANTS_PANEL_NOT_SOLD_HELP,
} from "@/lib/products/product-user-labels";
import { Label } from "@/components/ui/label";
import { RightDrawer } from "@/components/ui/right-drawer";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
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
import {
  editorDimensionsLwhGridClass,
  editorFieldSpanFullClass,
  editorGridClass,
  editorPanelDividerClass,
} from "@/lib/products/editor-chrome";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";
import {
  defaultVariantFormValues,
  variantSnapshotToFormValues,
  type ItemVariantFormValues,
  type ProductVariantSnapshot,
  type VariantFormDefaults,
} from "@/lib/products/types";
import {
  computeVolumeCm3FromDimensions,
  formatCalculatedVolumeInfo,
} from "@/lib/products/shipping-dimensions";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

type Props = {
  itemId: string;
  variants: ProductVariantSnapshot[];
  categoryTemplates: AttributeTemplateEntry[];
  /** Category attribute keys the author chose to vary on (drives the matrix). */
  variantAxisKeys?: string[];
  onVariantAxisKeysChange?: (keys: string[]) => void;
  skuMask?: string;
  baseSku?: string;
  defaultSellingPrice?: string;
  defaultPurchasePrice?: string;
  defaultStandardCost?: string;
  defaultMrp?: string;
  defaultHsn?: string;
  defaultSupplierId?: string | null;
  /** Prefill new variants (and empty table cells) from the master product row. */
  variantDefaults?: VariantFormDefaults;
  variantStrategy?: ProductVariantStrategy;
  /** When true, dimension columns start visible (multi-SKU inherit master dimensions). */
  defaultShowDimensionColumns?: boolean;
  readOnly?: boolean;
  /** Merge a saved field onto one variant without reloading the item form. */
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  /** Refresh the variant list in place (no full item reload / skeleton). */
  onVariantsReload?: () => void | Promise<void>;
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

function hasPriceValue(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && trimmed !== "0");
}

function displayPriceCell(
  value: string | null | undefined,
  fallback: string
): { text: string; inherited: boolean } {
  if (hasPriceValue(value)) {
    return { text: formatPrice(value!), inherited: false };
  }
  if (hasPriceValue(fallback)) {
    return { text: formatPrice(fallback), inherited: true };
  }
  return { text: "—", inherited: false };
}

function displayDimensionCell(
  value: string | null | undefined,
  fallback: string
): { text: string; inherited: boolean } {
  const trimmed = value?.trim();
  const hasOwn = Boolean(trimmed && trimmed !== "0");
  if (hasOwn) return { text: trimmed!, inherited: false };
  const fb = fallback?.trim();
  if (fb && fb !== "0") return { text: fb, inherited: true };
  return { text: "—", inherited: false };
}

function masterVariantBadgeLabel(variant: ProductVariantSnapshot): string {
  if (variant.is_master && variant.is_sellable === false) return VARIANT_NOT_SOLD_BADGE;
  return VARIANT_DEFAULT_BADGE;
}

export function ProductVariantPanel({
  itemId,
  variants,
  categoryTemplates,
  variantAxisKeys,
  onVariantAxisKeysChange,
  skuMask = "",
  baseSku = "",
  defaultSellingPrice = "",
  defaultPurchasePrice = "",
  defaultStandardCost = "",
  defaultMrp = "",
  defaultHsn = "",
  defaultSupplierId = null,
  variantDefaults,
  variantStrategy = "SINGLE_SKU",
  defaultShowDimensionColumns = false,
  readOnly = false,
  onVariantPatch,
  onVariantsReload,
}: Props) {
  const [showDimensions, setShowDimensions] = useState(defaultShowDimensionColumns);
  const [drawerOpen, setDrawerOpen] = useState(false);
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
          ? VARIANTS_PANEL_NOT_SOLD_HELP
          : "Edit the default variant from the product sections above."
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
      void onVariantsReload?.();
    });
  };

  const setVariantActive = useCallback(
    (variant: ProductVariantSnapshot, isActive: boolean) => {
      const payload = {
        ...variantSnapshotToFormValues(variant, itemId),
        is_active: isActive,
      };
      onVariantPatch?.(variant.id, { is_active: isActive });
      startTransition(async () => {
        const result = await saveItemVariant(payload);
        if ("error" in result) {
          onVariantPatch?.(variant.id, { is_active: variant.is_active });
          toast.error(result.error ?? "Unable to update variant.");
          return;
        }
      });
    },
    [itemId, onVariantPatch]
  );

  const additionalVariants = useMemo(
    () => variants.filter((variant) => !variant.is_master),
    [variants]
  );

  /** Sellable rows only — default/master SKU is edited in Essentials & Commerce above. */
  const sellableVariants = additionalVariants;

  const showVariantList = sellableVariants.length > 0;
  const canUseMatrix = Boolean(itemId && categoryTemplates.length > 0);

  useEffect(() => {
    if (defaultShowDimensionColumns) {
      setShowDimensions(true);
    }
  }, [defaultShowDimensionColumns]);

  const resolvedVariantDefaults = useMemo((): VariantFormDefaults => {
    const base = variantDefaults ?? {};
    const length = base.length_cm;
    const width = base.width_cm;
    const height = base.height_cm;
    const volumeFromDims = computeVolumeCm3FromDimensions(length, width, height);
    return {
      price: base.price?.trim() || defaultSellingPrice.trim() || undefined,
      dead_weight_kg: base.dead_weight_kg,
      volume: volumeFromDims || base.volume,
      length_cm: length,
      width_cm: width,
      height_cm: height,
    };
  }, [defaultSellingPrice, variantDefaults]);

  const filteredVariants = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = sellableVariants.filter((variant) => {
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
      let cmp = 0;
      if (sortKey === "sku") {
        cmp = a.sku.localeCompare(b.sku);
      } else {
        cmp = Number(a.price || 0) - Number(b.price || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sellableVariants, search, statusFilter, sortKey, sortDir]);

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
      void onVariantsReload?.();
    });
  };

  return (
    <div className="space-y-0">
      {!readOnly && itemId && !canUseMatrix ? (
        <div className="flex justify-end pb-1">
          <Button type="button" size="sm" variant="outline" onClick={openCreate} disabled={isPending}>
            <Plus className="h-4 w-4" />
            Add variant
          </Button>
        </div>
      ) : null}

      {!readOnly && canUseMatrix ? (
        <div className={editorPanelDividerClass()}>
        <VariantMatrixGenerator
          itemId={itemId}
          categoryTemplates={categoryTemplates}
          axisKeys={variantAxisKeys ?? []}
          onAxisKeysChange={onVariantAxisKeysChange}
          showAxisPicker={!onVariantAxisKeysChange}
          defaultExpanded={additionalVariants.length === 0}
          variants={variants}
          skuMask={skuMask}
          baseSku={baseSku}
          defaultSellingPrice={defaultSellingPrice}
          defaultPurchasePrice={defaultPurchasePrice}
          defaultStandardCost={defaultStandardCost}
          defaultMrp={defaultMrp}
          defaultHsn={defaultHsn}
          defaultSupplierId={defaultSupplierId}
          onGenerated={() => {
            void onVariantsReload?.();
          }}
        />
        </div>
      ) : !readOnly && !itemId ? (
        <p className={cn("text-xs text-muted-foreground", editorPanelDividerClass())}>
          Save the product to generate variants.
        </p>
      ) : null}

      {showVariantList ? (
        <>
      <div
        className={cn(
          editorPanelDividerClass(),
          "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search SKU, GTIN, attributes…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
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
        <div className="flex shrink-0 items-center gap-2">
          {showVariantList ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-1">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <Label htmlFor="variant-show-dimensions" className="text-xs font-medium">
                {VARIANT_DIMENSIONS_TOGGLE_LABEL}
              </Label>
              <Switch
                id="variant-show-dimensions"
                checked={showDimensions}
                onCheckedChange={setShowDimensions}
                aria-label="Show dimension columns"
              />
            </div>
          ) : null}
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={isPending}
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Add one
            </Button>
          ) : null}
        </div>
      </div>

      {!readOnly && selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 editor-bulk-bar">
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

      <div
        className={cn(
          editorPanelDividerClass(),
          "overflow-x-auto",
          showDimensions && "max-w-full [scrollbar-gutter:stable]"
        )}
      >
        <table className={cn("w-full text-sm", showDimensions && "min-w-[960px]")}>
          <thead>
            <tr className="border-b border-border/50 text-left">
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
              <th className="p-3 font-medium text-muted-foreground">GTIN</th>
              <th className="p-3 font-medium text-muted-foreground">Attributes</th>
              <th className="p-3 font-medium text-muted-foreground">
                <button
                  type="button"
                  className="inline-flex items-center gap-1"
                  onClick={() => toggleSort("price")}
                >
                  {SELL_PRICE_COLUMN} <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="p-3 font-medium text-muted-foreground">{MRP_COLUMN}</th>
              <th className="p-3 font-medium text-muted-foreground">{BUY_PRICE_COLUMN}</th>
              {showDimensions ? (
                <>
                  <th className="p-3 font-medium text-muted-foreground">L (cm)</th>
                  <th className="p-3 font-medium text-muted-foreground">W (cm)</th>
                  <th className="p-3 font-medium text-muted-foreground">H (cm)</th>
                  <th className="p-3 font-medium text-muted-foreground">Weight (kg)</th>
                </>
              ) : null}
              <th className="p-3 font-medium text-muted-foreground">Status</th>
              {!readOnly && <th className="p-3 font-medium text-muted-foreground">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pagedVariants.map((variant) => {
              const sellCell = displayPriceCell(variant.price, defaultSellingPrice);
              const mrpCell = displayPriceCell(null, defaultMrp);
              const buyCell = displayPriceCell(
                variant.purchase_price,
                defaultPurchasePrice || defaultStandardCost
              );
              const weightCell = displayDimensionCell(
                variant.dead_weight_kg,
                resolvedVariantDefaults.dead_weight_kg ?? "0"
              );
              const lengthCell = displayDimensionCell(
                variant.length_cm,
                resolvedVariantDefaults.length_cm ?? "0"
              );
              const widthCell = displayDimensionCell(
                variant.width_cm,
                resolvedVariantDefaults.width_cm ?? "0"
              );
              const heightCell = displayDimensionCell(
                variant.height_cm,
                resolvedVariantDefaults.height_cm ?? "0"
              );

              return (
              <tr key={variant.id} className="border-b border-border/40 last:border-0">
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
                <td
                  className={cn(
                    "p-3 text-right font-mono",
                    sellCell.inherited && "text-muted-foreground"
                  )}
                >
                  {sellCell.text}
                </td>
                <td
                  className={cn(
                    "p-3 text-right font-mono",
                    mrpCell.inherited && "text-muted-foreground"
                  )}
                >
                  {mrpCell.text}
                </td>
                <td
                  className={cn(
                    "p-3 text-right font-mono",
                    buyCell.inherited && "text-muted-foreground"
                  )}
                >
                  {buyCell.text}
                </td>
                {showDimensions ? (
                  <>
                    <td
                      className={cn(
                        "p-3 text-right font-mono text-xs",
                        lengthCell.inherited && "text-muted-foreground"
                      )}
                    >
                      {lengthCell.text}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right font-mono text-xs",
                        widthCell.inherited && "text-muted-foreground"
                      )}
                    >
                      {widthCell.text}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right font-mono text-xs",
                        heightCell.inherited && "text-muted-foreground"
                      )}
                    >
                      {heightCell.text}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right font-mono text-xs",
                        weightCell.inherited && "text-muted-foreground"
                      )}
                    >
                      {weightCell.text}
                    </td>
                  </>
                ) : null}
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
            );
            })}
            {pagedVariants.length === 0 && (
              <tr>
                <td
                  colSpan={
                    (readOnly ? 6 : 8) + (showDimensions ? 4 : 0)
                  }
                  className="p-6 text-center text-muted-foreground"
                >
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
        </>
      ) : null}

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
            : defaultVariantFormValues(itemId, resolvedVariantDefaults)
        }
        isEditing={Boolean(editingVariant)}
        onSaved={() => {
          setDrawerOpen(false);
          void onVariantsReload?.();
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
    </div>
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
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({ active: open });
  const skuManualRef = useRef(isEditing);

  const form = useForm<ItemVariantFormValues>({
    resolver: zodResolver(itemVariantSchema),
    defaultValues: initialValues,
  });

  const { register, handleSubmit, watch, setValue, formState: { errors }, reset } = form;
  const variantAttributes = watch("variant_attributes");
  const lengthCm = watch("length_cm");
  const widthCm = watch("width_cm");
  const heightCm = watch("height_cm");

  useEffect(() => {
    const computed = computeVolumeCm3FromDimensions(lengthCm, widthCm, heightCm);
    if (form.getValues("volume") === computed) return;
    setValue("volume", computed, { shouldDirty: true });
  }, [lengthCm, widthCm, heightCm, form, setValue]);

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
        const volume = computeVolumeCm3FromDimensions(
          values.length_cm,
          values.width_cm,
          values.height_cm
        );
        const result = await saveItemVariant({
          ...values,
          volume,
          item_id: itemId,
        });
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

  const closeForm = () => {
    onOpenChange(false);
  };

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose(closeForm))}
        title={isEditing ? "Edit variant" : "Add variant"}
      >
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="variant_sku">{VARIANT_SKU_LABEL}</Label>
                {skuMask.trim() ? (
                  <FieldLabelInfo label="Variant SKU">
                    <p className="font-mono">{VARIANT_FIELD_HELP.variantSkuMask(skuMask)}</p>
                  </FieldLabelInfo>
                ) : null}
              </div>
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
            {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="variant_barcode">GTIN</Label>
              <FieldLabelInfo label="GTIN">
                {fieldHelpText(VARIANT_FIELD_HELP.gtin)}
              </FieldLabelInfo>
            </div>
            <Input
              id="variant_barcode"
              disabled={isPending}
              className="font-mono"
              {...register("barcode")}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="variant_price">{SELL_PRICE_COLUMN}</Label>
              <FieldLabelInfo label={SELL_PRICE_COLUMN}>
                {fieldHelpText(VARIANT_FIELD_HELP.sellPrice)}
              </FieldLabelInfo>
            </div>
            <Input
              id="variant_price"
              disabled={isPending}
              className="text-right font-mono"
              inputMode="decimal"
              {...register("price")}
            />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium">Variant active</p>
              <FieldLabelInfo label="Variant active">
                {fieldHelpText(VARIANT_FIELD_HELP.active)}
              </FieldLabelInfo>
            </div>
            <Switch
              checked={watch("is_active")}
              disabled={isPending}
              onCheckedChange={(checked) => setValue("is_active", checked, { shouldDirty: true })}
            />
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-sm font-medium">Shipping & dimensions</h4>
            <div className={editorGridClass(true)}>
              <div
                className={cn(editorFieldSpanFullClass(true), editorDimensionsLwhGridClass())}
              >
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
              <div className={cn("space-y-2", editorFieldSpanFullClass(true))}>
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="variant_dead_weight">Weight (kg)</Label>
                  <FieldLabelInfo label="Weight (kg)">
                    {fieldHelpText(VARIANT_FIELD_HELP.weight)}
                  </FieldLabelInfo>
                </div>
                <Input
                  id="variant_dead_weight"
                  disabled={isPending}
                  className="text-right font-mono"
                  inputMode="decimal"
                  {...register("dead_weight_kg")}
                />
              </div>
              <p
                className={cn(
                  "text-xs text-muted-foreground",
                  editorFieldSpanFullClass(true)
                )}
              >
                {formatCalculatedVolumeInfo(lengthCm, widthCm, heightCm)}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <h4 className="text-sm font-medium">Variant attributes</h4>
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
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => requestClose(closeForm)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isEditing ? "Save Variant" : "Create Variant"}
          </Button>
        </div>
      </form>
    </RightDrawer>
    {discardDialog}
    </>
  );
}
