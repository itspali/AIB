import { describe, expect, it } from "vitest";
import { editorSectionIdsForItem } from "@/lib/products/editor-sections";

describe("editor sections while creating", () => {
  it("omits variants and media until item is saved", () => {
    expect(editorSectionIdsForItem(null)).toEqual([
      "overview",
      "salable",
      "purchasable",
      "inventory",
      "catalog",
      "reach",
    ]);
  });

  it("shows all sections after save", () => {
    expect(editorSectionIdsForItem("item-uuid")).toEqual([
      "overview",
      "salable",
      "purchasable",
      "inventory",
      "variants",
      "media",
      "catalog",
      "reach",
    ]);
  });
});
