"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveSystemCategory } from "@/app/items/categories/actions";
import { AttributeTemplateBuilder } from "@/components/categories/attribute-template-builder";
import { CategoryFormSkeleton } from "@/components/categories/category-form-skeleton";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isDuplicateAttributeKey, normalizeAttributeKey } from "@/lib/categories/attribute-key";
import { validateAttributeTemplates } from "@/lib/categories/validate-templates";
import type { AttributeTemplateEntry, CategoryRow } from "@/lib/categories/types";
import { parentSelectOptions } from "@/lib/categories/tree";
import {
  PRODUCT_VARIANT_STRATEGIES,
  variantStrategyLabel,
  type ProductVariantStrategy,
} from "@/lib/products/variant-strategy";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CategoryRow[];
  editingCategory?: CategoryRow | null;
  onSaved: (categoryId: string) => void;
};

type FormState = {
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  default_variant_strategy: ProductVariantStrategy;
};

const defaultForm: FormState = {
  name: "",
  parent_id: null,
  is_active: true,
  attribute_templates: [],
  default_variant_strategy: "SINGLE_SKU",
};

export function CategoryDrawerForm({
  open,
  onOpenChange,
  rows,
  editingCategory = null,
  onSaved,
}: Props) {
  const router = useRouter();
  const isEditing = Boolean(editingCategory);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parentOptions = parentSelectOptions(rows, editingCategory?.id ?? null);

  useEffect(() => {
    if (!open) return;

    if (editingCategory) {
      setForm({
        name: editingCategory.name,
        parent_id: editingCategory.parent_id,
        is_active: editingCategory.is_active,
        attribute_templates: editingCategory.attribute_templates.map((entry) => ({ ...entry })),
        default_variant_strategy: editingCategory.default_variant_strategy,
      });
      setShowAdvanced(editingCategory.attribute_templates.length > 0);
    } else {
      setForm(defaultForm);
      setShowAdvanced(false);
    }
    setError(null);
  }, [open, editingCategory]);

  const handleClose = () => {
    onOpenChange(false);
    setForm(defaultForm);
    setShowAdvanced(false);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const templates = showAdvanced ? form.attribute_templates : [];
      for (let index = 0; index < templates.length; index += 1) {
        if (isDuplicateAttributeKey(templates, index)) {
          setError("Duplicate attribute template keys are not allowed.");
          return;
        }
      }

      const keys = new Set<string>();
      for (const entry of templates) {
        const key = normalizeAttributeKey(entry.key);
        if (!key) continue;
        if (keys.has(key)) {
          setError("Duplicate attribute template keys are not allowed.");
          return;
        }
        keys.add(key);
      }

      const optionsError = validateAttributeTemplates(templates);
      if (optionsError) {
        setError(optionsError);
        return;
      }

      const result = await saveSystemCategory({
        category_id: editingCategory?.id ?? null,
        name: form.name,
        parent_id: form.parent_id,
        is_active: form.is_active,
        attribute_templates: templates.filter((t) => t.key.trim()),
        default_variant_strategy: form.default_variant_strategy,
      });

      if ("error" in result) {
        setError(result.error ?? "Unable to save category.");
        return;
      }

      toast.success(
        isEditing ? "Product Category Updated Successfully" : "Product Category Saved Successfully"
      );
      handleClose();
      router.refresh();
      onSaved(result.categoryId);
    });
  };

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      title={isEditing ? "Edit Product Category" : "Create Product Category"}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        {isPending && (
          <div className="absolute inset-0 z-10 rounded-lg bg-background/80 p-4 backdrop-blur-sm">
            <CategoryFormSkeleton />
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name" className="text-sm font-medium text-muted-foreground">
              Category Commercial Name
            </Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Parent Category Association
            </Label>
            <Select
              value={form.parent_id ?? "root"}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, parent_id: value === "root" ? null : value }))
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {parentOptions.map((opt) => (
                  <SelectItem key={opt.id ?? "root"} value={opt.id ?? "root"}>
                    {"—".repeat(opt.depth)}
                    {opt.depth > 0 ? " " : ""}
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 p-3 dark:border-white/10">
            <Label htmlFor="cat-active" className="text-sm font-medium text-muted-foreground">
              Operational Status
            </Label>
            <Switch
              id="cat-active"
              checked={form.is_active}
              disabled={isPending}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Default variant strategy
            </Label>
            <Select
              value={form.default_variant_strategy}
              onValueChange={(value) =>
                setForm((f) => ({
                  ...f,
                  default_variant_strategy: value as ProductVariantStrategy,
                }))
              }
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_VARIANT_STRATEGIES.map((strategy) => (
                  <SelectItem key={strategy} value={strategy}>
                    {variantStrategyLabel(strategy)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              New products in this category inherit this strategy. Multi-variant style products use a
              style code only until sellable SKUs are generated.
            </p>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="show-advanced" className="text-sm font-medium text-muted-foreground">
              Show Advanced Parameters
            </Label>
            <Switch
              id="show-advanced"
              checked={showAdvanced}
              disabled={isPending}
              onCheckedChange={setShowAdvanced}
            />
          </div>

          {showAdvanced && (
            <AttributeTemplateBuilder
              key={editingCategory?.id ?? "create"}
              rows={form.attribute_templates}
              onChange={(attribute_templates) => setForm((f) => ({ ...f, attribute_templates }))}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="sticky bottom-0 mt-8 flex justify-end gap-2 border-t border-border/80 bg-background/95 pt-4 backdrop-blur-sm dark:border-white/10">
          <Button type="button" variant="ghost" disabled={isPending} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isEditing ? "Save Category Changes" : "Confirm & Save Product Category"}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}
