import { describe, expect, it } from "vitest";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { suggestSkuMask } from "@/lib/products/sku-mask";
import {
  categoryHasComposableAxes,
  countVariantSkuRows,
  defaultVariantAxisKeys,
  filterVariantAxisCandidateTemplates,
  isDefaultAxisTemplate,
  isVariantAxisCandidate,
  formatDescriptiveVariantAttributes,
  formatVariantAxisLabels,
  hasVariantAxisCandidates,
  moveVariantAxisKey,
  pickDescriptiveVariantAttributes,
  resolveFormVariantStrategy,
  resolveVariantCompositionMode,
  sanitizeVariantAxisKeys,
  shouldComposeVariants,
  shouldLockProductCode,
  shouldLockVariantAxisPicker,
  shouldShowSingleSkuEntryFields,
  shouldShowVariantsWizardStage,
  splitTemplatesByAxis,
  toggleVariantAxisKey,
  usedVariantAttributeKeys,
  validateVariantAxesSelection,
} from "@/lib/products/variant-composition";

const size: AttributeTemplateEntry = {
  key: "size",
  label: "Size",
  type: "select",
  options: [
    { label: "1kg", code: "1KG" },
    { label: "5kg", code: "5KG" },
  ],
};
const color: AttributeTemplateEntry = {
  key: "color",
  label: "Color",
  type: "select",
  options: [
    { label: "Red", code: "RED" },
    { label: "Blue", code: "BLUE" },
  ],
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

  it("does not treat multiselect templates as default axes", () => {
    expect(
      isDefaultAxisTemplate({
        key: "tags",
        label: "Tags",
        type: "multiselect",
        options: [
          { label: "A", code: "A" },
          { label: "B", code: "B" },
        ],
      })
    ).toBe(false);
  });
});

describe("isVariantAxisCandidate", () => {
  it("excludes multiselect and descriptive templates", () => {
    expect(
      isVariantAxisCandidate({
        key: "tags",
        label: "Tags",
        type: "multiselect",
        options: [{ label: "A", code: "A" }],
      })
    ).toBe(false);
    expect(isVariantAxisCandidate({ ...size, role: "descriptive" })).toBe(false);
    expect(isVariantAxisCandidate(size)).toBe(true);
  });
});

describe("pickDescriptiveVariantAttributes", () => {
  it("keeps only non-axis template values", () => {
    const picked = pickDescriptiveVariantAttributes(
      { size: "1kg", brand: "Acme", color: "Red" },
      templates,
      ["size"]
    );
    expect(picked).toEqual({ brand: "Acme", color: "Red" });
  });
});

describe("formatVariantAxisLabels", () => {
  it("uses template labels when available", () => {
    expect(formatVariantAxisLabels(["size", "color"], templates)).toBe("Size, Color");
  });
});

describe("formatDescriptiveVariantAttributes", () => {
  it("formats descriptive values with labels", () => {
    expect(
      formatDescriptiveVariantAttributes({ brand: "Acme" }, templates, ["size"])
    ).toBe("Brand: Acme");
  });
});

