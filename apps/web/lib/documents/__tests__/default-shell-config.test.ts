import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRESENTATION_CONTENT_PADDING,
  DEFAULT_PRESENTATION_LOGO_MAX_HEIGHT_PX,
  DEFAULT_PRESENTATION_LOGO_MAX_WIDTH_PX,
  DEFAULT_PRESENTATION_PAGE_MARGINS,
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  normalizePresentationShellConfig,
  presentationSpacingToCss,
} from "@/lib/documents/print/default-shell-config";

describe("normalizePresentationShellConfig", () => {
  it("fills missing padding from defaults", () => {
    const normalized = normalizePresentationShellConfig({
      margins: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" },
    });

    expect(normalized.padding).toEqual(DEFAULT_PRESENTATION_CONTENT_PADDING);
    expect(normalized.margins).toEqual({
      top: "10mm",
      bottom: "10mm",
      left: "8mm",
      right: "8mm",
    });
  });

  it("preserves custom padding values", () => {
    const normalized = normalizePresentationShellConfig({
      padding: { top: "16px", bottom: "12px", left: "20px", right: "20px" },
    });

    expect(normalized.padding).toEqual({
      top: "16px",
      bottom: "12px",
      left: "20px",
      right: "20px",
    });
  });

  it("returns full defaults when input is empty", () => {
    expect(normalizePresentationShellConfig(null)).toEqual(DEFAULT_PRESENTATION_SHELL_CONFIG);
  });

  it("normalizes logo placement and dimensions", () => {
    const normalized = normalizePresentationShellConfig({
      header: {
        showLogo: true,
        logoPlacement: "left",
        logoMaxHeightPx: 200,
        logoMaxWidthPx: 10,
        showOrgName: true,
        showOrgAddress: true,
        showDocumentTitle: true,
        titleOverride: null,
      },
    });

    expect(normalized.header.logoPlacement).toBe("left");
    expect(normalized.header.logoMaxHeightPx).toBe(120);
    expect(normalized.header.logoMaxWidthPx).toBe(60);
  });

  it("defaults missing logo settings", () => {
    const normalized = normalizePresentationShellConfig({});
    expect(normalized.header.logoPlacement).toBe("top");
    expect(normalized.header.logoMaxHeightPx).toBe(DEFAULT_PRESENTATION_LOGO_MAX_HEIGHT_PX);
    expect(normalized.header.logoMaxWidthPx).toBe(DEFAULT_PRESENTATION_LOGO_MAX_WIDTH_PX);
  });
});

describe("presentationSpacingToCss", () => {
  it("formats spacing values in CSS order", () => {
    expect(presentationSpacingToCss(DEFAULT_PRESENTATION_PAGE_MARGINS)).toBe(
      "12mm 10mm 12mm 10mm"
    );
    expect(presentationSpacingToCss(DEFAULT_PRESENTATION_CONTENT_PADDING)).toBe(
      "24px 24px 24px 24px"
    );
  });
});
