import { describe, expect, it } from "vitest";
import type { ScanIdentifierPolicy } from "@/lib/products/catalog-item-settings";
import {
  applyScanFriendlySkuPrefix,
  compactBaseSkuSegment,
  encodeScanFriendlyAxisSegment,
  scanFriendlySkuFieldHint,
  scanPolicyMayUseSku,
  validateScanFriendlySku,
} from "@/lib/products/scan-friendly-sku";
import type { AttributeTemplateEntry } from "@/lib/categories/types";

const sizeTemplate: AttributeTemplateEntry = {
  key: "size",
  label: "Size",
  type: "select",
  options: [
    { label: "S", code: "S" },
    { label: "M", code: "M" },
    { label: "L", code: "L" },
    { label: "XL", code: "XL" },
    { label: "Extra Large", code: "EL" },
  ],
};

describe("scanPolicyMayUseSku", () => {
  it("is true when GTIN may fall back to SKU", () => {
    expect(scanPolicyMayUseSku("GTIN_THEN_SKU")).toBe(true);
    expect(scanPolicyMayUseSku("SKU")).toBe(true);
    expect(scanPolicyMayUseSku("GTIN")).toBe(false);
  });
});

describe("encodeScanFriendlyAxisSegment", () => {
  it("prefers explicit option codes", () => {
    expect(encodeScanFriendlyAxisSegment("XL", sizeTemplate)).toBe("XL");
    expect(encodeScanFriendlyAxisSegment("Extra Large", sizeTemplate)).toBe("EL");
  });
});

describe("validateScanFriendlySku", () => {
  it("accepts compact alphanumeric SKUs", () => {
    expect(validateScanFriendlySku("V00012301")).toBeNull();
    expect(validateScanFriendlySku("V000123RD1")).toBeNull();
  });

  it("rejects symbolic SKUs", () => {
    expect(validateScanFriendlySku("ITEM-000123-RED")).toMatch(/symbols/i);
  });
});

describe("scanFriendlySkuFieldHint", () => {
  it("mentions barcode fallback when SKU may be scanned", () => {
    const hint = scanFriendlySkuFieldHint("GTIN_THEN_SKU" as ScanIdentifierPolicy);
    expect(hint).toMatch(/barcode/i);
    expect(hint).toMatch(/20/);
    expect(hint).toMatch(/V000123/);
  });
});

describe("compactBaseSkuSegment", () => {
  it("keeps short manual codes intact", () => {
    expect(compactBaseSkuSegment("10014")).toBe("10014");
  });
});

describe("applyScanFriendlySkuPrefix", () => {
  it("prefixes item and variant SKUs", () => {
    expect(applyScanFriendlySkuPrefix("00012301", "item")).toBe("I00012301");
    expect(applyScanFriendlySkuPrefix("00012301", "variant")).toBe("V00012301");
  });

  it("is idempotent when the type prefix is already present", () => {
    expect(applyScanFriendlySkuPrefix("V00012301", "variant")).toBe("V00012301");
    expect(applyScanFriendlySkuPrefix("I000123", "item")).toBe("I000123");
  });

  it("swaps type prefix when kind changes", () => {
    expect(applyScanFriendlySkuPrefix("I00012301", "variant")).toBe("V00012301");
    expect(applyScanFriendlySkuPrefix("V00012301", "item")).toBe("I00012301");
  });
});
