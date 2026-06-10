import { describe, expect, it } from "vitest";
import { DEFAULT_PO_SCREEN_LAYOUT } from "@/lib/documents/purchase-order-layout";
import {
  isPoUnitLineFieldVisible,
  resolvePoDraftLineUnitCode,
  resolvePoPeekLineUnitCode,
  shouldShowPoUnitUnderQtyColumn,
} from "@/lib/procurement/purchase-orders/po-line-unit";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

const draftLine: PoDraftLine = {
  key: "line-1",
  sku: "SKU-1",
  variant_id: "variant-1",
  item_id: "item-1",
  item_name: "Widget",
  variant_sku: "SKU-1",
  quantity_ordered: "2",
  unit_price_contractual: "10",
  discount_percentage: "0",
  discount_amount: "0",
  skuError: null,
  catalog_context: {
    description: null,
    hsn_sac_code: null,
    base_unit_of_measure: "EA",
    image_url: null,
    tax_code_id: null,
    tax_rate: 0,
    tax_is_variable: false,
    default_purchase_uom: null,
    alternate_uoms: [],
    custom_fields: {},
    variant_attributes: {},
    attribute_labels: {},
    catalog_snapshot_source: "server",
  },
};

const peekLine: PurchaseOrderLineRow = {
  id: "line-1",
  item_id: "item-1",
  item_name: "Widget",
  variant_id: "variant-1",
  variant_sku: "SKU-1",
  quantity_ordered: "2",
  quantity_received: "0",
  unit_price_contractual: "10",
  discount_percentage: "0",
  discount_amount: "0",
  tax_rate_percentage: "0",
  line_tax_amount: "0",
  tax_components: [],
  line_total_gross: "20",
  open_quantity: "2",
  uom_code: "BOX",
  uom_conversion_factor: "12",
  base_unit_of_measure: "KG",
};

describe("po-line-unit layout auto placement", () => {
  it("shows unit under qty when Unit line field is off", () => {
    expect(isPoUnitLineFieldVisible(DEFAULT_PO_SCREEN_LAYOUT)).toBe(false);
    expect(shouldShowPoUnitUnderQtyColumn(DEFAULT_PO_SCREEN_LAYOUT)).toBe(true);
  });

  it("hides unit under qty when Unit line field is on", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "unit" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(isPoUnitLineFieldVisible(layout)).toBe(true);
    expect(shouldShowPoUnitUnderQtyColumn(layout)).toBe(false);
  });
});

describe("po-line-unit resolution", () => {
  it("resolves draft unit from catalog context", () => {
    expect(resolvePoDraftLineUnitCode(draftLine)).toBe("EA");
  });

  it("resolves peek unit from saved line uom", () => {
    expect(resolvePoPeekLineUnitCode(peekLine)).toBe("BOX");
  });
});
