import { describe, expect, it } from "vitest";
import { EDITOR_STAGES, editorStageById, editorStageOrder } from "@/lib/products/editor-stages";

describe("item editor stages", () => {
  it("maps each wizard stage to the expected editor sections", () => {
    expect(editorStageById("essentials").sections).toEqual([
      "overview",
      "variants",
      "composite_item",
      "alternate_uoms",
      "item_logistics",
    ]);
    expect(editorStageById("versions").sections).toEqual(["variant_rows"]);
    expect(editorStageById("composition").sections).toEqual(["composition"]);
    expect(editorStageById("reach").sections).toEqual([
      "purchasable",
      "salable",
      "quality_inspection",
      "media",
      "product_attributes",
      "custom_fields",
      "tags",
      "visibility",
    ]);
    expect(EDITOR_STAGES).toHaveLength(4);
  });
});

describe("editorStageOrder", () => {
  it("includes variants stage when multi-SKU composition applies", () => {
    expect(
      editorStageOrder({ showVariantsWizardStage: true, hasComposition: false })
    ).toEqual(["essentials", "versions", "reach"]);
  });

  it("includes composition stage when sold as a set", () => {
    expect(editorStageOrder({ showVariantsWizardStage: false, hasComposition: true })).toEqual([
      "essentials",
      "composition",
      "reach",
    ]);
  });
});
