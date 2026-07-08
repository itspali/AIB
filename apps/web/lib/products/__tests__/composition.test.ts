import { describe, expect, it } from "vitest";
import {
  allowedComponentItemTypes,
  compositionRoleAllowsComponents,
  normalizeCompositionFromDetail,
  validateCompositionDraftRows,
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
});

describe("composition component rules", () => {
  it("allows physical-only components for wip goods", () => {
    expect(allowedComponentItemTypes("PHYSICAL", "WIP_ASSEMBLY")).toEqual(["PHYSICAL"]);
  });

  it("allows mixed fg packages", () => {
    expect(allowedComponentItemTypes("PHYSICAL", "FINISHED_GOOD")).toEqual([
      "PHYSICAL",
      "SERVICE",
      "DIGITAL",
    ]);
  });

  it("allows service and digital components for service parents", () => {
    expect(allowedComponentItemTypes("SERVICE", "SERVICE")).toEqual(["SERVICE", "DIGITAL"]);
    expect(compositionRoleAllowsComponents("SERVICE", "SERVICE")).toBe(true);
  });

  it("allows digital and service components for digital parents", () => {
    expect(allowedComponentItemTypes("DIGITAL", "FINISHED_GOOD")).toEqual([
      "DIGITAL",
      "SERVICE",
    ]);
    expect(compositionRoleAllowsComponents("DIGITAL", "FINISHED_GOOD")).toBe(true);
  });

  it("disallows raw material parents", () => {
    expect(compositionRoleAllowsComponents("PHYSICAL", "RAW_MATERIAL")).toBe(false);
  });
});

describe("validateCompositionDraftRows", () => {
  it("requires at least one mandatory line when rows exist", () => {
    expect(
      validateCompositionDraftRows([
        {
          component_item_id: "a",
          is_mandatory: false,
          is_optional_addon: true,
          price_mode: "FIXED",
          unit_price: 10,
        },
      ])
    ).toMatch(/mandatory/i);
  });

  it("accepts mandatory plus optional lines", () => {
    expect(
      validateCompositionDraftRows([
        {
          component_item_id: "a",
          is_mandatory: true,
          is_optional_addon: false,
          price_mode: "COMPLIMENTARY",
          unit_price: 0,
        },
        {
          component_item_id: "b",
          is_mandatory: false,
          is_optional_addon: true,
          price_mode: "FIXED",
          unit_price: 500,
        },
      ])
    ).toBeNull();
  });
});

describe("editorStageOrder", () => {
  it("includes composition stage when sold as a set", () => {
    expect(editorStageOrder({ showVariantsWizardStage: false, hasComposition: true })).toEqual([
      "essentials",
      "composition",
      "reach",
    ]);
  });
});
