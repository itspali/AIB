import { describe, expect, it } from "vitest";
import {
  isProductCardColumnApplicable,
  productCardColumnDisabledReason,
} from "@/lib/products/card-column-applicability";

describe("isProductCardColumnApplicable", () => {
  it("allows vertical detail metrics and meta columns", () => {
    expect(isProductCardColumnApplicable("selling_price", "v2", "vertical")).toBe(true);
    expect(isProductCardColumnApplicable("created_at", "v2", "vertical")).toBe(true);
  });

  it("disables classification on all card layouts", () => {
    expect(isProductCardColumnApplicable("classification", "v2", "vertical")).toBe(false);
    expect(isProductCardColumnApplicable("classification", "v2", "horizontal")).toBe(false);
    expect(isProductCardColumnApplicable("classification", "shop", "vertical")).toBe(false);
  });

  it("disables vertical-only columns on horizontal detail cards", () => {
    expect(isProductCardColumnApplicable("selling_price", "v2", "horizontal")).toBe(false);
    expect(isProductCardColumnApplicable("hsn_sac_code", "v2", "horizontal")).toBe(false);
    expect(isProductCardColumnApplicable("default_sku", "v2", "horizontal")).toBe(true);
  });

  it("disables barcode on shop cards", () => {
    expect(isProductCardColumnApplicable("barcode", "shop", "vertical")).toBe(false);
    expect(isProductCardColumnApplicable("category_name", "shop", "vertical")).toBe(true);
  });
});

describe("productCardColumnDisabledReason", () => {
  it("returns a reason for disabled columns", () => {
    expect(productCardColumnDisabledReason("classification", "v2", "vertical")).toMatch(
      /classification/i
    );
    expect(productCardColumnDisabledReason("selling_price", "v2", "horizontal")).toMatch(
      /horizontal/i
    );
  });
});
