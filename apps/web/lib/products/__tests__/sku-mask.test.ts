import { describe, expect, it } from "vitest";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  composeSkuFromMask,
  resolveEffectiveSkuMask,
  skuMaskCoversAllAxes,
  suggestSkuMask,
} from "@/lib/products/sku-mask";

const manufacturer: AttributeTemplateEntry = {
  key: "manufacturer",
  label: "Manufacturer",
  type: "select",
  options: ["1", "2"],
};

const brand: AttributeTemplateEntry = {
  key: "brand",
  label: "Brand",
  type: "select",
  options: ["A", "B"],
};

describe("sku mask helpers", () => {
  it("builds masks from axis order", () => {
    expect(suggestSkuMask([manufacturer, brand])).toBe("{BASE}-{manufacturer}-{brand}");
  });

  it("detects masks that omit an axis token", () => {
    expect(skuMaskCoversAllAxes("{BASE}-{brand}", [manufacturer, brand])).toBe(false);
    expect(skuMaskCoversAllAxes("{BASE}-{manufacturer}-{brand}", [manufacturer, brand])).toBe(true);
  });

  it("falls back to a full mask when the stored mask is stale", () => {
    expect(resolveEffectiveSkuMask("{BASE}-{brand}", [manufacturer, brand])).toBe(
      "{BASE}-{manufacturer}-{brand}"
    );
  });

  it("composes SKUs with every axis segment", () => {
    const mask = resolveEffectiveSkuMask("{BASE}-{brand}", [manufacturer, brand]);
    expect(
      composeSkuFromMask(mask, "10014", { manufacturer: "1", brand: "A" })
    ).toBe("10014-1-A");
  });
});
