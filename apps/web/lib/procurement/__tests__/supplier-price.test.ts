import { describe, expect, it } from "vitest";
import {
  resolvePoLineOfferUnitPrice,
  resolvePoLinePickerOfferUnitPrice,
} from "@/lib/procurement/purchase-orders/supplier-price";

describe("supplier-price resolution", () => {
  it("uses item purchase rate from picker when present", () => {
    expect(resolvePoLinePickerOfferUnitPrice("899")).toBe("899");
    expect(resolvePoLinePickerOfferUnitPrice("")).toBe("0");
  });

  it("prefers supplier catalog price over item purchase rate", () => {
    expect(resolvePoLineOfferUnitPrice("750", "899")).toBe("750");
    expect(resolvePoLineOfferUnitPrice(null, "899")).toBe("899");
    expect(resolvePoLineOfferUnitPrice("", "899")).toBe("899");
  });
});
