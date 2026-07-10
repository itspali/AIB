import { describe, expect, it } from "vitest";
import {
  deriveAttributeOptionCode,
  formatOptionsDraftDisplay,
  normalizeAttributeOption,
  parseAttributeOptions,
  parseOptionsDraftInput,
  resolveAttributeOptionSkuCode,
} from "@/lib/categories/attribute-options";
import { parseAttributeTemplates } from "@/lib/categories/tree";

describe("attribute option codes", () => {
  it("derives short codes from labels", () => {
    expect(deriveAttributeOptionCode("Black")).toBe("BLAC");
    expect(deriveAttributeOptionCode("XL")).toBe("XL");
    expect(deriveAttributeOptionCode("128GB")).toBe("128G");
  });

  it("normalizes legacy strings and objects", () => {
    expect(normalizeAttributeOption("Red")).toEqual({ label: "Red", code: "RED" });
    expect(normalizeAttributeOption({ label: "Black", code: "blk" })).toEqual({
      label: "Black",
      code: "BLK",
    });
  });

  it("parses mixed JSONB option arrays", () => {
    expect(parseAttributeOptions(["S", { label: "Extra Large", code: "XL" }])).toEqual([
      { label: "S", code: "S" },
      { label: "Extra Large", code: "XL" },
    ]);
  });

  it("parses draft input with Label:CODE tokens", () => {
    expect(parseOptionsDraftInput("Black:BLK, Red, 128GB:128G")).toEqual([
      { label: "Black", code: "BLK" },
      { label: "Red", code: "RED" },
      { label: "128GB", code: "128G" },
    ]);
  });

  it("formats draft display with codes only when they differ from derived", () => {
    expect(
      formatOptionsDraftDisplay([
        { label: "Red", code: "RED" },
        { label: "Black", code: "BLK" },
      ])
    ).toBe("Red, Black:BLK");
  });

  it("resolves SKU code by label", () => {
    expect(
      resolveAttributeOptionSkuCode("Black", [
        { label: "Black", code: "BLK" },
        { label: "Red", code: "RD" },
      ])
    ).toBe("BLK");
  });

  it("parses attribute templates with legacy string options", () => {
    const templates = parseAttributeTemplates([
      { key: "color", label: "Color", type: "select", options: ["Red", "Blue"] },
    ]);
    expect(templates[0]?.options).toEqual([
      { label: "Red", code: "RED" },
      { label: "Blue", code: "BLUE" },
    ]);
  });
});
