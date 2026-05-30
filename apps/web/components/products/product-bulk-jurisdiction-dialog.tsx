"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchActiveTaxRateOptions, type TaxRateOption } from "@/app/items/actions";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryRow } from "@/lib/categories/types";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import { taxCategoryLabel, type TaxCategory } from "@/lib/products/tax-options";

function isValidStatutoryCode(code: string | null | undefined): boolean {
  const trimmed = code?.trim() ?? "";
  if (trimmed.length < 4) return false;
  const upper = trimmed.toUpperCase();
  return upper !== "HSN" && upper !== "SAC";
}

function deriveTaxCategory(percentage: string): TaxCategory {
  const parsed = Number(percentage);
  if (!Number.isFinite(parsed) || parsed === 0) return "ZERO_RATED";
  if (parsed > 0 && parsed < 18) return "REDUCED";
  return "STANDARD";
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryRow[];
  selectedCount: number;
  isPending: boolean;
  onSubmit: (payload: { category_id: string; tax_rate_id: string }) => void;
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
  const [taxRateId, setTaxRateId] = useState("");
  const [taxOptions, setTaxOptions] = useState<TaxRateOption[]>([]);
  const [isLoadingTax, setIsLoadingTax] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories.filter((row) => row.is_active));
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  const selectedTax = taxOptions.find((row) => row.id === taxRateId) ?? null;
  const previewHsn = selectedTax?.legal_compliance_code?.trim() ?? "";
  const previewValid = isValidStatutoryCode(previewHsn);
  const previewTaxCategory = selectedTax
    ? taxCategoryLabel(deriveTaxCategory(selectedTax.tax_percentage))
    : null;

  useEffect(() => {
    if (!open) return;

    setIsLoadingTax(true);
    setLoadError(null);
    void (async () => {
      const result = await fetchActiveTaxRateOptions();
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
      setTaxRateId("");
      setLoadError(null);
    }
    onOpenChange(next);
  };

  const canSubmit = Boolean(categoryId && taxRateId && previewValid && !isPending);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk statutory jurisdiction sync</DialogTitle>
          <DialogDescription>
            Reallocate category and statutory codes for {selectedCount} selected item master
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
            <Label className="text-sm font-medium text-muted-foreground">Tax rate registry</Label>
            <Select
              value={taxRateId}
              onValueChange={setTaxRateId}
              disabled={isPending || isLoadingTax}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingTax ? "Loading…" : "Select tax component"} />
              </SelectTrigger>
              <SelectContent>
                {taxOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.tax_component_name} ({option.tax_percentage}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}

        {selectedTax ? (
          <p className="text-xs text-muted-foreground">
            {previewValid ? (
              <>
                HSN/SAC will be set to{" "}
                <span className="font-mono text-foreground">{previewHsn}</span>
                {previewTaxCategory ? (
                  <>
                    {" "}
                    · Tax category → <span className="text-foreground">{previewTaxCategory}</span>
                  </>
                ) : null}
              </>
            ) : (
              <span className="text-destructive">
                Selected tax registry row needs a valid statutory code (at least 4 characters, not
                just HSN/SAC).
              </span>
            )}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => onSubmit({ category_id: categoryId, tax_rate_id: taxRateId })}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Apply sync
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
