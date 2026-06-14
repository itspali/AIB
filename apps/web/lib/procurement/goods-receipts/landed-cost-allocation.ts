export type LandedCostAllocationMethod = "BY_QUANTITY" | "BY_VALUE" | "BY_WEIGHT";

export type LandedAllocationLineInput = {
  quantity_received: number;
  quantity_accepted: number;
  unit_cost: number;
  weight_kg?: number;
};

export type LandedChargeInput = {
  amount: number;
  allocation_method?: LandedCostAllocationMethod | null;
};

/**
 * Per-unit extra landed cost allocated to a line (freight/insurance only, not import duty).
 * Mirrors post_goods_receipt when absorb_sunk_logistics_overhead is off: allocate across accepted qty only.
 */
export function allocateExtraLandedPerUnit(
  line: LandedAllocationLineInput,
  allLines: readonly LandedAllocationLineInput[],
  totalChargeAmount: number,
  defaultMethod: LandedCostAllocationMethod,
  absorbSunkOverhead: boolean
): number {
  if (totalChargeAmount <= 0 || line.quantity_accepted <= 0) return 0;

  const allocQty = (row: LandedAllocationLineInput) =>
    absorbSunkOverhead ? row.quantity_received : row.quantity_accepted;

  const totalQty = allLines.reduce((sum, row) => sum + Math.max(allocQty(row), 0), 0);
  const totalValue = allLines.reduce(
    (sum, row) => sum + Math.max(allocQty(row), 0) * Math.max(row.unit_cost, 0),
    0
  );
  const totalWeight = allLines.reduce(
    (sum, row) => sum + Math.max(allocQty(row), 0) * Math.max(row.weight_kg ?? 0, 0),
    0
  );

  const lineQty = Math.max(allocQty(line), 0);
  const lineValue = lineQty * Math.max(line.unit_cost, 0);
  const lineWeight = lineQty * Math.max(line.weight_kg ?? 0, 0);

  if (lineQty <= 0) return 0;

  let share = 0;
  if (defaultMethod === "BY_QUANTITY" && totalQty > 0) {
    share = (totalChargeAmount * lineQty) / totalQty;
  } else if (defaultMethod === "BY_VALUE" && totalValue > 0 && line.unit_cost > 0) {
    share = (totalChargeAmount * lineValue) / totalValue;
  } else if (defaultMethod === "BY_WEIGHT" && totalWeight > 0) {
    share = (totalChargeAmount * lineWeight) / totalWeight;
  }

  return share / lineQty;
}

export function computeFinalLandedUnitCost(
  rawUnitCost: number,
  importIgstPerUnit: number,
  customsDutyPerUnit: number,
  extraLandedPerUnit: number
): number {
  return (
    Math.max(rawUnitCost, 0) +
    Math.max(importIgstPerUnit, 0) +
    Math.max(customsDutyPerUnit, 0) +
    Math.max(extraLandedPerUnit, 0)
  );
}
