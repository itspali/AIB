import { describe, expect, it } from "vitest";
import {
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

describe("formatSkuFromPattern", () => {
  it("applies PREFIX and SEQ tokens", () => {
    const sku = formatSkuFromPattern(
      {
        scan_identifier_policy: "GTIN_THEN_SKU",
        sku_auto_generation_enabled: true,
        sku_auto_pattern: "{PREFIX}-{SEQ:4}",
        sku_auto_prefix: "IT",
      },
      12
    );
    expect(sku).toBe("IT-0012");
  });
});

describe("parseCatalogItemSettings", () => {
  it("falls back to defaults", () => {
    expect(parseCatalogItemSettings(null).scan_identifier_policy).toBe("GTIN_THEN_SKU");
  });
});

describe("normalizeGtinInput", () => {
  it("trims whitespace", () => {
    expect(normalizeGtinInput("  890  ")).toBe("890");
  });
});
