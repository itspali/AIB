"use client";

import { Info } from "lucide-react";
import { describePromoFulfillmentShipmentStatus } from "@/lib/inventory/stock/promo-sales-shipment-stub";

type Props = {
  visible: boolean;
};

export function PromoFulfillmentShipmentNotice({ visible }: Props) {
  if (!visible) return null;

  return (
    <div className="flex gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <p>{describePromoFulfillmentShipmentStatus()}</p>
    </div>
  );
}
