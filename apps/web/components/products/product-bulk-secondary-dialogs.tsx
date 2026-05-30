"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { getProductCatalogContext } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import { ITEM_CLASSIFICATIONS, classificationLabel } from "@/lib/products/classification-labels";
import type { ProductCatalogContext } from "@/lib/products/types";
import { TAX_CATEGORY_OPTIONS, taxCategoryLabel } from "@/lib/products/tax-options";

type DialogShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  selectedCount: number;
  isPending: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  children: ReactNode;
};

function BulkDialogShell({
  open,
  onOpenChange,
  title,
  description,
  isPending,
  canSubmit,
  onSubmit,
  children,
}: DialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSubmit || isPending} onClick={() => onSubmit()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ProductBulkCategoryDialog({
  open,
  onOpenChange,
  categories,
  selectedCount,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRow[];
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { category_id: string }) => void;
}) {
  const [categoryId, setCategoryId] = useState("");
  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories.filter((row) => row.is_active));
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  return (
    <BulkDialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) setCategoryId("");
        onOpenChange(next);
      }}
      title="Change category"
      description={`Assign a new category to ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}. HSN and tax fields are not changed.`}
      selectedCount={selectedCount}
      isPending={isPending}
      canSubmit={Boolean(categoryId)}
      onSubmit={() => onSubmit({ category_id: categoryId })}
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} disabled={isPending}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </BulkDialogShell>
  );
}

export function ProductBulkClassificationDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { classification: (typeof ITEM_CLASSIFICATIONS)[number] }) => void;
}) {
  const [classification, setClassification] =
    useState<(typeof ITEM_CLASSIFICATIONS)[number]>("PHYSICAL_GOOD");

  return (
    <BulkDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Change classification"
      description={`Update inventory classification for ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}.`}
      selectedCount={selectedCount}
      isPending={isPending}
      canSubmit
      onSubmit={() => onSubmit({ classification })}
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Classification</Label>
        <Select
          value={classification}
          onValueChange={(value) =>
            setClassification(value as (typeof ITEM_CLASSIFICATIONS)[number])
          }
          disabled={isPending}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ITEM_CLASSIFICATIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {classificationLabel(value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </BulkDialogShell>
  );
}

export function ProductBulkTaxCategoryDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { default_tax_category: (typeof TAX_CATEGORY_OPTIONS)[number] }) => void;
}) {
  const [taxCategory, setTaxCategory] =
    useState<(typeof TAX_CATEGORY_OPTIONS)[number]>("STANDARD");

  return (
    <BulkDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Set tax category"
      description={`Update default tax category for ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}.`}
      selectedCount={selectedCount}
      isPending={isPending}
      canSubmit
      onSubmit={() => onSubmit({ default_tax_category: taxCategory })}
    >
      <div className="space-y-2">
        <Label className="text-sm font-medium text-muted-foreground">Tax category</Label>
        <Select
          value={taxCategory}
          onValueChange={(value) =>
            setTaxCategory(value as (typeof TAX_CATEGORY_OPTIONS)[number])
          }
          disabled={isPending}
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
      </div>
    </BulkDialogShell>
  );
}

function FlagRow({
  label,
  apply,
  value,
  disabled,
  onApplyChange,
  onValueChange,
}: {
  label: string;
  apply: boolean;
  value: boolean;
  disabled?: boolean;
  onApplyChange: (checked: boolean) => void;
  onValueChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={apply} onCheckedChange={(checked) => onApplyChange(checked === true)} />
        <span>Update {label}</span>
      </label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{value ? "Yes" : "No"}</span>
        <Switch checked={value} disabled={disabled || !apply} onCheckedChange={onValueChange} />
      </div>
    </div>
  );
}

