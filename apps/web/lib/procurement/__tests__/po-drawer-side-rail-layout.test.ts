import { describe, expect, it } from "vitest";
import { RIGHT_DRAWER_PRESET_WIDTHS } from "@/components/ui/right-drawer";
import {
  canShowPoSideRailAtViewport,
  isPoDrawerBelowWidePreset,
  poSideRailBreakpointClass,
  resolvePoSideRailBreakpoint,
  resolvePoSideRailWidthClass,
} from "@/lib/procurement/purchase-orders/po-drawer-side-rail-layout";

describe("PO drawer side rail layout", () => {
  it("treats partial drawers below 60vw as narrow", () => {
    expect(isPoDrawerBelowWidePreset(true, 40)).toBe(true);
    expect(isPoDrawerBelowWidePreset(true, 59)).toBe(true);
    expect(isPoDrawerBelowWidePreset(true, 60)).toBe(false);
    expect(isPoDrawerBelowWidePreset(false, 40)).toBe(false);
  });

  describe("canShowPoSideRailAtViewport", () => {
    it("requires md+ viewport", () => {
      expect(canShowPoSideRailAtViewport(100, true, false, false)).toBe(false);
    });

    it("shows side rail for full-page drawer at md+", () => {
      expect(canShowPoSideRailAtViewport(100, false, true, false)).toBe(true);
      expect(canShowPoSideRailAtViewport(100, true, true, false)).toBe(true);
    });

    it("shows side rail for 80vw at md+", () => {
      expect(canShowPoSideRailAtViewport(80, true, true, false)).toBe(true);
    });

    it("requires lg+ viewport for 60vw partial drawer", () => {
      expect(canShowPoSideRailAtViewport(60, true, true, false)).toBe(false);
      expect(canShowPoSideRailAtViewport(60, true, true, true)).toBe(true);
    });

    it("hides side rail for 40vw at all viewports", () => {
      expect(canShowPoSideRailAtViewport(40, true, true, true)).toBe(false);
    });
  });

  describe("resolvePoSideRailBreakpoint", () => {
    it("uses md for full-page and 80vw+", () => {
      expect(resolvePoSideRailBreakpoint(100, true)).toBe("md");
      expect(resolvePoSideRailBreakpoint(80, false)).toBe("md");
    });

    it("uses lg for 60vw partial drawer", () => {
      expect(resolvePoSideRailBreakpoint(60, false)).toBe("lg");
    });
  });

  describe("resolvePoSideRailWidthClass", () => {
    it("widens the rail as the drawer grows", () => {
      expect(resolvePoSideRailWidthClass(true, 100)).toContain("22rem");
      expect(resolvePoSideRailWidthClass(false, 80)).toContain("18rem");
      expect(resolvePoSideRailWidthClass(false, 60)).toContain("15rem");
    });
  });

  describe("poSideRailBreakpointClass", () => {
    it("maps 60vw to lg responsive classes", () => {
      expect(poSideRailBreakpointClass(60, false, "desktopShow")).toBe("hidden lg:flex");
      expect(poSideRailBreakpointClass(60, false, "mobileHide")).toBe("lg:hidden");
    });

    it("maps 80vw and full-page to md responsive classes", () => {
      expect(poSideRailBreakpointClass(80, false, "desktopShow")).toBe("hidden md:flex");
      expect(poSideRailBreakpointClass(100, true, "flexRow")).toBe("md:flex-row md:items-stretch");
    });
  });

  it("covers all preset drawer widths", () => {
    for (const width of RIGHT_DRAWER_PRESET_WIDTHS) {
      expect(typeof resolvePoSideRailWidthClass(width >= 100, width)).toBe("string");
    }
  });
});
