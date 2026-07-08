import { describe, expect, it } from "vitest";
import {
  EDITOR_GLASS_SECTION_CLASS,
  editorCardClassName,
  editorGlassSectionClass,
  editorWizardLeftRailGlassAsideClass,
  editorWizardTopBarGlassClass,
} from "@/lib/products/editor-chrome";

describe("editor glass sections", () => {
  it("tags outer wizard section cards with editor-glass-section", () => {
    expect(EDITOR_GLASS_SECTION_CLASS).toBe("editor-glass-section");
    expect(editorGlassSectionClass()).toContain("surface-panel");
    expect(editorGlassSectionClass()).toContain("editor-glass-section");
  });

  it("uses glass card class only when panel layout and glass option are set", () => {
    const glass = editorCardClassName(true, "section", { glass: true });
    const panel = editorCardClassName(true, "section");
    const page = editorCardClassName(false, "section", { glass: true });

    expect(glass).toContain("editor-glass-section");
    expect(panel).not.toContain("editor-glass-section");
    expect(page).not.toContain("editor-glass-section");
  });

  it("exposes glass wizard chrome classes for stepper rails", () => {
    expect(editorWizardTopBarGlassClass(true)).toContain("backdrop-blur-xl");
    expect(editorWizardLeftRailGlassAsideClass(true)).toContain("backdrop-blur-xl");
  });
});
