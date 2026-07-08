import { describe, expect, it } from "vitest";
import { EDITOR_STAGES, editorStageById } from "@/lib/products/editor-stages";

describe("item editor stages", () => {
  it("maps each wizard stage to the expected editor sections", () => {
    expect(editorStageById("essentials").sections).toEqual([
      "overview",
      "variants",
      "composite_item",
      "alternate_uoms",
      "item_logistics",
      "salable",
      "quality_inspection",
    ]);
    expect(editorStageById("composition").sections).toEqual(["composition"]);
    expect(editorStageById("reach").sections).toEqual([
      "purchasable",
      "media",
      "product_attributes",
      "custom_fields",
      "tags",
      "visibility",
    ]);
    expect(EDITOR_STAGES).toHaveLength(3);
  });
});
