import type { LocationRow } from "@/lib/locations/types";

export function locationSupportsInventoryOps(
  location: Pick<LocationRow, "is_stock_holding" | "presence_type">
): boolean {
  if (!location.is_stock_holding) return false;
  if (location.presence_type === "VIRTUAL") return false;
  return true;
}
