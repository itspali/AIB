import { describe, expect, it } from "vitest";
import {
  buildBufferThresholdSaveRows,
  bufferCellKey,
  parseBufferInput,
  reorderPointChanged,
  resolveBufferReorderDisplay,
} from "@/lib/products/buffer-thresholds";

describe("buffer-thresholds", () => {
  it("builds cell keys", () => {
    expect(bufferCellKey("v1", "l1")).toBe("v1:l1");
  });

  it("resolves inherited display from master default", () => {
    expect(resolveBufferReorderDisplay(undefined, "12")).toEqual({
      value: "",
      inherited: true,
      placeholder: "12",
    });
  });

  it("resolves explicit override display", () => {
    expect(resolveBufferReorderDisplay("5", "12")).toEqual({
      value: "5",
      inherited: false,
      placeholder: "12",
    });
  });

  it("parses buffer input", () => {
    expect(parseBufferInput("")).toBeNull();
    expect(parseBufferInput("0")).toBe("0");
    expect(parseBufferInput("12.5")).toBe("12.5");
    expect(parseBufferInput("-1")).toBeNull();
  });

  it("detects reorder point changes with normalized comparison", () => {
    expect(reorderPointChanged("10", "10.0")).toBe(false);
    expect(reorderPointChanged("10", "12")).toBe(true);
    expect(reorderPointChanged("", "0")).toBe(false);
    expect(reorderPointChanged("5", "")).toBe(true);
  });

  it("builds save rows for clears and updates", () => {
    const rows = buildBufferThresholdSaveRows(
      ["v1"],
      ["l1", "l2", "l3"],
      {
        [bufferCellKey("v1", "l1")]: "8",
        [bufferCellKey("v1", "l2")]: "",
      },
      {
        [bufferCellKey("v1", "l2")]: true,
      }
    );

    expect(rows).toEqual([
      { variant_id: "v1", location_id: "l1", reorder_point_qty: "8" },
      { variant_id: "v1", location_id: "l2", reorder_point_qty: "" },
    ]);
  });
});
