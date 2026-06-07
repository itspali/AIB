export type OpeningStockDraftCell = {
  variant_id: string;
  location_id: string;
  quantity: string;
  unit_cost: string;
};

export type OpeningStockOnHandCell = {
  variant_id: string;
  location_id: string;
  quantity_on_hand: string;
  average_cost: string;
};

export type OpeningStockAdjustmentLine = {
  variant_id: string;
  quantity_delta: number;
  unit_cost: number;
};

export function openingStockCellKey(variantId: string, locationId: string): string {
  return `${variantId}:${locationId}`;
}

export function parseOpeningQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function parseOpeningUnitCost(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function isOpeningStockCellLocked(onHand: string | null | undefined): boolean {
  const parsed = Number(onHand ?? "0");
  return Number.isFinite(parsed) && parsed > 0;
}

/** Inventory ledger rejects non-sellable style anchors (MULTI_SKU master). */
export function isOpeningStockEligibleVariant(variant: {
  is_active: boolean;
  is_sellable: boolean;
}): boolean {
  return variant.is_active && variant.is_sellable !== false;
}

function positiveCostCandidate(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return trimmed;
}

/** Default unit cost for opening stock: variant/item purchase rate, then standard cost, then on-hand average. */
export function resolveOpeningUnitCost(input: {
  variantPurchasePrice?: string | null;
  itemPurchasePrice?: string | null;
  standardCost?: string | null;
  averageCost?: string | null;
}): string {
  return (
    positiveCostCandidate(input.variantPurchasePrice) ??
    positiveCostCandidate(input.itemPurchasePrice) ??
    positiveCostCandidate(input.standardCost) ??
    positiveCostCandidate(input.averageCost) ??
    ""
  );
}

/** Group positive opening lines by location (one adjustment document per location). */
export function buildOpeningAdjustmentsByLocation(
  entries: OpeningStockDraftCell[]
): Map<string, OpeningStockAdjustmentLine[]> {
  const grouped = new Map<string, OpeningStockAdjustmentLine[]>();

  for (const entry of entries) {
    const quantity = parseOpeningQuantity(entry.quantity);
    if (quantity == null) continue;

    const unitCost = parseOpeningUnitCost(entry.unit_cost);
    if (unitCost == null || unitCost <= 0) {
      continue;
    }

    const locationId = entry.location_id.trim();
    const variantId = entry.variant_id.trim();
    if (!locationId || !variantId) continue;

    const lines = grouped.get(locationId) ?? [];
    lines.push({
      variant_id: variantId,
      quantity_delta: quantity,
      unit_cost: unitCost,
    });
    grouped.set(locationId, lines);
  }

  return grouped;
}

export function hasPendingOpeningStockEntries(entries: OpeningStockDraftCell[]): boolean {
  return buildOpeningAdjustmentsByLocation(entries).size > 0;
}
