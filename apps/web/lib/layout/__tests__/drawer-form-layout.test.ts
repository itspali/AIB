import { describe, expect, it } from "vitest";
import {
  DRAWER_FORM_GRID_GAP_PX,
  DRAWER_FORM_MIN_COLUMN_PX,
  drawerFormFieldSpanClass,
  resolveDrawerFormColumnCount,
} from "@/lib/layout/drawer-form-layout";

function widthForColumns(columns: number): number {
  return columns * DRAWER_FORM_MIN_COLUMN_PX + (columns - 1) * DRAWER_FORM_GRID_GAP_PX;
}

describe("resolveDrawerFormColumnCount", () => {
  it("defaults to one column when width is unknown", () => {
    expect(resolveDrawerFormColumnCount(undefined)).toBe(1);
    expect(resolveDrawerFormColumnCount(0)).toBe(1);
  });

  it("adds columns as content width grows", () => {
    expect(resolveDrawerFormColumnCount(widthForColumns(1) - 1)).toBe(1);
    expect(resolveDrawerFormColumnCount(widthForColumns(2))).toBe(2);
    expect(resolveDrawerFormColumnCount(widthForColumns(3))).toBe(3);
    expect(resolveDrawerFormColumnCount(widthForColumns(4))).toBe(4);
  });

  it("caps at four columns for very wide drawers", () => {
    expect(resolveDrawerFormColumnCount(widthForColumns(6))).toBe(4);
  });
});

describe("drawerFormFieldSpanClass", () => {
  it("spans the full grid when requested", () => {
    expect(drawerFormFieldSpanClass(3, "full")).toBe("col-span-full");
    expect(drawerFormFieldSpanClass(2, 2)).toBe("col-span-full");
  });

  it("keeps double-width cells inside wider grids", () => {
    expect(drawerFormFieldSpanClass(3, 2)).toBe("col-span-2");
    expect(drawerFormFieldSpanClass(4, 2)).toBe("col-span-2");
  });

  it("falls back to a single column when the grid is narrow", () => {
    expect(drawerFormFieldSpanClass(1, 2)).toBe("col-span-full");
    expect(drawerFormFieldSpanClass(2, 1)).toBe("");
  });
});
