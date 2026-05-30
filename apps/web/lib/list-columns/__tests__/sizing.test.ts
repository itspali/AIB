import { describe, expect, it } from "vitest";
import { getColumnDef } from "@/lib/products/list-columns";
import {
  clampUserColumnWidth,
  getColumnResizeBounds,
  resolveColumnWidthSpec,
  resolveColumnWidthStyles,
  USER_COLUMN_RESIZE_MIN_PX,
} from "@/lib/list-columns/sizing";

describe("resolveColumnWidthSpec", () => {
  it("applies device-specific width overrides for name", () => {
    const column = getColumnDef("name");

    expect(resolveColumnWidthSpec(column, "mobile", "truncate").min).toBe(120);
    expect(resolveColumnWidthSpec(column, "desktop", "truncate").min).toBe(180);
    expect(resolveColumnWidthSpec(column, "desktop", "truncate").max).toBe(320);
  });

  it("uses user width override and bypasses registry min", () => {
    const column = getColumnDef("name");

    expect(resolveColumnWidthSpec(column, "desktop", "truncate", 96)).toEqual({
      min: 96,
      max: 96,
      preferred: 96,
    });
    expect(resolveColumnWidthStyles(column, "desktop", "truncate", 96)).toEqual({
      width: "96px",
      minWidth: "96px",
      maxWidth: "96px",
    });
  });

  it("clamps user width to resize bounds", () => {
    const column = getColumnDef("name");
    const bounds = getColumnResizeBounds(column, "desktop");

    expect(bounds.min).toBe(USER_COLUMN_RESIZE_MIN_PX);
    expect(bounds.max).toBe(320);
    expect(clampUserColumnWidth(column, "desktop", 20)).toBe(USER_COLUMN_RESIZE_MIN_PX);
    expect(clampUserColumnWidth(column, "desktop", 999)).toBe(320);
  });

  it("boosts min width when wrap mode is wrap", () => {
    const column = getColumnDef("name");

    const truncateMin = resolveColumnWidthSpec(column, "desktop", "truncate").min as number;
    const wrapMin = resolveColumnWidthSpec(column, "desktop", "wrap").min as number;

    expect(wrapMin).toBe(truncateMin + 48 + 32);
  });

  it("respects column wrapWidthBoost override for multiline wrap", () => {
    const column = getColumnDef("description");
    const clampMin = resolveColumnWidthSpec(column, "tablet", "line-clamp-2").min as number;
    const wrapped = resolveColumnWidthSpec(column, "tablet", "wrap").min as number;

    expect(clampMin).toBe(140 + 24 + 40);
    expect(wrapped).toBe(140 + 48 + 40);
  });

  it("falls back to valueKind defaults when widths are absent", () => {
    const column = {
      id: "custom_text",
      label: "Custom",
      defaultVisible: true,
      valueKind: "text" as const,
    };

    expect(resolveColumnWidthSpec(column, "desktop", "truncate")).toEqual({
      min: 120,
      max: 240,
    });
  });

  it("returns css pixel strings from resolveColumnWidthStyles", () => {
    const column = getColumnDef("default_sku");
    const styles = resolveColumnWidthStyles(column, "desktop", "truncate");

    expect(styles.minWidth).toBe("96px");
    expect(styles.maxWidth).toBe("168px");
  });
});
