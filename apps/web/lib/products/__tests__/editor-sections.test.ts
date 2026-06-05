import { describe, expect, it } from "vitest";
import { editorSectionIdsForItem } from "@/lib/products/editor-sections";

describe("editor sections while creating", () => {
  it("omits variants, composition, and media until item is saved", () => {
    expect(editorSectionIdsForItem(null)).toEqual([
      "overview",
      "salable",
      "purchasable",
      "inventory",
      "catalog",
      "reach",
    ]);
  });

  it("shows composition only when sold as a set", () => {
    expect(editorSectionIdsForItem("item-uuid", { hasComposition: false })).toEqual([
      "overview",
      "salable",
      "purchasable",
      "inventory",
      "variants",
      "media",
      "catalog",
      "reach",
    ]);

    expect(editorSectionIdsForItem("item-uuid", { hasComposition: true })).toContain(
      "composition"
    );
  });
});
