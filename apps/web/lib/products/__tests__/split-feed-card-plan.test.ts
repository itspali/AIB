import { describe, expect, it } from "vitest";
import {
  buildSplitFeedCardPlan,
  withPinnedVisibleColumns,
  withoutItemsWorkspaceDisabledColumns,
} from "@/lib/items/split-feed-card-plan";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";

function sampleRow(partial: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "item-1",
    name: "Widget",
    description: "A widget",
    image_url: null,
    classification: "PHYSICAL_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: "Apparel",
    hsn_sac_code: "1234",
    has_variants: false,
    default_tax_category: "TAXABLE",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: false,
    default_variant_id: null,
    default_sku: "WGT-001",
    barcode: "8900001",
    selling_price: "1200",
    mrp: "1500",
    purchase_price: "800",
    supplier_name: "Acme",
    stock_on_hand: "42",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...partial,
  };
}

describe("withPinnedVisibleColumns", () => {
  it("keeps sku and name visible even when omitted from prefs", () => {
    const columns: ProductListColumnId[] = ["selling_price", "is_active"];
    const order: ProductListColumnId[] = [
      "name",
      "default_sku",
      "selling_price",
      "is_active",
    ];

    expect(withPinnedVisibleColumns(columns, order)).toEqual([
      "name",
      "default_sku",
      "selling_price",
      "is_active",
    ]);
  });
});

describe("buildSplitFeedCardPlan", () => {
  function metaTexts(plan: ReturnType<typeof buildSplitFeedCardPlan>) {
    return plan.metaSegments.map((segment) => segment.text);
  }

  it("always renders pinned sku and name", () => {
    const plan = buildSplitFeedCardPlan(["selling_price"], sampleRow(), false);

    expect(plan.sku).toBe("WGT-001");
    expect(plan.name).toBe("Widget");
    expect(plan.showImage).toBe(false);
  });

  it("shows image when image column is visible", () => {
    const plan = buildSplitFeedCardPlan(
      ["default_sku", "name", "image"],
      sampleRow({ image_url: "https://example.com/item.jpg" }),
      false
    );

    expect(plan.showImage).toBe(true);
  });

  it("uses first visible top-right candidate in priority order", () => {
    const columns: ProductListColumnId[] = [
      "default_sku",
      "name",
      "stock_on_hand",
      "selling_price",
    ];
    const plan = buildSplitFeedCardPlan(columns, sampleRow(), false);

    expect(plan.topRightValue).toBe("₹1,200.00");
    expect(metaTexts(plan)).toContain("42");
    expect(metaTexts(plan)).not.toContain("₹1,200.00");
  });

  it("formats purchasable and salable as meta flags when visible", () => {
    const columns: ProductListColumnId[] = [
      "default_sku",
      "name",
      "is_purchasable",
      "is_salable",
    ];
    const plan = buildSplitFeedCardPlan(columns, sampleRow(), false);

    expect(metaTexts(plan)).toContain("✓ Purchasable");
    expect(metaTexts(plan)).toContain("✓ Salable");
    expect(plan.metaSegments.find((segment) => segment.text === "✓ Purchasable")?.flagEnabled).toBe(
      true
    );
  });

  it("shows returnable as a name-row icon when column is visible", () => {
    const columns: ProductListColumnId[] = [
      "default_sku",
      "name",
      "is_returnable",
      "is_purchasable",
    ];
    const plan = buildSplitFeedCardPlan(columns, sampleRow(), false);

    expect(metaTexts(plan)).not.toContain("— Returnable");
    expect(metaTexts(plan)).toContain("✓ Purchasable");
    expect(plan.capabilityIcons).toEqual([
      {
        columnId: "is_returnable",
        enabled: false,
        label: "Returnable",
        tooltip: "Not returnable",
      },
    ]);
  });

  it("omits capability icons when columns are hidden", () => {
    const plan = buildSplitFeedCardPlan(
      ["default_sku", "name", "is_purchasable"],
      sampleRow({ has_variants: true, is_returnable: true }),
      false
    );

    expect(plan.capabilityIcons).toEqual([]);
  });

  it("shows has variants icon with count tooltip when column is visible", () => {
    const plan = buildSplitFeedCardPlan(
      ["default_sku", "name", "has_variants"],
      sampleRow({ has_variants: true, sellable_variant_count: 3 }),
      false
    );

    expect(metaTexts(plan)).not.toContain("✓ Has variants");
    expect(plan.capabilityIcons).toEqual([
      {
        columnId: "has_variants",
        enabled: true,
        label: "Has variants",
        tooltip: "3 variants",
      },
    ]);
  });

  it("caps meta segments at five fields", () => {
    const columns: ProductListColumnId[] = [
      "default_sku",
      "name",
      "category_name",
      "is_active",
      "classification",
      "barcode",
      "supplier_name",
      "hsn_sac_code",
    ];
    const plan = buildSplitFeedCardPlan(columns, sampleRow(), false);

    expect(plan.metaSegments).toHaveLength(5);
  });

  it("omits status from split-feed meta even when column is listed", () => {
    const columns: ProductListColumnId[] = ["default_sku", "name", "is_active", "category_name"];
    const plan = buildSplitFeedCardPlan(
      columns,
      sampleRow({
        variant_id: "var-1",
        variant_is_active: false,
        is_active: false,
      }),
      true
    );

    expect(metaTexts(plan)).not.toContain("Inactive");
    expect(metaTexts(plan)).not.toContain("Variant inactive");
    expect(metaTexts(plan)).toContain("Apparel");
  });
});

describe("withoutItemsWorkspaceDisabledColumns", () => {
  it("removes disabled workspace columns", () => {
    expect(
      withoutItemsWorkspaceDisabledColumns([
        "default_sku",
        "name",
        "is_active",
        "category_name",
      ])
    ).toEqual(["default_sku", "name", "category_name"]);
  });
});
