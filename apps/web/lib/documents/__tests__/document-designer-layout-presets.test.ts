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

  it("applies compact preset with tighter shell", () => {
    const result = applyDesignerLayoutPreset("compact", baseBundle);
    expect(result.shellConfig.margins.top).toBe("8mm");
    expect(result.shellConfig.header.showOrgAddress).toBe(false);
  });

  it("generates a distinct randomized layout bundle", () => {
    const generated = generateDesignerLayout(baseBundle);
    const serialized = JSON.stringify(generated);
    const baseline = JSON.stringify(baseBundle);
    expect(serialized).not.toBe(baseline);
  });
});
