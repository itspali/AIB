import { describe, expect, it } from "vitest";
import {
  extraSkuOptionAxisCandidates,
  itemHasComposableAxes,
  resolveItemCompositionTemplates,
  sanitizeItemVariantAxisKeys,
  validateItemVariantAxesSelection,
} from "@/lib/products/item-composition-templates";
import type { AttributeTemplateEntry } from "@/lib/categories/types";

const categoryAxes: AttributeTemplateEntry[] = [
  {
    key: "material",
    label: "Material",
    type: "select",
    options: [
      { label: "Cotton", code: "COTT" },
      { label: "Poly", code: "POLY" },
    ],
    role: "axis",
  },
];

const extraAxes: AttributeTemplateEntry[] = [
  {
    key: "finish",
    label: "Finish",
    type: "select",
    options: [
      { label: "Matte", code: "MATT" },
      { label: "Gloss", code: "GLOS" },
    ],
    role: "axis",
  },
];

describe("resolveItemCompositionTemplates", () => {
  it("merges category and extra templates with extra overriding duplicate keys", () => {
    const merged = resolveItemCompositionTemplates(
      [{ key: "shared", label: "Category", type: "text" }],
      [{ key: "shared", label: "Product", type: "select", options: [{ label: "A", code: "A" }] }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.label).toBe("Product");
  });

  it("returns category templates when extras are empty", () => {
    expect(resolveItemCompositionTemplates(categoryAxes, [])).toEqual(categoryAxes);
  });
});

describe("sanitizeItemVariantAxisKeys", () => {
  it("keeps keys from both category and extra templates", () => {
    const merged = resolveItemCompositionTemplates(categoryAxes, extraAxes);
    expect(
      sanitizeItemVariantAxisKeys(["material", "finish", "unknown"], categoryAxes, extraAxes)
    ).toEqual(["material", "finish"]);
    expect(itemHasComposableAxes(categoryAxes, extraAxes)).toBe(true);
    expect(extraSkuOptionAxisCandidates(extraAxes)).toHaveLength(1);
  });
});

describe("validateItemVariantAxesSelection", () => {
  it("requires axes when merged templates exist for multi-SKU physical items", () => {
    expect(
      validateItemVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: [],
        categoryTemplates: [],
        extraTemplates: extraAxes,
      })
    ).toBe("Choose at least one attribute that varies by variant.");
  });

  it("accepts extra-only axes", () => {
    expect(
      validateItemVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: ["finish"],
        categoryTemplates: [],
        extraTemplates: extraAxes,
      })
    ).toBeNull();
  });
});
