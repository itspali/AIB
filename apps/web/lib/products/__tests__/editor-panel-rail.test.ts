import { describe, expect, it } from "vitest";
import {
  EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX,
  EDITOR_WIZARD_LEFT_RAIL_MIN_DRAWER_VW,
  EDITOR_WIZARD_LEFT_RAIL_MIN_PANE_PX,
  resolveEditorPanelHorizontalRail,
  resolveWizardUseLeftRail,
} from "@/lib/products/editor-chrome";

describe("resolveEditorPanelHorizontalRail", () => {
  it("keeps vertical rail when pane width is unknown", () => {
    expect(resolveEditorPanelHorizontalRail(undefined)).toBe(false);
  });

  it("uses horizontal rail at or below the panel width threshold", () => {
    expect(resolveEditorPanelHorizontalRail(EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX)).toBe(
      true
    );
    expect(resolveEditorPanelHorizontalRail(320)).toBe(true);
  });

  it("keeps vertical rail above the threshold", () => {
    expect(
      resolveEditorPanelHorizontalRail(EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX + 1)
    ).toBe(false);
    expect(resolveEditorPanelHorizontalRail(640)).toBe(false);
  });
});

describe("resolveWizardUseLeftRail", () => {
  it("uses the top stepper on compact viewports", () => {
    expect(resolveWizardUseLeftRail(true, 1200, true)).toBe(false);
  });

  it("uses the left rail on full-page layout", () => {
    expect(resolveWizardUseLeftRail(false, 400, false)).toBe(true);
  });

  it("uses drawer vw presets when available", () => {
    expect(resolveWizardUseLeftRail(true, 2000, false, 40)).toBe(false);
    expect(resolveWizardUseLeftRail(true, 400, false, 60)).toBe(true);
    expect(resolveWizardUseLeftRail(true, 400, false, 80)).toBe(true);
    expect(
      resolveWizardUseLeftRail(true, 400, false, EDITOR_WIZARD_LEFT_RAIL_MIN_DRAWER_VW)
    ).toBe(true);
  });

  it("falls back to pane width when drawer vw is unavailable", () => {
    expect(resolveWizardUseLeftRail(true, undefined, false)).toBe(false);
    expect(
      resolveWizardUseLeftRail(true, EDITOR_WIZARD_LEFT_RAIL_MIN_PANE_PX - 1, false)
    ).toBe(false);
    expect(resolveWizardUseLeftRail(true, EDITOR_WIZARD_LEFT_RAIL_MIN_PANE_PX, false)).toBe(
      true
    );
  });
});
