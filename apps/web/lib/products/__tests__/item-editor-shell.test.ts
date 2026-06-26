import { describe, expect, it } from "vitest";
import { EDITOR_STAGES, editorStageById } from "@/lib/products/editor-stages";

describe("item editor stages", () => {
  it("maps each wizard stage to the expected editor sections", () => {
    expect(editorStageById("essentials").sections).toEqual([
      "overview",
      "salable",
      "purchasable",
      "inventory",
    ]);
    expect(editorStageById("versions").sections).toEqual(["variants"]);
    expect(editorStageById("composition").sections).toEqual(["composition"]);
    expect(editorStageById("reach").sections).toEqual([
      "media",
      "product_attributes",
      "custom_fields",
      "tags",
      "visibility",
    ]);
    expect(EDITOR_STAGES).toHaveLength(4);
  });
});
