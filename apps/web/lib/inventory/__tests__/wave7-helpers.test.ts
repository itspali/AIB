import { describe, expect, it } from "vitest";
import {
  attachPromoQuantitiesToBalances,
  buildPromoQtyMap,
  formatQuantity,
  quarantineTypeLabel,
  sumPromoQuantities,
  sumQcQuantities,
  sumSellableQuantities,
} from "@/lib/inventory/stock/promo-pool-helpers";
import {
  describePromoFulfillmentShipmentStatus,
  isPromoFulfillmentShipmentReady,
} from "@/lib/inventory/stock/promo-sales-shipment-stub";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";

function promoRow(partial: Partial<PromoInventoryBalanceRow>): PromoInventoryBalanceRow {
  return {
    id: partial.id ?? "p1",
    location_id: partial.location_id ?? "loc-1",
    location_name: partial.location_name ?? "Main",
    item_id: partial.item_id ?? "item-1",
    item_name: partial.item_name ?? "Widget",
    variant_id: partial.variant_id ?? "var-1",
    variant_sku: partial.variant_sku ?? "W-001",
    quantity_on_hand: partial.quantity_on_hand ?? "5",
    quarantine_type: partial.quarantine_type ?? "PROMOTIONAL_HOLD",
    promotional_batch_id: partial.promotional_batch_id ?? null,
  };
}

function stockRow(partial: Partial<StockBalanceRow>): StockBalanceRow {
  return {
    id: partial.id ?? "s1",
    location_id: partial.location_id ?? "loc-1",
    location_name: partial.location_name ?? "Main",
    location_code: partial.location_code ?? "MAIN",
    item_id: partial.item_id ?? "item-1",
    item_name: partial.item_name ?? "Widget",
    variant_id: partial.variant_id ?? "var-1",
    variant_sku: partial.variant_sku ?? "W-001",
    base_unit_of_measure: partial.base_unit_of_measure ?? "EA",
    total_quantity_on_hand: partial.total_quantity_on_hand ?? "100",
    quantity_reserved: partial.quantity_reserved ?? "0",
    quantity_available: partial.quantity_available ?? partial.total_quantity_on_hand ?? "100",
    current_average_cost: partial.current_average_cost ?? "10",
    reorder_point: partial.reorder_point ?? null,
    below_reorder: partial.below_reorder ?? false,
    promo_quantity_on_hand: partial.promo_quantity_on_hand,
  };
}

describe("promo pool helpers", () => {
  it("aggregates promo quantities by location and variant", () => {
    const map = buildPromoQtyMap([
      promoRow({ quantity_on_hand: "3" }),
      promoRow({ id: "p2", quantity_on_hand: "2" }),
      promoRow({ id: "p3", location_id: "loc-2", quantity_on_hand: "4" }),
    ]);
    expect(map.get("loc-1:var-1")).toBe(5);
    expect(map.get("loc-2:var-1")).toBe(4);
  });

  it("sums sellable and promo totals", () => {
    expect(
      sumSellableQuantities([
        stockRow({ total_quantity_on_hand: "10.5" }),
        stockRow({ id: "s2", total_quantity_on_hand: "2" }),
      ])
    ).toBe(12.5);
    expect(sumPromoQuantities([promoRow({ quantity_on_hand: "1" }), promoRow({ quantity_on_hand: "2" })])).toBe(
      3
    );
    expect(sumQcQuantities([{ quantity_on_hand: "4" }, { quantity_on_hand: "1.5" }])).toBe(5.5);
  });

  it("attaches promo quantities to matching balance rows", () => {
    const enriched = attachPromoQuantitiesToBalances(
      [stockRow({}), stockRow({ id: "s2", variant_id: "var-2" })],
      buildPromoQtyMap([promoRow({ quantity_on_hand: "7" })])
    );
    expect(enriched[0]?.promo_quantity_on_hand).toBe("7");
    expect(enriched[1]?.promo_quantity_on_hand).toBeNull();
  });

  it("formats quantities and quarantine labels", () => {
    expect(formatQuantity(12)).toBe("12");
    expect(formatQuantity(12.5)).toBe("12.5");
    expect(quarantineTypeLabel("FREE_GOODS")).toBe("Free goods");
  });
});

describe("promo fulfillment shipment stub", () => {
  it("reports not ready until sales module wires consumption", () => {
    expect(isPromoFulfillmentShipmentReady()).toBe(false);
    expect(describePromoFulfillmentShipmentStatus()).toMatch(/not wired/i);
  });
});
