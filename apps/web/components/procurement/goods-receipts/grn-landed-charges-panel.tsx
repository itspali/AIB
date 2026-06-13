"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LandedCostAllocationMethod } from "@/lib/procurement/settings";
import { cn } from "@/lib/utils";

export type GrnLandedChargeDraft = {
  key: string;
  charge_type: string;
  amount: string;
  allocation_method: LandedCostAllocationMethod | "";
};

export const GRN_LANDED_CHARGE_TYPES = [
  { value: "FREIGHT", label: "Freight" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "HANDLING", label: "Handling" },
  { value: "CUSTOMS_CLEARANCE", label: "Customs clearance" },
  { value: "OTHER", label: "Other" },
] as const;

export function createEmptyGrnLandedCharge(): GrnLandedChargeDraft {
  return {
    key: crypto.randomUUID(),
    charge_type: "FREIGHT",
    amount: "",
    allocation_method: "",
  };
}

type Props = {
  charges: GrnLandedChargeDraft[];
  defaultAllocationMethod: LandedCostAllocationMethod;
  disabled?: boolean;
  className?: string;
  onChange: (charges: GrnLandedChargeDraft[]) => void;
};

function allocationMethodLabel(method: LandedCostAllocationMethod): string {
  switch (method) {
    case "BY_QUANTITY":
      return "By quantity";
    case "BY_VALUE":
      return "By value";
    case "BY_WEIGHT":
      return "By weight";
    default:
      return method;
  }
}

export function GrnLandedChargesPanel({
  charges,
  defaultAllocationMethod,
  disabled = false,
  className,
  onChange,
}: Props) {
  const patchCharge = (key: string, patch: Partial<GrnLandedChargeDraft>) => {
    onChange(charges.map((charge) => (charge.key === key ? { ...charge, ...patch } : charge)));
  };

  const removeCharge = (key: string) => {
    onChange(charges.filter((charge) => charge.key !== key));
  };

  return (
    <div className={cn("surface-inset space-y-3 rounded-lg p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Landed charges</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Optional freight and handling costs allocated to paid lines using workspace default (
            {allocationMethodLabel(defaultAllocationMethod)}).
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...charges, createEmptyGrnLandedCharge()])}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add charge
        </Button>
      </div>

      {charges.length === 0 ? (
        <p className="text-sm text-muted-foreground">No additional landed charges on this receipt.</p>
      ) : (
        <div className="space-y-3">
          {charges.map((charge) => (
            <div
              key={charge.key}
              className="grid grid-cols-1 gap-3 rounded-md border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_auto]"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Charge type</Label>
                <Select
                  value={charge.charge_type}
                  disabled={disabled}
                  onValueChange={(value) => patchCharge(charge.key, { charge_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRN_LANDED_CHARGE_TYPES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount</Label>
                <Input
                  value={charge.amount}
                  disabled={disabled}
                  inputMode="decimal"
                  placeholder="0.00"
                  onChange={(event) => patchCharge(charge.key, { amount: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Allocation override</Label>
                <Select
                  value={charge.allocation_method || "default"}
                  disabled={disabled}
                  onValueChange={(value) =>
                    patchCharge(charge.key, {
                      allocation_method:
                        value === "default" ? "" : (value as LandedCostAllocationMethod),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use workspace default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">
                      Default ({allocationMethodLabel(defaultAllocationMethod)})
                    </SelectItem>
                    <SelectItem value="BY_QUANTITY">By quantity</SelectItem>
                    <SelectItem value="BY_VALUE">By value</SelectItem>
                    <SelectItem value="BY_WEIGHT">By weight</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  aria-label="Remove landed charge"
                  onClick={() => removeCharge(charge.key)}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function filterSavableGrnLandedCharges(
  charges: GrnLandedChargeDraft[]
): Array<{ charge_type: string; amount: string; allocation_method?: LandedCostAllocationMethod }> {
  return charges
    .filter((charge) => charge.charge_type.trim() && Number(charge.amount) > 0)
    .map((charge) => ({
      charge_type: charge.charge_type.trim(),
      amount: charge.amount.trim(),
      ...(charge.allocation_method ? { allocation_method: charge.allocation_method } : {}),
    }));
}
