import { describe, expect, it } from "vitest";
import {
  computeVolumeCm3FromDimensions,
  formatCalculatedVolumeInfo,
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
});
