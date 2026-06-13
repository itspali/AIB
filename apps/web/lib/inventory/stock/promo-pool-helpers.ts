import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";

export type PromoQtyKey = `${string}:${string}`;

export function promoQtyKey(locationId: string, variantId: string): PromoQtyKey {
  return `${locationId}:${variantId}`;
}

export function buildPromoQtyMap(
  balances: PromoInventoryBalanceRow[]
): Map<PromoQtyKey, number> {
  const map = new Map<PromoQtyKey, number>();
  for (const row of balances) {
    const key = promoQtyKey(row.location_id, row.variant_id);
    const qty = Number.parseFloat(row.quantity_on_hand);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    map.set(key, (map.get(key) ?? 0) + qty);
  }
  return map;
}

export function sumNumericStrings(values: string[]): number {
  return values.reduce((total, value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
}

export function sumPromoQuantities(balances: PromoInventoryBalanceRow[]): number {
  return sumNumericStrings(balances.map((row) => row.quantity_on_hand));
}

export function sumSellableQuantities(rows: StockBalanceRow[]): number {
  return sumNumericStrings(rows.map((row) => row.total_quantity_on_hand));
}

export function attachPromoQuantitiesToBalances(
  rows: StockBalanceRow[],
  promoMap: Map<PromoQtyKey, number>
): StockBalanceRow[] {
  return rows.map((row) => {
    const promoQty = promoMap.get(promoQtyKey(row.location_id, row.variant_id)) ?? 0;
    return {
      ...row,
      promo_quantity_on_hand: promoQty > 0 ? formatQuantity(promoQty) : null,
    };
  });
}

export function formatQuantity(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(4).replace(/\.?0+$/, "");
}

export function quarantineTypeLabel(type: string): string {
  switch (type) {
    case "FREE_GOODS":
      return "Free goods";
    case "SAMPLE":
      return "Sample";
    case "PROMOTIONAL_HOLD":
      return "Promotional hold";
    default:
      return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
