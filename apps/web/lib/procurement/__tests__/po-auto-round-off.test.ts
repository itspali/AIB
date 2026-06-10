import { describe, expect, it } from "vitest";
import {
  computePoAutoRoundOff,
  resolvePoAutoRoundOffPolicy,
  resolvePoAutoRoundOffStep,
} from "@/lib/procurement/purchase-orders/po-auto-round-off";

describe("po auto round-off", () => {
  it("rounds to nearest whole unit", () => {
    const result = computePoAutoRoundOff(1234.56, 1);
    expect(result.grandTotal).toBe(1235);
    expect(result.roundOffAmount).toBeCloseTo(0.44, 10);
  });

  it("rounds to nearest 0.05", () => {
    const result = computePoAutoRoundOff(10.02, 0.05);
    expect(result.grandTotal).toBe(10);
    expect(result.roundOffAmount).toBeCloseTo(-0.02, 10);
  });

  it("rounds to nearest 0.01", () => {
    const result = computePoAutoRoundOff(10.004, 0.01);
    expect(result.grandTotal).toBe(10);
    expect(result.roundOffAmount).toBeCloseTo(-0.004, 10);
  });

  it("falls back invalid step to 1", () => {
    expect(resolvePoAutoRoundOffStep(99)).toBe(1);
    expect(resolvePoAutoRoundOffStep("0.05")).toBe(0.05);
  });

  it("resolves policy from settings metadata", () => {
    expect(
      resolvePoAutoRoundOffPolicy({
        po_auto_round_off_enabled: true,
        po_auto_round_off_step: 0.1,
      })
    ).toEqual({ enabled: true, step: 0.1 });
  });
});
