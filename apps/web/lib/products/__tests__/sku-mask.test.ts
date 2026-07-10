import { describe, expect, it } from "vitest";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  composeSkuFromMask,
  estimateSkuBudget,
  parseSkuMaskAxisKeys,
  reconcileSkuMaskWithVariantAxes,
  resolveEffectiveSkuMask,
  skuMaskCoversAllAxes,
  suggestSkuMask,
  suggestSkuMaskFromAxisKeys,
} from "@/lib/products/sku-mask";
import {
  compactBaseSkuSegment,
  encodeScanFriendlyAxisSegment,
  validateScanFriendlySku,
} from "@/lib/products/scan-friendly-sku";

const manufacturer: AttributeTemplateEntry = {
  key: "manufacturer",
  label: "Manufacturer",
  type: "select",
  options: [
    { label: "1", code: "1" },
    { label: "2", code: "2" },
  ],
};

const brand: AttributeTemplateEntry = {
  key: "brand",
  label: "Brand",
  type: "select",
  options: [
    { label: "A", code: "A" },
    { label: "B", code: "B" },
  ],
};

const color: AttributeTemplateEntry = {
  key: "color",
  label: "Color",
  type: "select",
  options: [
    { label: "Red", code: "RD" },
    { label: "Blue", code: "BL" },
    { label: "Extra Large", code: "XL" },
  ],
};

const ram: AttributeTemplateEntry = {
  key: "ram",
  label: "RAM",
  type: "select",
  options: [
    { label: "8GB", code: "8G" },
    { label: "16GB", code: "16G" },
  ],
};

const storage: AttributeTemplateEntry = {
  key: "storage",
  label: "Storage",
  type: "select",
  options: [
    { label: "128GB", code: "128G" },
    { label: "256GB", code: "256G" },
  ],
};

describe("sku mask helpers", () => {
  it("builds compact scan-friendly masks from axis order", () => {
    expect(suggestSkuMask([manufacturer, brand])).toBe("{BASE}{manufacturer}{brand}");
  });

  it("detects masks that omit an axis token", () => {
    expect(skuMaskCoversAllAxes("{BASE}{brand}", [manufacturer, brand])).toBe(false);
    expect(skuMaskCoversAllAxes("{BASE}{manufacturer}{brand}", [manufacturer, brand])).toBe(
      true
    );
  });

  it("keeps intentional subset masks instead of forcing full cover", () => {
    expect(resolveEffectiveSkuMask("{BASE}{brand}", [manufacturer, brand])).toBe(
      "{BASE}{brand}"
    );
  });

  it("strips unknown axes from a stored mask", () => {
    expect(
      resolveEffectiveSkuMask("{BASE}{brand}{gone}", [manufacturer, brand])
    ).toBe("{BASE}{brand}");
  });

  it("composes compact SKUs without separators", () => {
    const mask = resolveEffectiveSkuMask("{BASE}{brand}", [manufacturer, brand]);
    expect(
      composeSkuFromMask(mask, "ITEM-000123", { manufacturer: "1", brand: "A" }, {
        axisTemplates: [manufacturer, brand],
      })
    ).toBe("V000123A");
  });

  it("uses explicit option codes for long select labels", () => {
    expect(
      composeSkuFromMask("{BASE}{color}", "000123", { color: "Extra Large" }, {
        axisTemplates: [color],
      })
    ).toBe("V000123XL");
  });

  it("keeps a single V prefix when re-composed", () => {
    expect(
      composeSkuFromMask("{BASE}{brand}", "V000123", { brand: "A" }, {
        axisTemplates: [brand],
      })
    ).toBe("V000123A");
  });

  it("composes a subset mask while attributes include extra axes", () => {
    const mask = suggestSkuMaskFromAxisKeys(["color", "ram", "storage"]);
    expect(
      composeSkuFromMask(
        mask,
        "ITEM-000123",
        { brand: "A", color: "Red", ram: "8GB", storage: "128GB" },
        { axisTemplates: [brand, color, ram, storage] }
      )
    ).toBe("V000123RD8G128G");
  });

  it("reconciles mask when axes are removed", () => {
    expect(
      reconcileSkuMaskWithVariantAxes(
        "{BASE}{color}{ram}{storage}",
        ["color", "ram", "storage"],
        ["color", "storage"]
      )
    ).toBe("{BASE}{color}{storage}");
  });

  it("defaults empty mask to all next axes", () => {
    expect(reconcileSkuMaskWithVariantAxes("", [], ["color", "ram"])).toBe(
      "{BASE}{color}{ram}"
    );
  });

  it("parses mask axis keys", () => {
    expect(parseSkuMaskAxisKeys("{BASE}{color}{ram}")).toEqual(["color", "ram"]);
  });

  it("estimates SKU length budget", () => {
    const budget = estimateSkuBudget(
      "{BASE}{color}{ram}{storage}",
      "ITEM-000123",
      [color, ram, storage]
    );
    expect(budget.estimatedLength).toBe(1 + 6 + 2 + 3 + 4);
    expect(budget.exceedsMax).toBe(false);
  });
});

describe("scan-friendly segment helpers", () => {
  it("extracts numeric base segments from auto-generated product codes", () => {
    expect(compactBaseSkuSegment("ITEM-000123")).toBe("000123");
  });

  it("abbreviates multi-word axis values without a template", () => {
    expect(encodeScanFriendlyAxisSegment("Extra Large")).toBe("EL");
  });

  it("prefers explicit option codes from the template", () => {
    expect(encodeScanFriendlyAxisSegment("Black", {
      key: "color",
      label: "Color",
      type: "select",
      options: [{ label: "Black", code: "BLK" }],
    })).toBe("BLK");
  });

  it("rejects SKUs that are too long for small barcode stickers", () => {
    expect(validateScanFriendlySku("ABCDEFGHIJ12345678901")).toMatch(/20 or fewer/);
    expect(validateScanFriendlySku("V00012301")).toBeNull();
  });
});
