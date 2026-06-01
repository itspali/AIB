import { describe, expect, it } from "vitest";
import { resolveListPaneLayoutOverrides } from "@/lib/products/list-pane-layout";

describe("resolveListPaneLayoutOverrides", () => {
  it("keeps user prefs when the detail pane is closed", () => {
    expect(
      resolveListPaneLayoutOverrides({
        viewportDeviceClass: "desktop",
        listPaneWidth: 900,
        detailPaneOpen: false,
        frozenColumnCount: 2,
        cardGridColumns: 3,
        freezeColumnsAuto: true,
      })
    ).toEqual({
      deviceClass: "desktop",
      frozenColumnCount: 2,
      cardGridColumns: 3,
      freezeColumnsAuto: true,
    });
  });

  it("removes frozen columns and uses one card column when the detail pane is open", () => {
    expect(
      resolveListPaneLayoutOverrides({
        viewportDeviceClass: "desktop",
        listPaneWidth: 420,
        detailPaneOpen: true,
        frozenColumnCount: 2,
        cardGridColumns: 4,
        freezeColumnsAuto: true,
      })
    ).toEqual({
      deviceClass: "mobile",
      frozenColumnCount: 0,
      cardGridColumns: 1,
      freezeColumnsAuto: false,
    });
  });
});
