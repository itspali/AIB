import { describe, expect, it } from "vitest";
import { editorSectionIdsForItem } from "@/lib/products/editor-sections";

describe("editor sections while creating", () => {
  it("omits variants and media until item is saved", () => {
    expect(editorSectionIdsForItem(null)).toEqual([
      "overview",
      "units",
      "commerce",
      "catalog",
      "reach",
      "shipping",
    ]);
  });

  it("shows all sections after save", () => {
    expect(editorSectionIdsForItem("item-uuid")).toEqual([
      "overview",
      "units",
      "commerce",
      "variants",
      "media",
      "catalog",
      "reach",
      "shipping",
    ]);
  });
});