describe("sanitizeVariantAxisKeys", () => {
  it("drops multiselect and unknown keys", () => {
    const templates = [
      size,
      {
        key: "tags",
        label: "Tags",
        type: "multiselect" as const,
        options: [{ label: "A", code: "A" }],
      },
    ];
    expect(sanitizeVariantAxisKeys(["size", "tags", "missing"], templates)).toEqual(["size"]);
    expect(filterVariantAxisCandidateTemplates(templates).map((t) => t.key)).toEqual(["size"]);
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

  it("preserves variant_axes order for SKU generation", () => {
    const { axes } = splitTemplatesByAxis(templates, ["color", "size"]);
    expect(axes.map((t) => t.key)).toEqual(["color", "size"]);
  });
});

describe("variant axis key helpers", () => {
  it("appends newly selected axes", () => {
    expect(toggleVariantAxisKey(["size"], "color")).toEqual(["size", "color"]);
  });

  it("reorders axes without changing membership", () => {
    expect(moveVariantAxisKey(["size", "color"], "color", -1)).toEqual(["color", "size"]);
  });

  it("builds SKU mask tokens in axis order", () => {
    expect(suggestSkuMask([color, size])).toBe("{BASE}{color}{size}");
    expect(suggestSkuMask([size, color])).toBe("{BASE}{size}{color}");
  });
});

describe("hasVariantAxisCandidates", () => {
  it("is true when category has axis-eligible templates", () => {
    expect(hasVariantAxisCandidates(templates)).toBe(true);
    expect(hasVariantAxisCandidates([brand])).toBe(true);
    expect(hasVariantAxisCandidates([])).toBe(false);
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

  it("rejects multiselect keys even when defined on the category", () => {
    expect(
      validateVariantAxesSelection({
        variant_strategy: "MULTI_SKU",
        item_type: "PHYSICAL",
        variant_axes: ["tags"],
        categoryTemplates: [
          size,
          {
            key: "tags",
            label: "Tags",
            type: "multiselect",
            options: [{ label: "A", code: "A" }],
          },
        ],
      })
    ).toMatch(/cannot be used as a variant axis/i);
  });
});

describe("resolveVariantCompositionMode", () => {
  it("uses draft on Essentials create wizard steps", () => {
    expect(
      resolveVariantCompositionMode({
        activeWizardStage: "essentials",
        wizardActive: true,
        wizardSteps: true,
      })
    ).toBe("draft");
  });

  it("uses live outside Essentials create wizard", () => {
    expect(
      resolveVariantCompositionMode({
        activeWizardStage: "essentials",
        wizardActive: true,
        wizardSteps: false,
      })
    ).toBe("live");
  });
});

describe("shouldLockVariantAxisPicker", () => {
  it("stays unlocked for master-only or a single sellable SKU row", () => {
    expect(
      shouldLockVariantAxisPicker([{ is_master: true, is_sellable: true }])
    ).toBe(false);
    expect(
      shouldLockVariantAxisPicker([
        { is_master: true, is_sellable: true },
        { is_master: false, is_sellable: true },
      ])
    ).toBe(false);
  });

  it("locks once two sellable SKU rows exist", () => {
    expect(
      shouldLockVariantAxisPicker([
        { is_master: false, is_sellable: true },
        { is_master: false, is_sellable: true },
      ])
    ).toBe(true);
  });
});

describe("countVariantSkuRows", () => {
  it("counts non-master variant rows only", () => {
    expect(countVariantSkuRows([])).toBe(0);
    expect(
      countVariantSkuRows([{ is_master: true }, { is_master: false }, { is_master: false }])
    ).toBe(2);
  });
});

describe("shouldShowSingleSkuEntryFields", () => {
  it("shows single entry for non-multi items", () => {
    expect(
      shouldShowSingleSkuEntryFields({
        isMultiSku: false,
        variantAxisKeys: [],
        sellableVariantCount: 0,
        variants: [],
      })
    ).toBe(true);
  });

  it("shows single entry for multi items before axes or variant rows exist", () => {
    expect(
      shouldShowSingleSkuEntryFields({
        isMultiSku: true,
        variantAxisKeys: [],
        sellableVariantCount: 0,
        variants: [{ is_master: true }],
      })
    ).toBe(true);
  });

  it("hides single entry when variant axes are selected", () => {
    expect(
      shouldShowSingleSkuEntryFields({
        isMultiSku: true,
        variantAxisKeys: ["size"],
        sellableVariantCount: 0,
        variants: [],
      })
    ).toBe(false);
  });

  it("hides single entry when variant SKU rows exist", () => {
    expect(
      shouldShowSingleSkuEntryFields({
        isMultiSku: true,
        variantAxisKeys: [],
        sellableVariantCount: 1,
        variants: [{ is_master: true }, { is_master: false }],
      })
    ).toBe(false);
  });
});

describe("resolveFormVariantStrategy", () => {
  it("forces SINGLE_SKU for unsaved items without axes or SKU rows", () => {
    expect(
      resolveFormVariantStrategy("MULTI_SKU", {
        itemId: null,
        variantAxisKeys: [],
        sellableVariantCount: 0,
        variants: [],
      })
    ).toBe("SINGLE_SKU");
  });

  it("preserves MULTI_SKU when axes are selected before save", () => {
    expect(
      resolveFormVariantStrategy("MULTI_SKU", {
        itemId: null,
        variantAxisKeys: ["size"],
        sellableVariantCount: 0,
        variants: [],
      })
    ).toBe("MULTI_SKU");
  });

  it("preserves inferred strategy for persisted items", () => {
    expect(
      resolveFormVariantStrategy("MULTI_SKU", {
        itemId: "item-1",
        variantAxisKeys: [],
        sellableVariantCount: 0,
        variants: [{ is_master: true }],
      })
    ).toBe("MULTI_SKU");
  });
});

describe("shouldShowVariantsWizardStage", () => {
  it("is false for single-SKU items", () => {
    expect(
      shouldShowVariantsWizardStage({
        isMultiSku: false,
        variantAxisKeys: [],
        sellableVariantCount: 0,
        variants: [],
      })
    ).toBe(false);
  });

  it("is true when variant axes are selected", () => {
    expect(
      shouldShowVariantsWizardStage({
        isMultiSku: false,
        variantAxisKeys: ["size"],
        sellableVariantCount: 0,
        variants: [],
      })
    ).toBe(true);
  });
});

describe("shouldLockProductCode", () => {
  it("stays editable when only the style master row exists", () => {
    expect(shouldLockProductCode([{ is_master: true }])).toBe(false);
    expect(shouldLockProductCode([])).toBe(false);
  });

  it("locks once any variant SKU row exists", () => {
    expect(
      shouldLockProductCode([
        { is_master: true },
        { is_master: false },
      ])
    ).toBe(true);
  });

  it("locks for non-sellable variant SKU rows", () => {
    expect(
      shouldLockProductCode([
        { is_master: true },
        { is_master: false },
      ])
    ).toBe(true);
  });
});

describe("shouldComposeVariants", () => {
  it("enables composition in Essentials draft even before multi-SKU is inferred", () => {
    expect(
      shouldComposeVariants({
        isMultiSku: false,
        compositionMode: "draft",
        variantAxisCount: 0,
      })
    ).toBe(true);
  });
});
