import { describe, expect, it } from "vitest";
import {
  RIGHT_DRAWER_GLASS_BODY_CLASS,
  RIGHT_DRAWER_GLASS_SURFACE_CLASS,
  resolveRightDrawerSurfaceVariant,
  rightDrawerGlassBodyClassName,
  rightDrawerGlassSurfaceClassName,
} from "@/lib/layout/right-drawer-surface";

describe("right drawer surface", () => {
  it("enables glass only for mutate-width drawers", () => {
    expect(resolveRightDrawerSurfaceVariant("mutate", "glass")).toBe("glass");
    expect(resolveRightDrawerSurfaceVariant("peek", "glass")).toBe("default");
    expect(resolveRightDrawerSurfaceVariant("mutate", "default")).toBe("default");
  });

  it("exposes glass shell class helpers", () => {
    expect(rightDrawerGlassSurfaceClassName(true)).toBe(RIGHT_DRAWER_GLASS_SURFACE_CLASS);
    expect(rightDrawerGlassSurfaceClassName(false)).toBeUndefined();
    expect(rightDrawerGlassBodyClassName(true)).toContain(RIGHT_DRAWER_GLASS_BODY_CLASS);
  });
});
