import { describe, expect, it } from "vitest";
import {
  extractMrpFromCustomFields,
  normalizeMatrixPriceDefault,
  resolveMatrixCostDefault,
} from "@/lib/products/variant-matrix-defaults";

describe("variant-matrix-defaults", () => {
  it("normalizes empty and zero prices", () => {
    expect(normalizeMatrixPriceDefault("")).toBe("");
    expect(normalizeMatrixPriceDefault("0")).toBe("");
    expect(normalizeMatrixPriceDefault(" 12.5 ")).toBe("12.5");
  });

  it("prefers purchase over standard cost", () => {
    expect(resolveMatrixCostDefault("10", "20")).toBe("10");
    expect(resolveMatrixCostDefault("", "20")).toBe("20");
  });

  it("reads MRP from custom field keys", () => {
    expect(
      extractMrpFromCustomFields([
        { key: "color", value: "red" },
        { key: "MRP", value: "199" },
      ])
    ).toBe("199");
  });
});
