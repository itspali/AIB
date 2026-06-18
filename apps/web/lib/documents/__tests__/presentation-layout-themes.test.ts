import { describe, expect, it } from "vitest";
import {
  normalizePresentationLayoutTheme,
  presentationStyleForLayoutTheme,
  renderPresentationLayoutThemeCss,
} from "@/lib/documents/print/presentation-layout-themes";

describe("presentation layout themes", () => {
  it("normalizes unknown themes to standard", () => {
    expect(normalizePresentationLayoutTheme("unknown")).toBe("standard");
  });

  it("returns distinct style configs per theme", () => {
    const compact = presentationStyleForLayoutTheme("compact");
    const branded = presentationStyleForLayoutTheme("branded");
    const modern = presentationStyleForLayoutTheme("modern");
    expect(compact.layoutTheme).toBe("compact");
    expect(branded.layoutTheme).toBe("branded");
    expect(modern.layoutTheme).toBe("modern");
    expect(compact.fontSizePx).not.toBe(branded.fontSizePx);
  });

  it("renders non-empty css for non-standard themes", () => {
    expect(renderPresentationLayoutThemeCss("standard")).toBe("");
    expect(renderPresentationLayoutThemeCss("branded")).toContain("theme-branded");
    expect(renderPresentationLayoutThemeCss("formal")).toContain("theme-formal");
    expect(renderPresentationLayoutThemeCss("modern")).toContain("theme-modern");
    expect(renderPresentationLayoutThemeCss("modern")).toContain("metadata-panel");
  });
});
