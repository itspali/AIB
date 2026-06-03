import { describe, expect, it } from "vitest";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  categoryHasComposableAxes,
  defaultVariantAxisKeys,
  isDefaultAxisTemplate,
  splitTemplatesByAxis,
  usedVariantAttributeKeys,
  validateVariantAxesSelection,
} from "@/lib/products/variant-composition";

const size: AttributeTemplateEntry = {
  key: "size",
  label: "Size",
  type: "select",
  options: ["1kg", "5kg"],
};
const color: AttributeTemplateEntry = {
  key: "color",
  label: "Color",
  type: "select",
  options: ["Red", "Blue"],
};
const brand: AttributeTemplateEntry = {
  key: "brand",
  label: "Brand",
  type: "text",
};
const templates = [size, brand, color];

describe("isDefaultAxisTemplate", () => {
  it("treats choice-typed templates with options as axes", () => {
    expect(isDefaultAxisTemplate(size)).toBe(true);
    expect(isDefaultAxisTemplate(color)).toBe(true);
  });

  it("treats free-form templates as descriptive", () => {
    expect(isDefaultAxisTemplate(brand)).toBe(false);
  });

  it("does not treat optionless select templates as axes", () => {
    expect(isDefaultAxisTemplate({ key: "x", label: "X", type: "select" })).toBe(false);
  });

  it("honors an explicit category role over the type heuristic", () => {
    expect(isDefaultAxisTemplate({ ...size, role: "descriptive" })).toBe(false);
    expect(isDefaultAxisTemplate({ ...brand, role: "axis" })).toBe(true);
  });
});

describe("usedVariantAttributeKeys", () => {
  it("collects only keys with a non-empty value", () => {
    const used = usedVariantAttributeKeys([
      { variant_attributes: { size: "1kg", brand: "" } },
      { variant_attributes: { size: "5kg", color: null } },
      { variant_attributes: null },
    ]);
    expect(used.sort()).toEqual(["size"]);
  });
});

describe("defaultVariantAxisKeys", () => {
  it("prefers attributes already used by existing variants", () => {
    expect(defaultVariantAxisKeys(templates, ["brand"])).toEqual(["brand"]);
  });

  it("falls back to choice-typed templates when no variants exist", () => {
    expect(defaultVariantAxisKeys(templates, [])).toEqual(["size", "color"]);
  });

  it("keeps template order", () => {
    expect(defaultVariantAxisKeys(templates, ["color", "size"])).toEqual(["size", "color"]);
  });
});

describe("splitTemplatesByAxis", () => {
  it("partitions templates into axes and descriptive", () => {
    const { axes, descriptive } = splitTemplatesByAxis(templates, ["size"]);
    expect(axes.map((t) => t.key)).toEqual(["size"]);
    expect(descriptive.map((t) => t.key)).toEqual(["brand", "color"]);
  });
});

describe("categoryHasComposableAxes", () => {
  it("is true when templates have options or axis role", () => {
    expect(categoryHasComposableAxes(templates)).toBe(true);
    expect(categoryHasComposableAxes([brand])).toBe(false);
    expect(categoryHasComposableAxes([{ ...brand, role: "axis" }])).toBe(true);
  });
});

describe("validateVariantAxesSelection", () => {
  it("requires axes for MULTI_SKU physical items with composable templates", () => {
    expect(
      validateVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: [],
        categoryTemplates: templates,
      })
    ).toMatch(/at least one/i);
  });

  it("allows empty axes for SINGLE_SKU", () => {
    expect(
      validateVariantAxesSelection({
        variant_strategy: "SINGLE_SKU",
        item_type: "PHYSICAL",
        variant_axes: [],
        categoryTemplates: templates,
      })
    ).toBeNull();
  });

  it("skips validation when category has no composable templates", () => {
    expect(
      validateVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: [],
        categoryTemplates: [brand],
      })
    ).toBeNull();
  });

  it("rejects axes not on the category", () => {
    expect(
      validateVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: ["missing"],
        categoryTemplates: templates,
      })
    ).toMatch(/not defined/i);
  });

  it("accepts valid axis keys", () => {
    expect(
      validateVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: ["size"],
        categoryTemplates: templates,
      })
    ).toBeNull();
  });
});
