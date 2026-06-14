import { describe, expect, it } from "vitest";
import { poPeekShowsPromoEntitlements } from "@/lib/procurement/purchase-orders/po-peek-promo";

describe("poPeekShowsPromoEntitlements", () => {
  it("shows promo section for issued and in-flight statuses", () => {
    expect(poPeekShowsPromoEntitlements("ISSUED")).toBe(true);
    expect(poPeekShowsPromoEntitlements("PARTIALLY_RECEIVED")).toBe(true);
  });

  it("hides promo section for draft and cancelled orders", () => {
    expect(poPeekShowsPromoEntitlements("DRAFT")).toBe(false);
    expect(poPeekShowsPromoEntitlements("CANCELLED")).toBe(false);
    expect(poPeekShowsPromoEntitlements(undefined)).toBe(false);
  });
});
