import { describe, expect, it } from "vitest";
import {
  EDITOR_PANEL_HORIZONTAL_RAIL_MAX_WIDTH_PX,
  resolveEditorPanelHorizontalRail,
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
