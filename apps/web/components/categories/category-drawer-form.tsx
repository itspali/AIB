"use client";

import { useState, useTransition } from "react";
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
import type { AttributeTemplateEntry, CategoryRow } from "@/lib/categories/types";
import { parentSelectOptions } from "@/lib/categories/tree";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: CategoryRow[];
  onSaved: (categoryId: string) => void;
};

const defaultForm = {
  name: "",
  parent_id: null as string | null,
  is_active: true,
  attribute_templates: [] as AttributeTemplateEntry[],
};

export function CategoryDrawerForm({ open, onOpenChange, rows, onSaved }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(defaultForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parentOptions = parentSelectOptions(rows);

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
      const keys = new Set<string>();
      for (const entry of templates) {
        const key = entry.key.trim();
        if (!key) continue;
        if (keys.has(key)) {
          setError("Duplicate attribute template keys are not allowed.");
          return;
        }
        keys.add(key);
      }

      const result = await saveSystemCategory({
        name: form.name,
        parent_id: form.parent_id,
        is_active: form.is_active,
        attribute_templates: templates.filter((t) => t.key.trim()),
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      toast.success("System Category Saved Successfully");
      handleClose();
      router.refresh();
      if (result.categoryId) onSaved(result.categoryId);
    });
  };

  return (
    <RightDrawer open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())} title="Create System Category">
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
            Confirm & Save System Category
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}
