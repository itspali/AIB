import type { ValuationMethodOption } from "@/lib/organization/naming-options";
import type { LocationRow } from "@/lib/locations/types";

export type LocationValuationCalculationRule = ValuationMethodOption;

export function locationSupportsValuationRule(
  location: Pick<LocationRow, "is_stock_holding" | "is_commercial_storefront">
): boolean {
  return location.is_stock_holding || location.is_commercial_storefront;
}

export function formatLocationValuationRuleLabel(
  rule: LocationValuationCalculationRule | null,
  defaultMethod: LocationValuationCalculationRule
): string {
  if (rule) return rule;
  return `Inherits organization default (${defaultMethod})`;
}
