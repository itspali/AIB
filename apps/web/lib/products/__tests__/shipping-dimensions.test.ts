import { describe, expect, it } from "vitest";
import {
  computeVolumeCm3FromDimensions,
  formatCalculatedVolumeInfo,
  hasPositiveDimension,
  resolveShippingDimensionDefault,
} from "@/lib/products/shipping-dimensions";

describe("shipping-dimensions", () => {
  it("computes cm³ from L×W×H", () => {
    expect(computeVolumeCm3FromDimensions("10", "20", "30")).toBe("6000");
  });

  it("returns empty when a side is missing", () => {
    expect(computeVolumeCm3FromDimensions("10", "", "30")).toBe("");
  });

  it("formats info label", () => {
    expect(formatCalculatedVolumeInfo("2", "3", "4")).toContain("24 cm³");
  });

  it("detects positive stored dimensions", () => {
    expect(hasPositiveDimension("10")).toBe(true);
    expect(hasPositiveDimension("0")).toBe(false);
    expect(hasPositiveDimension("")).toBe(false);
  });

  it("inherits master dimensions when variant value is zero", () => {
    expect(resolveShippingDimensionDefault("0", "12.5")).toBe("12.5");
    expect(resolveShippingDimensionDefault("8", "12.5")).toBe("8");
  });
});
