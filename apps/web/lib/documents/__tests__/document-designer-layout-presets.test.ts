import { describe, expect, it } from "vitest";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import { DEFAULT_PRESENTATION_SHELL_CONFIG } from "@/lib/documents/print/default-shell-config";
import {
  applyDesignerLayoutPreset,
  cycleDesignerLayoutPreset,
  DOCUMENT_DESIGNER_LAYOUT_PRESETS,
  generateDesignerLayout,
  normalizeDesignerBundle,
} from "@/lib/documents/print/document-designer-layout-presets";

describe("document designer layout presets", () => {
  const baseBundle = normalizeDesignerBundle(
    "PURCHASE_ORDER",
    "PDF_PRINT",
    DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_ORDER.defaultLayout,
    DEFAULT_PRESENTATION_SHELL_CONFIG
  );

  it("exposes at least five named presets", () => {
    expect(DOCUMENT_DESIGNER_LAYOUT_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it("cycles presets with previous and next", () => {
    const first = DOCUMENT_DESIGNER_LAYOUT_PRESETS[0]!.id;
    const next = cycleDesignerLayoutPreset(first, 1).id;
    const previous = cycleDesignerLayoutPreset(next, -1).id;
    expect(previous).toBe(first);
  });

  it("applies compact preset with tighter shell and compact theme", () => {
    const result = applyDesignerLayoutPreset("compact", baseBundle);
    expect(result.shellConfig.margins.top).toBe("8mm");
    expect(result.shellConfig.header.showOrgAddress).toBe(false);
    expect(result.styleConfig.layoutTheme).toBe("compact");
    expect(result.styleConfig.fontSizePx).toBe(10);
  });

  it("applies branded preset with distinct visual theme", () => {
    const result = applyDesignerLayoutPreset("branded", baseBundle);
    expect(result.styleConfig.layoutTheme).toBe("branded");
    expect(result.shellConfig.sections.showTerms).toBe(true);
  });

  it("applies formal preset with right-aligned numeric columns", () => {
    const result = applyDesignerLayoutPreset("formal", baseBundle);
    expect(result.styleConfig.layoutTheme).toBe("formal");
    const numericColumn = result.layout.columns.find((column) =>
      /quantity|qty|price|amount|total|tax|rate/i.test(column.id)
    );
    expect(numericColumn?.align).toBe("right");
  });

  it("generates a distinct randomized layout bundle", () => {
    const generated = generateDesignerLayout(baseBundle);
    const serialized = JSON.stringify(generated);
    const baseline = JSON.stringify(baseBundle);
    expect(serialized).not.toBe(baseline);
  });
});
