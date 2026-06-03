"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveUom } from "@/app/settings/uom/actions";
import { RightDrawer } from "@/components/ui/right-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import {
  defaultUomFormValues,
  UOM_FAMILIES,
  uomFamilyLabel,
  type UomFamily,
  type UomFormValues,
  type UomRow,
} from "@/lib/uom/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: UomRow | null;
  onSaved: (uomId: string) => void;
};

function toFormValues(row: UomRow | null): UomFormValues {
  if (!row) return { ...defaultUomFormValues };
  return {
    uom_id: row.id,
    code: row.code,
    name: row.name,
    family: row.family,
    factor_to_base: String(row.factor_to_base),
    is_family_base: row.is_family_base,
    is_active: row.is_active,
  };
}

export function UomDrawerForm({ open, onOpenChange, editing = null, onSaved }: Props) {
  const router = useRouter();
  const isEditing = Boolean(editing);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({ active: open });
  const [form, setForm] = useState<UomFormValues>(toFormValues(editing));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(editing));
    setError(null);
  }, [open, editing]);

  const patch = (next: Partial<UomFormValues>) => setForm((current) => ({ ...current, ...next }));

  const closeForm = () => {
    onOpenChange(false);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveUom(form);
      if ("error" in result) {
        setError(result.error ?? "Unable to save unit of measure.");
        return;
      }
      toast.success(isEditing ? "Unit updated" : "Unit created");
      closeForm();
      router.refresh();
      onSaved(result.uomId);
    });
  };

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : requestClose(closeForm))}
        title={isEditing ? "Edit unit" : "New unit"}
      >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="uom-code" className="text-sm font-medium text-muted-foreground">
                Code
              </Label>
              <Input
                id="uom-code"
                className="font-mono uppercase"
                placeholder="PCS"
                value={form.code}
                disabled={isPending}
                onChange={(e) => patch({ code: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uom-name" className="text-sm font-medium text-muted-foreground">
                Name
              </Label>
              <Input
                id="uom-name"
                placeholder="Pieces"
                value={form.name}
                disabled={isPending}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">Family</Label>
            <Select
              value={form.family}
              disabled={isPending}
              onValueChange={(value) => patch({ family: value as UomFamily })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UOM_FAMILIES.map((family) => (
                  <SelectItem key={family} value={family}>
                    {uomFamilyLabel(family)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 p-3 dark:border-white/10">
            <div>
              <Label htmlFor="uom-base" className="text-sm font-medium">
                Base unit of this family
              </Label>
              <p className="text-xs text-muted-foreground">
                The reference unit (factor 1) others convert to. Only one base per family.
              </p>
            </div>
            <Switch
              id="uom-base"
              checked={form.is_family_base}
              disabled={isPending}
              onCheckedChange={(checked) =>
                patch({ is_family_base: checked, factor_to_base: checked ? "1" : form.factor_to_base })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uom-factor" className="text-sm font-medium text-muted-foreground">
              Conversion factor to base
            </Label>
            <Input
              id="uom-factor"
              inputMode="decimal"
              className="text-right font-mono"
              value={form.is_family_base ? "1" : form.factor_to_base}
              disabled={isPending || form.is_family_base}
              onChange={(e) => patch({ factor_to_base: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              How many base units one of this unit equals (e.g. 1 Dozen = 12 base).
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 p-3 dark:border-white/10">
            <Label htmlFor="uom-active" className="text-sm font-medium text-muted-foreground">
              Active
            </Label>
            <Switch
              id="uom-active"
              checked={form.is_active}
              disabled={isPending}
              onCheckedChange={(checked) => patch({ is_active: checked })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="sticky bottom-0 mt-8 flex justify-end gap-2 border-t border-border/80 bg-background/95 pt-4 backdrop-blur-sm dark:border-white/10">
          <Button type="button" variant="ghost" disabled={isPending} onClick={() => requestClose(closeForm)}>
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isEditing ? "Save changes" : "Create unit"}
          </Button>
        </div>
      </div>
    </RightDrawer>
    {discardDialog}
    </>
  );
}
