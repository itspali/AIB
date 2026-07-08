import { describe, expect, it } from "vitest";
import {
  findNextAvailableSkuFromSequence,
  formatSkuFromPattern,
  normalizeGtinInput,
  parseCatalogItemSettings,
  resolveScannableCode,
} from "@/lib/products/catalog-item-settings";

describe("resolveScannableCode", () => {
  it("prefers GTIN then SKU", () => {
    expect(resolveScannableCode("SKU-1", "8901", "GTIN_THEN_SKU")).toBe("8901");
    expect(resolveScannableCode("SKU-1", "", "GTIN_THEN_SKU")).toBe("SKU-1");
  });

  it("uses GTIN only when policy is GTIN", () => {
    expect(resolveScannableCode("SKU-1", "", "GTIN")).toBeNull();
    expect(resolveScannableCode("SKU-1", "8901", "GTIN")).toBe("8901");
  });

  it("uses SKU only when policy is SKU", () => {
    expect(resolveScannableCode("SKU-1", "8901", "SKU")).toBe("SKU-1");
  });
});

describe("findNextAvailableSkuFromSequence", () => {
  const settings = {
    scan_identifier_policy: "GTIN_THEN_SKU" as const,
    sku_auto_generation_enabled: true,
    sku_auto_pattern: "{PREFIX}-{SEQ:4}",
    sku_auto_prefix: "IT",
    allow_duplicate_item_names: false,
  };

  it("skips taken SKUs in sequence order", () => {
    const taken = new Set(["IT-0012", "IT-0013"]);
    const result = findNextAvailableSkuFromSequence(settings, 12, (sku) => taken.has(sku));
    expect(result).toEqual({ sku: "IT-0014", nextSequence: 15 });
  });

  it("returns null when the probe budget is exhausted", () => {
    const taken = new Set(["IT-0001"]);
    const result = findNextAvailableSkuFromSequence(settings, 1, () => true, 1);
    expect(result).toBeNull();
  });
});

describe("formatSkuFromPattern", () => {
  it("applies PREFIX and SEQ tokens", () => {
    const sku = formatSkuFromPattern(
      {
        scan_identifier_policy: "GTIN_THEN_SKU",
        sku_auto_generation_enabled: true,
        sku_auto_pattern: "{PREFIX}-{SEQ:4}",
        sku_auto_prefix: "IT",
        allow_duplicate_item_names: false,
      },
      12
    );
    expect(sku).toBe("IT-0012");
  });
});

describe("parseCatalogItemSettings", () => {
  it("falls back to defaults", () => {
    expect(parseCatalogItemSettings(null).scan_identifier_policy).toBe("GTIN_THEN_SKU");
    expect(parseCatalogItemSettings(null).allow_duplicate_item_names).toBe(false);
  });
});

describe("normalizeGtinInput", () => {
  it("trims whitespace", () => {
    expect(normalizeGtinInput("  890  ")).toBe("890");
  });
});
