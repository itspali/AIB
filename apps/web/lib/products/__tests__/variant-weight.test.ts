import { describe, expect, it } from "vitest";
import { resolveDeadWeightKg } from "@/lib/products/variant-weight";

describe("resolveDeadWeightKg", () => {
  it("prefers dead_weight_kg when set", () => {
    expect(resolveDeadWeightKg("2.5", "10")).toBe("2.5");
  });

  it("falls back to legacy weight when dead weight is zero", () => {
    expect(resolveDeadWeightKg("0", "3.25")).toBe("3.25");
  });

  it("returns zero when both are empty", () => {
    expect(resolveDeadWeightKg("0", "")).toBe("0");
  });
});
