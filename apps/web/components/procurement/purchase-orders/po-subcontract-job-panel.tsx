"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";

type Props = {
  form: PoDraftFormState;
  supplierHasSubcontractWip: boolean;
  disabled?: boolean;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

export function PoSubcontractJobPanel({
  form,
  supplierHasSubcontractWip,
  disabled = false,
  onPatch,
}: Props) {
  if (!supplierHasSubcontractWip) return null;

  const checkboxId = "po-is-subcontract-job";

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={form.is_subcontract_job}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onPatch({ is_subcontract_job: checked === true })
          }
        />
        <div className="space-y-1">
          <Label htmlFor={checkboxId} className="font-medium leading-none">
            Subcontract job order
          </Label>
          <p className="text-sm text-muted-foreground">
            When this purchase order is received, finished goods posting will backflush
            subcontract BOM components from the vendor WIP location linked to this supplier.
          </p>
        </div>
      </div>
    </div>
  );
}
