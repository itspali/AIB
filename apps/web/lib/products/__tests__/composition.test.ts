import { describe, expect, it } from "vitest";
import {
  allowedComponentItemTypes,
  compositionRoleAllowsComponents,
  normalizeCompositionFromDetail,
} from "@/lib/products/composition";
import { editorStageOrder } from "@/lib/products/editor-stages";

describe("normalizeCompositionFromDetail", () => {
  it("migrates legacy kit bundle role to finished good with composition on", () => {
    expect(
      normalizeCompositionFromDetail({
        classification: "KIT_BUNDLE",
        is_bundle: false,
      })
    ).toEqual({
      classification: "FINISHED_GOOD",
      is_bundle: true,
    });
  });

  it("passes through modern rows unchanged", () => {
    expect(
      normalizeCompositionFromDetail({
        classification: "FINISHED_GOOD",
        is_bundle: true,
      })
    ).toEqual({
      classification: "FINISHED_GOOD",
      is_bundle: true,
    });
  });
});

describe("composition component rules", () => {
  it("allows physical components for finished good and wip", () => {
    expect(allowedComponentItemTypes("FINISHED_GOOD")).toEqual(["PHYSICAL"]);
    expect(allowedComponentItemTypes("WIP_ASSEMBLY")).toEqual(["PHYSICAL"]);
    expect(compositionRoleAllowsComponents("FINISHED_GOOD")).toBe(true);
  });

  it("disallows composition roles for raw material", () => {
    expect(compositionRoleAllowsComponents("RAW_MATERIAL")).toBe(false);
  });
});

describe("editorStageOrder", () => {
  it("includes composition stage when sold as a set", () => {
    expect(
      editorStageOrder({ isMultiSku: false, hasComposition: true })
    ).toEqual(["essentials", "composition", "reach"]);
  });

  it("skips composition and variants for simple standalone items", () => {
    expect(
      editorStageOrder({ isMultiSku: false, hasComposition: false })
    ).toEqual(["essentials", "reach"]);
  });

  it("orders variants before composition for multi-sku sets", () => {
    expect(
      editorStageOrder({ isMultiSku: true, hasComposition: true })
    ).toEqual(["essentials", "versions", "composition", "reach"]);
  });
});
