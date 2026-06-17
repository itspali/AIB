"use client";

import { PromoFulfillmentShipmentNotice } from "@/components/inventory/stock/promo-fulfillment-shipment-notice";
import { PromoReclassificationPanel } from "@/components/inventory/stock/promo-reclassification-panel";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import {
  isPromoBalanceEligibleForReclassification,
  type PromotionalBatchRow,
} from "@/lib/procurement/promo/reclassification-helpers";

type Props = {
  promoBalances: PromoInventoryBalanceRow[];
  draftBatches: PromotionalBatchRow[];
  onChanged: () => void;
};

export function StockPromoReclassificationView({
  promoBalances,
  draftBatches,
  onChanged,
}: Props) {
  const eligibleCount = promoBalances.filter(isPromoBalanceEligibleForReclassification).length;
  const hasContent = eligibleCount > 0 || draftBatches.length > 0;

  if (!hasContent) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="max-w-md rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No promotional balances are eligible for reclassification, and there are no draft
          batches.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 md:p-4">
      <PromoFulfillmentShipmentNotice visible={promoBalances.length > 0} />
      <PromoReclassificationPanel
        className="mb-0"
        balances={promoBalances}
        draftBatches={draftBatches}
        onChanged={onChanged}
      />
    </div>
  );
}
