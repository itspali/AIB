"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveUom } from "@/app/settings/catalogs/uom/actions";
import { UomPeekPanel } from "@/components/inventory/uom/uom-peek-panel";
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
import { isMutationSurface, type DrawerSurface } from "@/lib/layout/module-drawer-url";
import {
  defaultUomFormValues,
  UOM_FAMILIES,
  uomFamilyLabel,
  type UomFamily,
  type UomFormValues,
  type UomRow,
} from "@/lib/uom/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  row?: UomRow | null;
  canManage?: boolean;
  onClose: () => void;
  onAfterSave: (uomId: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
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

function resolveDrawerTitle(surface: DrawerSurface, row: UomRow | null): string {
  if (surface === "create") return "New unit";
  if (surface === "edit") return "Edit unit";
  return row?.name ?? "Unit of measure";
}

function UomMutateForm({
  row,
  isPending,
  onPatch,
  onSubmit,
  onCancel,
  form,
  error,
}: {
  row: UomRow | null;
  isPending: boolean;
  form: UomFormValues;
  error: string | null;
  onPatch: (next: Partial<UomFormValues>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const isEditing = Boolean(row);

  return (
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
              onChange={(e) => onPatch({ code: e.target.value })}
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
              onChange={(e) => onPatch({ name: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">Family</Label>
          <Select
            value={form.family}
            disabled={isPending}
            onValueChange={(value) => onPatch({ family: value as UomFamily })}
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

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 border-black/[0.06] p-3 dark:border-white/10">
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
              onPatch({
                is_family_base: checked,
                factor_to_base: checked ? "1" : form.factor_to_base,
              })
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
            onChange={(e) => onPatch({ factor_to_base: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            How many base units one of this unit equals (e.g. 1 Dozen = 12 base).
          </p>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 border-black/[0.06] p-3 dark:border-white/10">
          <Label htmlFor="uom-active" className="text-sm font-medium text-muted-foreground">
            Active
          </Label>
          <Switch
            id="uom-active"
            checked={form.is_active}
            disabled={isPending}
            onCheckedChange={(checked) => onPatch({ is_active: checked })}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      <div className="sticky bottom-0 mt-8 flex justify-end gap-2 border-t border-border/80 border-black/[0.06] bg-background/95 pt-4 backdrop-blur-sm dark:border-white/10">
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={isPending} onClick={onSubmit}>
          {isEditing ? "Save changes" : "Create unit"}
        </Button>
      </div>
    </div>
  );
}

export function UomDrawerForm({
  open,
  surface,
  row = null,
  canManage = false,
  onClose,
  onAfterSave,
  onEdit,
  onDelete,
}: Props) {
  const router = useRouter();
  const isMutating = isMutationSurface(surface);
  const editingRow = surface === "edit" ? row : null;
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: open && isMutating,
  });
  const [form, setForm] = useState<UomFormValues>(toFormValues(editingRow));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setForm(toFormValues(surface === "create" ? null : editingRow));
    setError(null);
  }, [open, surface, editingRow]);

  const patch = (next: Partial<UomFormValues>) => setForm((current) => ({ ...current, ...next }));

  const closeDrawer = () => {
    onClose();
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
      toast.success(editingRow ? "Unit updated" : "Unit created");
      router.refresh();
      onAfterSave(result.uomId);
    });
  };

  const drawerBody =
    surface === "peek" && row ? (
      <UomPeekPanel row={row} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
    ) : isMutating ? (
      <UomMutateForm
        row={editingRow}
        form={form}
        error={error}
        isPending={isPending}
        onPatch={patch}
        onSubmit={handleSubmit}
        onCancel={() => requestClose(closeDrawer)}
      />
    ) : null;

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          if (isMutating) {
            requestClose(closeDrawer);
            return;
          }
          closeDrawer();
        }}
        title={resolveDrawerTitle(surface, row)}
        widthPolicy={surface === "peek" ? "peek" : "mutate"}
        allowBackgroundInteraction={surface === "peek"}
        peekMode={surface === "peek"}
        bodyClassName={cn(surface === "peek" && "module-drawer-peek-body")}
      >
        {drawerBody}
      </RightDrawer>
      {discardDialog}
    </>
  );
}
