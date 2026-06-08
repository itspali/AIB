export const STOCK_STYLE_ANCHOR_BLOCKED_REASON =
  "Style anchor SKUs cannot hold inventory. Choose a sellable variant SKU.";

export type StockVariantEligibilityInput = {
  is_sellable?: boolean | null;
  track_inventory?: boolean | null;
  tracking_mode?: string | null;
};

/** Whether a variant may appear in stock adjustment / transfer line pickers and post to the ledger. */
export function resolveStockVariantBlockedReason(
  input: StockVariantEligibilityInput
): string | null {
  if (input.is_sellable === false) {
    return STOCK_STYLE_ANCHOR_BLOCKED_REASON;
  }
  if (!input.track_inventory) {
    return "Item does not track inventory.";
  }
  if (input.tracking_mode === "SERIAL") {
    return "Serial tracking is not supported in stock adjustments yet.";
  }
  if (input.tracking_mode === "LOT") {
    return "Lot tracking is not supported in stock adjustments yet.";
  }
  if (input.tracking_mode !== "NONE") {
    return "This tracking mode is not supported in stock adjustments yet.";
  }
  return null;
}

export function isStockVariantAdjustable(input: StockVariantEligibilityInput): boolean {
  return resolveStockVariantBlockedReason(input) == null;
}
