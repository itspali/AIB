import { describe, expect, it } from "vitest";
import {
  DRAWER_WIDTH_DOCUMENT_VW,
  DRAWER_WIDTH_MUTATE_VW,
  DRAWER_WIDTH_PEEK_VW,
  resolveDrawerWidthVw,
} from "@/lib/layout/drawer-width-policy";
import { isNarrowRightDrawer, RIGHT_DRAWER_PRESET_WIDTHS } from "@/components/ui/right-drawer";

describe("drawer-width-policy", () => {
  it("assigns fixed widths per policy", () => {
    expect(resolveDrawerWidthVw("peek")).toBe(DRAWER_WIDTH_PEEK_VW);
    expect(resolveDrawerWidthVw("mutate")).toBe(DRAWER_WIDTH_MUTATE_VW);
    expect(resolveDrawerWidthVw("document")).toBe(DRAWER_WIDTH_DOCUMENT_VW);
  });

  it("marks peek width as narrow in layout helpers", () => {
    expect(
      isNarrowRightDrawer({ widthVw: DRAWER_WIDTH_PEEK_VW, isPartialDrawer: true })
    ).toBe(true);
    expect(
      isNarrowRightDrawer({ widthVw: DRAWER_WIDTH_MUTATE_VW, isPartialDrawer: true })
    ).toBe(false);
  });

  it("keeps preset array aligned with peek and mutate widths", () => {
    expect(RIGHT_DRAWER_PRESET_WIDTHS[0]).toBe(DRAWER_WIDTH_PEEK_VW);
    expect(RIGHT_DRAWER_PRESET_WIDTHS[1]).toBe(DRAWER_WIDTH_MUTATE_VW);
  });
});
