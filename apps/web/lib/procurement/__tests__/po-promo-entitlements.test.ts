import { describe, expect, it } from "vitest";
import {
  hasOpenPromoEntitlements,
  isOpenPromoEntitlement,
  promoEntitlementStatusLabel,
  resolvePromoEntitlementRemainingQty,
  type PoPromoEntitlementRow,
} from "@/lib/procurement/promo/entitlements";

function entitlement(
  patch: Partial<PoPromoEntitlementRow> & Pick<PoPromoEntitlementRow, "status">
): PoPromoEntitlementRow {
  return {
    id: "ent-1",
    purchase_order_id: "po-1",
    promo_line_id: "line-promo",
    paid_line_id: "line-paid",
    promo_group_id: "group-1",
    expected_qty: "10",
    received_qty: "0",
    written_off_at: null,
    written_off_reason: null,
    item_name: "Free Widget",
    variant_sku: "FW-1",
    variant_id: "var-1",
    ...patch,
  };
}

describe("promo entitlement helpers", () => {
  it("computes remaining quantity", () => {
    expect(
      resolvePromoEntitlementRemainingQty({ expected_qty: "10", received_qty: "3.5" })
    ).toBe(6.5);
  });

  it("treats OPEN with remaining qty as open", () => {
    expect(isOpenPromoEntitlement(entitlement({ status: "OPEN" }))).toBe(true);
  });

  it("treats PARTIAL with remaining qty as open", () => {
    expect(
      isOpenPromoEntitlement(
        entitlement({ status: "PARTIAL", expected_qty: "10", received_qty: "4" })
      )
    ).toBe(true);
  });

  it("treats CLOSED as not open even with qty mismatch", () => {
    expect(
      isOpenPromoEntitlement(
        entitlement({ status: "CLOSED", expected_qty: "10", received_qty: "2" })
      )
    ).toBe(false);
  });

  it("detects when any entitlement is still open", () => {
    expect(
      hasOpenPromoEntitlements([
        entitlement({ status: "CLOSED", expected_qty: "10", received_qty: "10" }),
        entitlement({ status: "OPEN", id: "ent-2" }),
      ])
    ).toBe(true);
  });

  it("labels entitlement statuses", () => {
    expect(promoEntitlementStatusLabel("WRITTEN_OFF")).toBe("Written off");
  });
});
