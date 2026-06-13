import { describe, expect, it } from "vitest";
import { locationSupportsInventoryOps } from "@/lib/locations/capabilities";

describe("locationSupportsInventoryOps (Wave 6)", () => {
  it("allows physical stock-holding locations", () => {
    expect(
      locationSupportsInventoryOps({
        is_stock_holding: true,
        presence_type: "PHYSICAL",
        is_git_holding: false,
        is_subcontract_wip: false,
      })
    ).toBe(true);
  });

  it("blocks generic virtual locations", () => {
    expect(
      locationSupportsInventoryOps({
        is_stock_holding: true,
        presence_type: "VIRTUAL",
        is_git_holding: false,
        is_subcontract_wip: false,
      })
    ).toBe(false);
  });

  it("allows virtual GIT holding nodes", () => {
    expect(
      locationSupportsInventoryOps({
        is_stock_holding: true,
        presence_type: "VIRTUAL",
        is_git_holding: true,
        is_subcontract_wip: false,
      })
    ).toBe(true);
  });

  it("allows virtual subcontract WIP nodes", () => {
    expect(
      locationSupportsInventoryOps({
        is_stock_holding: true,
        presence_type: "VIRTUAL",
        is_git_holding: false,
        is_subcontract_wip: true,
      })
    ).toBe(true);
  });
});
