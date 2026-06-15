import { describe, expect, it } from "vitest";
import {
  rescaleUnitPriceBetweenUoms,
  scaleCatalogBaseUnitPriceToLineUom,
} from "@/lib/documents/line-uom-unit-price";

const options = [
  { uom_code: "PCS", conversion_factor: 1 },
  { uom_code: "BOX", conversion_factor: 2 },
  { uom_code: "CASE", conversion_factor: 24 },
];

describe("line-uom-unit-price", () => {
  it("scales base catalog price to alternate UOM", () => {
    expect(scaleCatalogBaseUnitPriceToLineUom("10", "BOX", options)).toBe("20.00");
    expect(scaleCatalogBaseUnitPriceToLineUom("10", "PCS", options)).toBe("10");
  });

  it("rescales unit price when switching between UOMs", () => {
    expect(rescaleUnitPriceBetweenUoms("10", "PCS", "BOX", options)).toBe("20.00");
    expect(rescaleUnitPriceBetweenUoms("20", "BOX", "PCS", options)).toBe("10.00");
    expect(rescaleUnitPriceBetweenUoms("20", "BOX", "CASE", options)).toBe("240.00");
  });

  it("leaves price unchanged when UOM factors match", () => {
    expect(rescaleUnitPriceBetweenUoms("15.50", "PCS", "PCS", options)).toBe("15.50");
  });
});
