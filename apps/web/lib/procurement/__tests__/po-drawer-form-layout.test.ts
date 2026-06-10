import { describe, expect, it } from "vitest";
import {
  RIGHT_DRAWER_FULL_WIDTH_VW,
  RIGHT_DRAWER_PRESET_WIDTHS,
} from "@/components/ui/right-drawer";
import { isPoDrawerBelowWidePreset } from "@/lib/procurement/purchase-orders/use-po-drawer-form-layout";

/** Mirrors use-po-drawer-form-layout.ts side-by-side predicate for unit tests. */
function shouldUseWidePartialDrawer(input: {
  isPartialDrawer: boolean;
  isFullWidthDrawer: boolean;
  stackVertically: boolean;
  isLargeViewport: boolean;
  drawerWidthVw: number;
}): boolean {
  return (
    input.isPartialDrawer &&
    !input.isFullWidthDrawer &&
    !input.stackVertically &&
    input.isLargeViewport &&
    input.drawerWidthVw >= RIGHT_DRAWER_PRESET_WIDTHS[1] - 0.5
  );
}

/** Mirrors use-po-drawer-form-layout.ts full-page predicate for unit tests. */
function shouldUseFullPageLayout(input: {
  isPartialDrawer: boolean;
  isFullWidthDrawer: boolean;
}): boolean {
  return !input.isPartialDrawer || input.isFullWidthDrawer;
}

/** Mirrors use-po-drawer-form-layout.ts fill-height gate for unit tests. */
function shouldFillLineTableHeight(input: {
  isMutating: boolean;
  useWidePartialDrawer: boolean;
  useFullPageLayout: boolean;
  isLargeViewport: boolean;
  isMediumViewport: boolean;
}): boolean {
  return (
    input.isMutating &&
    (input.useWidePartialDrawer ||
      (input.useFullPageLayout && input.isLargeViewport)) &&
    input.isMediumViewport
  );
}

describe("PO drawer layout mode", () => {
  it("stacks summary below lines on narrow partial drawer", () => {
    expect(
      shouldUseWidePartialDrawer({
        isPartialDrawer: true,
        isFullWidthDrawer: false,
        stackVertically: true,
        isLargeViewport: true,
        drawerWidthVw: 40,
      })
    ).toBe(false);
  });

  it("stacks on partial drawer below lg even at 60vw", () => {
    expect(
      shouldUseWidePartialDrawer({
        isPartialDrawer: true,
        isFullWidthDrawer: false,
        stackVertically: false,
        isLargeViewport: false,
        drawerWidthVw: 60,
      })
    ).toBe(false);
  });

  it("uses side-by-side rail on lg+ partial drawer at 60vw or wider", () => {
    expect(
      shouldUseWidePartialDrawer({
        isPartialDrawer: true,
        isFullWidthDrawer: false,
        stackVertically: false,
        isLargeViewport: true,
        drawerWidthVw: 60,
      })
    ).toBe(true);
  });

  it("does not fix line table height on 40vw peek even on md+", () => {
    expect(
      shouldFillLineTableHeight({
        isMutating: true,
        useWidePartialDrawer: false,
        useFullPageLayout: false,
        isLargeViewport: true,
        isMediumViewport: true,
      })
    ).toBe(false);
  });

  it("fixes line table height on lg+ partial drawer at 60vw or wider", () => {
    expect(
      shouldFillLineTableHeight({
        isMutating: true,
        useWidePartialDrawer: true,
        useFullPageLayout: false,
        isLargeViewport: true,
        isMediumViewport: true,
      })
    ).toBe(true);
  });

  it("does not fix line table height on 60vw partial drawer below lg", () => {
    expect(
      shouldFillLineTableHeight({
        isMutating: true,
        useWidePartialDrawer: false,
        useFullPageLayout: false,
        isLargeViewport: false,
        isMediumViewport: true,
      })
    ).toBe(false);
  });

  it("uses full-page layout at the 100% drawer preset on md+ partial drawer", () => {
    expect(
      shouldUseFullPageLayout({
        isPartialDrawer: true,
        isFullWidthDrawer: true,
      })
    ).toBe(true);
    expect(
      shouldUseWidePartialDrawer({
        isPartialDrawer: true,
        isFullWidthDrawer: true,
        stackVertically: false,
        isLargeViewport: true,
        drawerWidthVw: RIGHT_DRAWER_FULL_WIDTH_VW,
      })
    ).toBe(false);
    expect(RIGHT_DRAWER_PRESET_WIDTHS).toContain(RIGHT_DRAWER_FULL_WIDTH_VW);
  });

  it("enables drawer body scroll only below 60vw partial drawer while editing", () => {
    expect(isPoDrawerBelowWidePreset(true, 40)).toBe(true);
    expect(isPoDrawerBelowWidePreset(true, 59)).toBe(true);
    expect(isPoDrawerBelowWidePreset(true, 60)).toBe(false);
    expect(isPoDrawerBelowWidePreset(true, 80)).toBe(false);
    expect(isPoDrawerBelowWidePreset(false, 40)).toBe(false);
  });
});
