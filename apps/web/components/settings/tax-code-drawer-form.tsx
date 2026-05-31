"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveTaxCode } from "@/app/settings/tax/actions";
import { TaxSlabEditor } from "@/components/settings/tax-slab-editor";
import { TaxRulePreview } from "@/components/settings/tax-rule-preview";
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
import {
  defaultTaxCodeFormValues,
  TAX_CODE_KINDS,
  taxCodeKindLabel,
  type TaxCodeFormValues,
  type TaxCodeKind,
  type TaxCodeRow,
} from "@/lib/tax/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: TaxCodeRow | null;
  onSaved: (taxCodeId: string) => void;
};

function toFormValues(row: TaxCodeRow | null): TaxCodeFormValues {
  if (!row) return { ...defaultTaxCodeFormValues };
  return {
    tax_code_id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    rate: String(row.rate),
    is_inclusive_default: row.is_inclusive_default,
    is_variable: row.is_variable,
    effective_from: row.effective_from,
    effective_to: row.effective_to,
    is_active: row.is_active,
    components: row.components.map((component) => ({
      name: component.name,
      rate: String(component.rate),
      sort_order: component.sort_order,
    })),
    rules: row.rules.map((rule) => ({
      basis: rule.basis,
      threshold_min: String(rule.threshold_min),
      threshold_max: rule.threshold_max === null ? "" : String(rule.threshold_max),
      rate: String(rule.rate),
    })),
  };
}

function toNumber(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function TaxCodeDrawerForm({ open, onOpenChange, editing = null, onSaved }: Props) {
  const router = useRouter();
  const isEditing = Boolean(editing);
  const [form, setForm] = useState<TaxCodeFormValues>(toFormValues(editing));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(editing));
    setError(null);
  }, [open, editing]);

  const patch = (next: Partial<TaxCodeFormValues>) => setForm((current) => ({ ...current, ...next }));

  const handleClose = () => {
    onOpenChange(false);
    setError(null);
  };

  const addComponent = () => {
    patch({
      components: [
        ...form.components,
        { name: "", rate: "0", sort_order: form.components.length },
      ],
    });
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveTaxCode(form);
      if ("error" in result) {
        setError(result.error ?? "Unable to save tax rule.");
        return;
      }
      toast.success(isEditing ? "Tax rule updated" : "Tax rule created");
      handleClose();
      router.refresh();
      onSaved(result.taxCodeId);
    });
  };

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}
      title={isEditing ? "Edit tax rule" : "New tax rule"}
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-code" className="text-sm font-medium text-muted-foreground">
                Code
              </Label>
              <Input
                id="tax-code"
                className="font-mono uppercase"
                placeholder="GST18"
                value={form.code}
                disabled={isPending}
                onChange={(e) => patch({ code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-name" className="text-sm font-medium text-muted-foreground">
                Name
              </Label>
              <Input
                id="tax-name"
                placeholder="GST 18%"
                value={form.name}
                disabled={isPending}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Kind</Label>
            <Select
              value={form.kind}
              disabled={isPending}
              onValueChange={(value) => patch({ kind: value as TaxCodeKind })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_CODE_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {taxCodeKindLabel(kind)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 p-3 dark:border-white/10">
            <div>
              <Label htmlFor="tax-variable" className="text-sm font-medium">
                Variable (slab) rates
              </Label>
              <p className="text-xs text-muted-foreground">
                Resolve the rate from value-based tiers instead of one flat rate.
              </p>
            </div>
            <Switch
              id="tax-variable"
              checked={form.is_variable}
              disabled={isPending}
              onCheckedChange={(checked) => patch({ is_variable: checked })}
            />
          </div>

          {form.is_variable ? (
            <TaxSlabEditor
              rules={form.rules}
              disabled={isPending}
              onChange={(rules) => patch({ rules })}
            />
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tax-rate" className="text-sm font-medium text-muted-foreground">
                Rate %
              </Label>
              <Input
                id="tax-rate"
                inputMode="decimal"
                className="text-right font-mono"
                value={form.rate}
                disabled={isPending}
                onChange={(e) => patch({ rate: e.target.value })}
              />
            </div>
          )}

          <TaxRulePreview
            isVariable={form.is_variable}
            rate={toNumber(form.rate)}
            rules={form.rules.map((rule) => ({
              basis: rule.basis,
              threshold_min: toNumber(rule.threshold_min),
              threshold_max: rule.threshold_max.trim() === "" ? null : toNumber(rule.threshold_max),
              rate: toNumber(rule.rate),
            }))}
          />

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">
                Components (CGST / SGST / IGST / CESS)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={addComponent}
              >
                <Plus className="h-4 w-4" />
                Add component
              </Button>
            </div>
            {form.components.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Optional. Add components to record the statutory split for returns.
              </p>
            ) : (
              <div className="space-y-2">
                {form.components.map((component, index) => (
                  <div key={index} className="flex items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Name</Label>
                      <Input
                        value={component.name}
                        disabled={isPending}
                        placeholder="CGST"
                        onChange={(e) =>
                          patch({
                            components: form.components.map((c, i) =>
                              i === index ? { ...c, name: e.target.value } : c
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="w-28 space-y-1">
                      <Label className="text-xs text-muted-foreground">Rate %</Label>
                      <Input
                        inputMode="decimal"
                        className="text-right font-mono"
                        value={component.rate}
                        disabled={isPending}
                        onChange={(e) =>
                          patch({
                            components: form.components.map((c, i) =>
                              i === index ? { ...c, rate: e.target.value } : c
                            ),
                          })
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      aria-label="Remove component"
                      onClick={() =>
                        patch({
                          components: form.components.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax-eff-from" className="text-sm font-medium text-muted-foreground">
                Effective from
              </Label>
              <Input
                id="tax-eff-from"
                type="date"
                value={form.effective_from ?? ""}
                disabled={isPending}
                onChange={(e) => patch({ effective_from: e.target.value || null })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-eff-to" className="text-sm font-medium text-muted-foreground">
                Effective to
              </Label>
              <Input
                id="tax-eff-to"
                type="date"
                value={form.effective_to ?? ""}
                disabled={isPending}
                onChange={(e) => patch({ effective_to: e.target.value || null })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 p-3 dark:border-white/10">
            <Label htmlFor="tax-inclusive" className="text-sm font-medium text-muted-foreground">
              Prices include this tax by default
            </Label>
            <Switch
              id="tax-inclusive"
              checked={form.is_inclusive_default}
              disabled={isPending}
              onCheckedChange={(checked) => patch({ is_inclusive_default: checked })}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 p-3 dark:border-white/10">
            <Label htmlFor="tax-active" className="text-sm font-medium text-muted-foreground">
              Active
            </Label>
            <Switch
              id="tax-active"
              checked={form.is_active}
              disabled={isPending}
              onCheckedChange={(checked) => patch({ is_active: checked })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="sticky bottom-0 mt-8 flex justify-end gap-2 border-t border-border/80 bg-background/95 pt-4 backdrop-blur-sm dark:border-white/10">
          <Button type="button" variant="ghost" disabled={isPending} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isEditing ? "Save changes" : "Create tax rule"}
          </Button>
        </div>
      </div>
    </RightDrawer>
  );
}
