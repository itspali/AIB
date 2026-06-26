import { describe, expect, it } from "vitest";
import {
  DRAWER_WIDTH_MUTATE_VW,
  DRAWER_WIDTH_PEEK_VW,
  resolveDrawerWidthVw,
} from "@/lib/layout/drawer-width-policy";

describe("mutation-form phase A", () => {
  it("uses distinct fixed widths for peek and mutate surfaces", () => {
    expect(resolveDrawerWidthVw("peek")).toBe(DRAWER_WIDTH_PEEK_VW);
    expect(resolveDrawerWidthVw("mutate")).toBe(DRAWER_WIDTH_MUTATE_VW);
    expect(DRAWER_WIDTH_PEEK_VW).toBeLessThan(DRAWER_WIDTH_MUTATE_VW);
  });
});
