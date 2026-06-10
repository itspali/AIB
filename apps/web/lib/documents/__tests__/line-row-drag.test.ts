import { describe, expect, it } from "vitest";
import {
  computeLineRowVisualShiftPx,
  resolveLineRowDropPosition,
  resolveLineRowDropPositionFromLayout,
  resolveLineRowDropTargetFromLayout,
  resolvePreviewInsertIndex,
} from "@/lib/documents/line-row-drag";

function mockTbody(rows: Array<{ key: string; top: number; height: number }>) {
  const tbody = {
    scrollTop: 0,
    getBoundingClientRect: () => ({ top: 100 }),
    querySelectorAll: () =>
      rows.map((row) => ({
        getAttribute: () => row.key,
        offsetTop: row.top,
        offsetHeight: row.height,
      })),
  } as unknown as HTMLTableSectionElement;

  return tbody;
}

describe("resolveLineRowDropPositionFromLayout", () => {
  it("returns before when the pointer is in the top half of the row", () => {
    const tbody = mockTbody([{ key: "a", top: 0, height: 40 }]);
    const row = {
      offsetTop: 0,
      offsetHeight: 40,
      closest: () => tbody,
    } as unknown as HTMLTableRowElement;

    expect(resolveLineRowDropPositionFromLayout(row, 110)).toBe("before");
  });

  it("returns after when the pointer is in the bottom half of the row", () => {
    const tbody = mockTbody([{ key: "a", top: 0, height: 40 }]);
    const row = {
      offsetTop: 0,
      offsetHeight: 40,
      closest: () => tbody,
    } as unknown as HTMLTableRowElement;

    expect(resolveLineRowDropPositionFromLayout(row, 125)).toBe("after");
  });
});

describe("resolveLineRowDropPosition", () => {
  it("delegates to layout-based positioning", () => {
    const tbody = mockTbody([{ key: "a", top: 0, height: 40 }]);
    const row = {
      offsetTop: 0,
      offsetHeight: 40,
      closest: () => tbody,
    } as unknown as HTMLTableRowElement;

    const event = {
      clientY: 125,
      currentTarget: row,
    } as React.DragEvent<HTMLTableRowElement>;

    expect(resolveLineRowDropPosition(event)).toBe("after");
  });
});

describe("resolveLineRowDropTargetFromLayout", () => {
  it("resolves the hovered row from layout geometry", () => {
    const tbody = mockTbody([
      { key: "a", top: 0, height: 40 },
      { key: "b", top: 40, height: 40 },
      { key: "c", top: 80, height: 40 },
    ]);

    expect(resolveLineRowDropTargetFromLayout(tbody, 165, "a")).toEqual({
      targetKey: "b",
      position: "after",
    });
  });
});

describe("resolvePreviewInsertIndex", () => {
  const keys = ["a", "b", "c", "d"];

  it("inserts before the target row", () => {
    expect(resolvePreviewInsertIndex(keys, "c", "a", "before")).toBe(0);
  });

  it("inserts after the target row", () => {
    expect(resolvePreviewInsertIndex(keys, "a", "c", "after")).toBe(2);
  });
});

describe("computeLineRowVisualShiftPx", () => {
  const keys = ["a", "b", "c", "d"];
  const heights = { a: 48, b: 48, c: 48, d: 48 };

  it("shifts rows between source and target when dragging down", () => {
    expect(
      computeLineRowVisualShiftPx(2, "c", keys, {
        draggingKey: "a",
        dropTargetKey: "c",
        dropPosition: "after",
        rowHeights: heights,
      })
    ).toBe(-48);
  });

  it("shifts rows when dragging up", () => {
    expect(
      computeLineRowVisualShiftPx(0, "a", keys, {
        draggingKey: "c",
        dropTargetKey: "a",
        dropPosition: "before",
        rowHeights: heights,
      })
    ).toBe(48);
  });

  it("does not shift the dragged row", () => {
    expect(
      computeLineRowVisualShiftPx(2, "c", keys, {
        draggingKey: "c",
        dropTargetKey: "a",
        dropPosition: "before",
        rowHeights: heights,
      })
    ).toBe(0);
  });
});
