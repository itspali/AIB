import { describe, expect, it } from "vitest";
import {
  resolvePoLineOfferUnitPrice,
  resolvePoLinePickerOfferUnitPrice,
} from "@/lib/procurement/purchase-orders/supplier-price";

describe("supplier-price resolution", () => {
  it("uses item purchase rate from picker when present", () => {
    expect(resolvePoLinePickerOfferUnitPrice("899")).toBe("899.00");
    expect(resolvePoLinePickerOfferUnitPrice("899.5")).toBe("899.50");
    expect(resolvePoLinePickerOfferUnitPrice("")).toBe("0");
  });

  it("prefers supplier catalog price over item purchase rate", () => {
    expect(resolvePoLineOfferUnitPrice("750", "899")).toBe("750.00");
    expect(resolvePoLineOfferUnitPrice(null, "899")).toBe("899.00");
    expect(resolvePoLineOfferUnitPrice("", "899")).toBe("899.00");
  });

  it("keeps fixed decimal precision when supplier price replaces picker value", () => {
    expect(resolvePoLineOfferUnitPrice("899", "899.00")).toBe("899.00");
    expect(resolvePoLineOfferUnitPrice("750.5", "899.00")).toBe("750.50");
  });
});