export function ProductBulkFlagsDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: {
    apply_purchasable: boolean;
    is_purchasable: boolean;
    apply_salable: boolean;
    is_salable: boolean;
    apply_returnable: boolean;
    is_returnable: boolean;
  }) => void;
}) {
  const [applyPurchasable, setApplyPurchasable] = useState(false);
  const [isPurchasable, setIsPurchasable] = useState(true);
  const [applySalable, setApplySalable] = useState(false);
  const [isSalable, setIsSalable] = useState(true);
  const [applyReturnable, setApplyReturnable] = useState(false);
  const [isReturnable, setIsReturnable] = useState(true);

  const canSubmit = applyPurchasable || applySalable || applyReturnable;

  return (
    <BulkDialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setApplyPurchasable(false);
          setApplySalable(false);
          setApplyReturnable(false);
        }
        onOpenChange(next);
      }}
      title="Operational flags"
      description={`Update purchasable, salable, and returnable flags for ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}.`}
      selectedCount={selectedCount}
      isPending={isPending}
      canSubmit={canSubmit}
      onSubmit={() =>
        onSubmit({
          apply_purchasable: applyPurchasable,
          is_purchasable: isPurchasable,
          apply_salable: applySalable,
          is_salable: isSalable,
          apply_returnable: applyReturnable,
          is_returnable: isReturnable,
        })
      }
    >
      <div className="space-y-2">
        <FlagRow
          label="purchasable"
          apply={applyPurchasable}
          value={isPurchasable}
          disabled={isPending}
          onApplyChange={setApplyPurchasable}
          onValueChange={setIsPurchasable}
        />
        <FlagRow
          label="salable"
          apply={applySalable}
          value={isSalable}
          disabled={isPending}
          onApplyChange={setApplySalable}
          onValueChange={setIsSalable}
        />
        <FlagRow
          label="returnable"
          apply={applyReturnable}
          value={isReturnable}
          disabled={isPending}
          onApplyChange={setApplyReturnable}
          onValueChange={setIsReturnable}
        />
      </div>
    </BulkDialogShell>
  );
}

export function ProductBulkTagsDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { mode: "ADD" | "REMOVE"; tag_ids: string[] }) => void;
}) {
  const [mode, setMode] = useState<"ADD" | "REMOVE">("ADD");
  const [catalogContext, setCatalogContext] = useState<ProductCatalogContext | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    void getProductCatalogContext()
      .then((result) => setCatalogContext(result.catalogContext))
      .finally(() => setIsLoading(false));
  }, [open]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    );
  };

  return (
    <BulkDialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelectedTags([]);
          setMode("ADD");
        }
        onOpenChange(next);
      }}
      title="Modify tags"
      description={`Add or remove discovery tags on ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"}.`}
      selectedCount={selectedCount}
      isPending={isPending}
      canSubmit={selectedTags.length > 0}
      onSubmit={() => onSubmit({ mode, tag_ids: selectedTags })}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Action</Label>
          <Select value={mode} onValueChange={(value) => setMode(value as "ADD" | "REMOVE")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADD">Add tags</SelectItem>
              <SelectItem value="REMOVE">Remove tags</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tags…</p>
          ) : catalogContext?.tags.length ? (
            catalogContext.tags.map((tag) => (
              <label key={tag.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedTags.includes(tag.id)}
                  onCheckedChange={() => toggleTag(tag.id)}
                />
                <span>{tag.name}</span>
              </label>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No tags available in this workspace.</p>
          )}
        </div>
      </div>
    </BulkDialogShell>
  );
}

export function ProductBulkStorefrontDialog({
  open,
  onOpenChange,
  selectedCount,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { storefront_id: string; is_visible: boolean }) => void;
}) {
  const [storefrontId, setStorefrontId] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [catalogContext, setCatalogContext] = useState<ProductCatalogContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    void getProductCatalogContext()
      .then((result) => setCatalogContext(result.catalogContext))
      .finally(() => setIsLoading(false));
  }, [open]);

  return (
    <BulkDialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setStorefrontId("");
          setIsVisible(true);
        }
        onOpenChange(next);
      }}
      title="Storefront visibility"
      description={`Show or hide ${selectedCount} selected item master${selectedCount === 1 ? "" : "s"} on a storefront channel.`}
      selectedCount={selectedCount}
      isPending={isPending}
      canSubmit={Boolean(storefrontId)}
      onSubmit={() => onSubmit({ storefront_id: storefrontId, is_visible: isVisible })}
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Storefront</Label>
          <Select
            value={storefrontId}
            onValueChange={setStorefrontId}
            disabled={isPending || isLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? "Loading…" : "Select storefront"} />
            </SelectTrigger>
            <SelectContent>
              {catalogContext?.storefronts.map((storefront) => (
                <SelectItem key={storefront.id} value={storefront.id}>
                  {storefront.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
          <span className="text-sm">Visible on storefront</span>
          <Switch checked={isVisible} onCheckedChange={setIsVisible} disabled={isPending} />
        </div>
      </div>
    </BulkDialogShell>
  );
}
