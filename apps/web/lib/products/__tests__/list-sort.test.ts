import { describe, expect, it } from "vitest";
import { sortProductListRows, toggleColumnSort } from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";

function row(partial: Partial<ProductListRow> & Pick<ProductListRow, "id" | "name">): ProductListRow {
  return {
    description: null,
    image_url: null,
    classification: "PHYSICAL_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: null,
    hsn_sac_code: null,
    has_variants: false,
    default_tax_category: "STANDARD",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: false,
    default_variant_id: null,
    default_sku: null,
    barcode: null,
    selling_price: null,
    purchase_price: null,
    supplier_name: null,
    stock_on_hand: "0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("sortProductListRows", () => {
  it("sorts by name ascending with null sku names as tie-breaker", () => {
    const rows = [
      row({ id: "2", name: "Zeta" }),
      row({ id: "1", name: "Alpha" }),
    ];

    expect(sortProductListRows(rows, "name", "asc").map((entry) => entry.name)).toEqual([
      "Alpha",
      "Zeta",
    ]);
  });

  it("sorts numeric prices with empty values last", () => {
    const rows = [
      row({ id: "1", name: "A", selling_price: "100" }),
      row({ id: "2", name: "B", selling_price: "20" }),
      row({ id: "3", name: "C", selling_price: null }),
    ];

    expect(
      sortProductListRows(rows, "selling_price", "asc").map((entry) => entry.selling_price)
    ).toEqual(["20", "100", null]);
  });

  it("sorts updated_at newest first", () => {
    const rows = [
      row({ id: "1", name: "Old", updated_at: "2026-01-01T00:00:00.000Z" }),
      row({ id: "2", name: "New", updated_at: "2026-05-01T00:00:00.000Z" }),
    ];

    expect(sortProductListRows(rows, "updated_at", "desc").map((entry) => entry.name)).toEqual([
      "New",
      "Old",
    ]);
  });

  it("secondary-sorts by sku when showVariants is enabled", () => {
    const rows = [
      row({
        id: "1",
        name: "Shirt",
        default_sku: "SKU-Z",
        variant_id: "v2",
      }),
      row({
        id: "1",
        name: "Shirt",
        default_sku: "SKU-A",
        variant_id: "v1",
      }),
    ];

    expect(
      sortProductListRows(rows, "name", "asc", { showVariants: true }).map(
        (entry) => entry.default_sku
      )
    ).toEqual(["SKU-A", "SKU-Z"]);
  });
});

describe("toggleColumnSort", () => {
  it("starts a new column with its preferred initial direction", () => {
    expect(toggleColumnSort("updated_at", "name", "asc")).toEqual({
      field: "updated_at",
      direction: "desc",
    });
    expect(toggleColumnSort("name", "updated_at", "desc")).toEqual({
      field: "name",
      direction: "asc",
    });
  });

  it("toggles direction when clicking the active sort column", () => {
    expect(toggleColumnSort("name", "name", "asc")).toEqual({
      field: "name",
      direction: "desc",
    });
    expect(toggleColumnSort("name", "name", "desc")).toEqual({
      field: "name",
      direction: "asc",
    });
  });
});
