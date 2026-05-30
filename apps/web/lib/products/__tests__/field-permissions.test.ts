import { describe, expect, it } from "vitest";
import {
  getDefaultFieldAccess,
  mergeProductFieldPermissions,
  parseTenantProductFieldsAccess,
  redactProductListRow,
} from "@/lib/products/field-permissions";
import type { ProductListRow } from "@/lib/products/types";

function sampleRow(): ProductListRow {
  return {
    id: "item-1",
    name: "Widget",
    description: "A widget",
    image_url: "https://example.com/widget.jpg",
    classification: "PHYSICAL_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: "Hardware",
    hsn_sac_code: "1234",
    has_variants: false,
    default_tax_category: "STANDARD",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: false,
    default_variant_id: null,
    default_sku: "WGT-001",
    barcode: "123456789",
    selling_price: "99.00",
    purchase_price: "50.00",
    supplier_name: "Acme Supply",
    stock_on_hand: "0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  };
}

describe("product field permissions", () => {
  it("denies financial and supplier fields for STAFF by default", () => {
    expect(getDefaultFieldAccess("STAFF", "purchase_price")).toBe(false);
    expect(getDefaultFieldAccess("STAFF", "selling_price")).toBe(false);
    expect(getDefaultFieldAccess("STAFF", "supplier_name")).toBe(false);
    expect(getDefaultFieldAccess("STAFF", "name")).toBe(true);
    expect(getDefaultFieldAccess("MANAGER", "purchase_price")).toBe(true);
  });

  it("merges tenant overrides on top of role defaults", () => {
    const tenantOverride = parseTenantProductFieldsAccess({
      STAFF: { name: false, purchase_price: true },
      MANAGER: { supplier_name: false },
    });

    const staff = mergeProductFieldPermissions("STAFF", tenantOverride);
    expect(staff.allowedFields).toContain("purchase_price");
    expect(staff.allowedFields).not.toContain("name");
    expect(staff.allowedFields).not.toContain("selling_price");

    const manager = mergeProductFieldPermissions("MANAGER", tenantOverride);
    expect(manager.allowedFields).not.toContain("supplier_name");
    expect(manager.allowedFields).toContain("purchase_price");
  });

  it("redacts restricted row fields", () => {
    const redacted = redactProductListRow(sampleRow(), [
      "name",
      "default_sku",
      "category_name",
    ]);

    expect(redacted.name).toBe("Widget");
    expect(redacted.default_sku).toBe("WGT-001");
    expect(redacted.purchase_price).toBeNull();
    expect(redacted.selling_price).toBeNull();
    expect(redacted.supplier_name).toBeNull();
    expect(redacted.image_url).toBeNull();
  });
});
