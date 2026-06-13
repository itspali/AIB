import type { LocationRow } from "@/lib/locations/types";

export { locationSupportsValuationRule } from "@/lib/locations/valuation-rule";

export function locationSupportsInventoryOps(
  location: Pick<
    LocationRow,
    "is_stock_holding" | "presence_type" | "is_git_holding" | "is_subcontract_wip"
  >
): boolean {
  if (!location.is_stock_holding) return false;
  if (location.presence_type === "VIRTUAL") {
    return location.is_git_holding || location.is_subcontract_wip;
  }
  return true;
}
