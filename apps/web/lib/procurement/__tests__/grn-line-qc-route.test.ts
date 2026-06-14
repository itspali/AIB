import { describe, expect, it } from "vitest";
import { resolveGrnLineQcRouteUi } from "@/lib/procurement/goods-receipts/grn-line-qc-route";

const baseContext = {
  qcModuleEnabled: true,
  allowLineOverride: false,
  orgDefaultRouteToQc: true,
};

describe("resolveGrnLineQcRouteUi", () => {
  it("locks category-required lines with QC required badge when overrides disabled", () => {
    const ui = resolveGrnLineQcRouteUi(
      baseContext,
      { item_policy: "INHERIT", category_policy: "REQUIRED" },
      false
    );

    expect(ui.canOverride).toBe(false);
    expect(ui.effectiveRoute).toBe(true);
    expect(ui.badgeLabel).toBe("QC required");
    expect(ui.title).toBe("QC required");
  });

  it("locks exempt lines to direct stock when overrides disabled", () => {
    const ui = resolveGrnLineQcRouteUi(
      baseContext,
      { item_policy: "EXEMPT", category_policy: null },
      true
    );

    expect(ui.effectiveRoute).toBe(false);
    expect(ui.badgeLabel).toBe("QC exempt");
  });

  it("allows toggle when overrides enabled", () => {
    const ui = resolveGrnLineQcRouteUi(
      { ...baseContext, allowLineOverride: true },
      { item_policy: "INHERIT", category_policy: "REQUIRED" },
      false
    );

    expect(ui.canOverride).toBe(true);
    expect(ui.title).toBe("Route to QC hold");
    expect(ui.effectiveRoute).toBe(false);
  });
});
