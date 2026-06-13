import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";

export type PromotionalBatchRow = {
  id: string;
  batch_number: string;
  status: "DRAFT" | "POSTED" | "CANCELLED";
  quantity_total: string;
  notes: string | null;
  posted_at: string | null;
  created_at: string;
  balance_count: number;
};

export function isPromoBalanceEligibleForReclassification(
  balance: Pick<PromoInventoryBalanceRow, "quantity_on_hand" | "promotional_batch_id">
): boolean {
  const qty = Number(balance.quantity_on_hand);
  if (!Number.isFinite(qty) || qty <= 0) return false;
  return balance.promotional_batch_id == null;
}

export function sumSelectedPromoBalanceQty(
  balances: PromoInventoryBalanceRow[],
  selectedIds: Set<string>
): number {
  return balances.reduce((total, balance) => {
    if (!selectedIds.has(balance.id)) return total;
    const qty = Number(balance.quantity_on_hand);
    return total + (Number.isFinite(qty) ? qty : 0);
  }, 0);
}

export function promotionalBatchStatusLabel(status: PromotionalBatchRow["status"]): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "POSTED":
      return "Posted";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status;
  }
}
