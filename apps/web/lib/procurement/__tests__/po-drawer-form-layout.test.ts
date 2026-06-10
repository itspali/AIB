import { describe, expect, it } from "vitest";
import {
  RIGHT_DRAWER_FULL_WIDTH_VW,
  RIGHT_DRAWER_PRESET_WIDTHS,
} from "@/components/ui/right-drawer";
import { isPoDrawerBelowWidePreset } from "@/lib/procurement/purchase-orders/po-drawer-side-rail-layout";

describe("PO drawer form layout helpers", () => {
  it("enables drawer body scroll only below 60vw partial drawer while editing", () => {
    expect(isPoDrawerBelowWidePreset(true, 40)).toBe(true);
    expect(isPoDrawerBelowWidePreset(true, 59)).toBe(true);
    expect(isPoDrawerBelowWidePreset(true, 60)).toBe(false);
    expect(isPoDrawerBelowWidePreset(true, 80)).toBe(false);
    expect(isPoDrawerBelowWidePreset(false, 40)).toBe(false);
  });

  it("includes the 100% preset in drawer width cycle", () => {
    expect(RIGHT_DRAWER_PRESET_WIDTHS).toContain(RIGHT_DRAWER_FULL_WIDTH_VW);
  });
});
