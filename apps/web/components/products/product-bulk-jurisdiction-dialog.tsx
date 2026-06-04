"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { fetchActiveTaxCodeOptions, type TaxCodeOption } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
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
  SelectItemWithDescription,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/lib/categories/types";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import { taxCategoryLabel, type TaxCategory } from "@/lib/products/tax-options";

function deriveTaxCategory(rate: number, kind: string): TaxCategory {
  if (kind === "EXEMPT") return "NON_TAXABLE";
  if (kind === "ZERO" || kind === "NIL" || !Number.isFinite(rate) || rate === 0) return "TAXABLE";
  return "TAXABLE";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRow[];
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { category_id: string; tax_code_id: string }) => void;
};

export function ProductBulkJurisdictionDialog({
  open,
  onOpenChange,
  categories,
  selectedCount,
  isPending,
  onSubmit,
}: Props) {
  const [categoryId, setCategoryId] = useState("");
  const [taxCodeId, setTaxCodeId] = useState("");
  const [taxOptions, setTaxOptions] = useState<TaxCodeOption[]>([]);
  const [isLoadingTax, setIsLoadingTax] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories.filter((row) => row.is_active));
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  const selectedTax = taxOptions.find((row) => row.id === taxCodeId) ?? null;
  const previewTaxCategory = selectedTax
    ? taxCategoryLabel(deriveTaxCategory(Number(selectedTax.rate), selectedTax.kind))
    : null;

  useEffect(() => {
    if (!open) return;

    setIsLoadingTax(true);
    setLoadError(null);
    void (async () => {
      const result = await fetchActiveTaxCodeOptions({ includeTaxCodeId: taxCodeId || null });
      if ("error" in result) {
        setLoadError(result.error);
        setTaxOptions([]);
        return;
      }
      setTaxOptions(result.options);
    })().finally(() => setIsLoadingTax(false));
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next && !isPending) {
      setCategoryId("");
      setTaxCodeId("");
      setLoadError(null);
    }
    onOpenChange(next);
  };

  const canSubmit = Boolean(categoryId && taxCodeId && !isPending);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk statutory jurisdiction sync</DialogTitle>
          <DialogDescription>
            Reallocate category and tax rule for {selectedCount} selected product
            {selectedCount === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-1">
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

          <div className="space-y-2 md:col-span-1">
            <Label className="text-sm font-medium text-muted-foreground">Tax rule</Label>
            <Select
              value={taxCodeId}
              onValueChange={setTaxCodeId}
              disabled={isPending || isLoadingTax}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingTax ? "Loading…" : "Select tax rule"} />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4}>
                {taxOptions.map((option) => (
                  <SelectItemWithDescription
                    key={option.id}
                    value={option.id}
                    label={option.pickerLabel}
                    description={option.pickerDescription}
                  />
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}

        {taxOptions.length === 0 && !isLoadingTax && !loadError ? (
          <p className="text-xs text-muted-foreground">
            No active tax rules yet. Create one under Settings → Tax Settings first.
          </p>
        ) : null}

        {selectedTax ? (
          <p className="text-xs text-muted-foreground">
            Items will be bound to{" "}
            <span className="font-mono text-foreground">{selectedTax.code}</span>
            {previewTaxCategory ? (
              <>
                {" "}
                · Tax category → <span className="text-foreground">{previewTaxCategory}</span>
              </>
            ) : null}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onSubmit({ category_id: categoryId, tax_code_id: taxCodeId })}
          >
            {isPending ? <Spinner /> : null}
            Apply sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
