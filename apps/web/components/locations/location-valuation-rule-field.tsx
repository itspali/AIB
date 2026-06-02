"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LocationFormValues } from "@/lib/locations/types";
import { locationSupportsValuationRule } from "@/lib/locations/valuation-rule";
import { VALUATION_METHOD_OPTIONS } from "@/lib/organization/naming-options";
import type { ValuationMethodOption } from "@/lib/organization/naming-options";

type Props = {
  form: Pick<
    LocationFormValues,
    "is_stock_holding" | "is_commercial_storefront" | "valuation_calculation_rule"
  >;
  defaultInventoryValuationMethod: ValuationMethodOption;
  onChange: (value: ValuationMethodOption | null) => void;
};

export function LocationValuationRuleField({
  form,
  defaultInventoryValuationMethod,
  onChange,
}: Props) {
  if (!locationSupportsValuationRule(form)) {
    return null;
  }

  const selectValue = form.valuation_calculation_rule ?? "INHERIT";

  return (
    <div className="mt-3 space-y-2">
      <Label className="text-sm font-medium text-muted-foreground">
        Inventory calculation rule
      </Label>
      <Select
        value={selectValue}
        onValueChange={(value) =>
          onChange(value === "INHERIT" ? null : (value as ValuationMethodOption))
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INHERIT">
            Use organization default ({defaultInventoryValuationMethod})
          </SelectItem>
          {VALUATION_METHOD_OPTIONS.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Applies to weighted-average items at this location. FIFO is blocked until cost layers ship.
        Organization default is currently {defaultInventoryValuationMethod}.
      </p>
    </div>
  );
}
