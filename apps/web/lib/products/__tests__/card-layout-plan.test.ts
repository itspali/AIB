import { describe, expect, it } from "vitest";
import { buildCardLayoutPlan, CARD_CONTEXT_SEGMENT_CAP } from "@/lib/products/card-layout-plan";
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
    purchase_price: "800",
    supplier_name: "Acme",
    stock_on_hand: "42",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...partial,
  };
}

const essentials: ProductListColumnId[] = ["name", "default_sku", "is_active"];

describe("buildCardLayoutPlan", () => {
  it("builds essentials-only plan without lower regions", () => {
    const plan = buildCardLayoutPlan(essentials, sampleRow(), false);

    expect(plan.hero.showTitle).toBe(true);
    expect(plan.hero.contextSegments).toEqual([]);
    expect(plan.footerRail).toEqual([]);
    expect(plan.regions.heroSku).toBe(true);
    expect(plan.hero.heroSkuLabel).toBe("WGT-001");
    expect(plan.regions.footerRail).toBe(false);
    expect(plan.regions.metrics).toBe(false);
    expect(plan.regions.details).toBe(false);
    expect(plan.regions.flags).toBe(false);
    expect(plan.regions.meta).toBe(false);
    expect(plan.chrome.showStatus).toBe(true);
  });

  it("caps hero context segments and reports overflow", () => {
    const columns: ProductListColumnId[] = [
      "default_sku",
      "category_name",
      "classification",
      "barcode",
    ];
    const plan = buildCardLayoutPlan(columns, sampleRow(), false);

    expect(plan.regions.heroSku).toBe(true);
    expect(plan.hero.heroSkuLabel).toBe("WGT-001");
    expect(plan.hero.contextSegments).toEqual([{ text: "8900001", mono: false }]);
    expect(plan.hero.contextOverflowCount).toBe(0);
    expect(plan.footerRail.map((item) => item.columnId)).toEqual(["category_name"]);
  });

  it("places stock and prices in metrics region", () => {
    const columns: ProductListColumnId[] = [
      "name",
      "stock_on_hand",
      "selling_price",
      "purchase_price",
    ];
    const plan = buildCardLayoutPlan(columns, sampleRow(), false);

    expect(plan.metrics.map((m) => m.columnId)).toEqual([
      "stock_on_hand",
      "selling_price",
      "purchase_price",
    ]);
    expect(plan.regions.metrics).toBe(true);
  });

  it("caps detail rows and moves extras to overflow", () => {
    const columns: ProductListColumnId[] = [
      "base_unit_of_measure",
      "hsn_sac_code",
      "default_tax_category",
    ];
    const plan = buildCardLayoutPlan(columns, sampleRow(), false);

    expect(plan.details).toHaveLength(3);
    expect(plan.detailOverflow).toHaveLength(0);
  });

  it("omits context strip for expanded variant rows and uses variant SKU line", () => {
    const plan = buildCardLayoutPlan(
      ["name", "default_sku", "category_name"],
      sampleRow({
        has_variants: true,
        variant_strategy: "MULTI_SKU",
        variant_id: "var-1",
        variant_attributes: { size: "M" },
        default_sku: "WGT-001-M",
      }),
      true
    );

    expect(plan.regions.heroContext).toBe(false);
    expect(plan.hero.variantSkuLine).toBe("WGT-001-M");
    expect(plan.hero.attributeSubline).toMatch(/size:\s*M/i);
  });

  it("builds shop pricing block from visible columns", () => {
    const plan = buildCardLayoutPlan(
      ["name", "category_name", "selling_price", "purchase_price", "stock_on_hand", "default_sku"],
      sampleRow(),
      false
    );

    expect(plan.shop.sellingPrice).toBeTruthy();
    expect(plan.shop.comparePrice).toBeTruthy();
    expect(plan.shop.stockStatus).toBe("in_stock");
    expect(plan.shop.category).toBe("Apparel");
  });

  it("marks shop stock low when below_reorder is set from list view", () => {
    const plan = buildCardLayoutPlan(
      ["name", "stock_on_hand"],
      sampleRow({ stock_on_hand: "42", below_reorder: true }),
      false
    );

    expect(plan.shop.stockStatus).toBe("low_stock");
  });

  it("marks shop stock low from reorder point when below_reorder is absent", () => {
    const plan = buildCardLayoutPlan(
      ["name", "stock_on_hand"],
      sampleRow({ stock_on_hand: "4", reorder_point: "10" }),
      false
    );

    expect(plan.shop.stockStatus).toBe("low_stock");
  });
});
