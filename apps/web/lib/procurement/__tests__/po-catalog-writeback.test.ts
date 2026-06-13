import { describe, expect, it } from "vitest";
import {
  buildPoCatalogWritebackRows,
  formatWritebackCatalogValue,
  groupPoCatalogWritebackRows,
  resolveWritebackBulkCheckboxState,
  writebackColumnSelectableIds,
  writebackGroupSelectableIds,
} from "@/lib/procurement/purchase-orders/po-catalog-writeback";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

function line(overrides: Partial<PoDraftLine> & Pick<PoDraftLine, "key">): PoDraftLine {
  return {
    key: overrides.key,
    sku: "",
    variant_id: overrides.variant_id ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    item_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    item_name: "Widget",
    variant_sku: "SKU-1",
    quantity_ordered: "1",
    unit_price_contractual: overrides.unit_price_contractual ?? "10",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    ...overrides,
  };
}

const catalogContext = {
  base_unit_of_measure: "PCS",
  default_purchase_uom: "PCS",
  alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
} as PoDraftLine["catalog_context"];

describe("buildPoCatalogWritebackRows", () => {
  it("skips promotional lines", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "promo",
        unit_price_contractual: "0",
        is_promotional: true,
        writeback_snapshot: {
          catalog_mrp: null,
          catalog_purchase_price: null,
          catalog_supplier_price: null,
          catalog_purchase_uom: null,
        },
        mrp_reference: "100",
      }),
    ]);
    expect(rows).toHaveLength(0);
  });

  it("proposes MRP write-back when PO MRP override differs from catalog snapshot", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        mrp_reference: "125",
        catalog_context: { mrp: "120" } as PoDraftLine["catalog_context"],
        writeback_snapshot: {
          catalog_mrp: "120",
          catalog_purchase_price: "10",
          catalog_supplier_price: "10",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "mrp",
          catalogValue: "120",
          proposedValue: "125",
        }),
      ])
    );
  });

  it("proposes MRP write-back when PO reference MRP differs from catalog snapshot", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        mrp_reference: "120",
        catalog_context: { mrp: null } as PoDraftLine["catalog_context"],
        writeback_snapshot: {
          catalog_mrp: "100",
          catalog_purchase_price: "10",
          catalog_supplier_price: "10",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "mrp",
          catalogValue: "100",
          proposedValue: "120",
        }),
      ])
    );
  });

  it("proposes purchase and supplier price when unit price changed", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        unit_price_contractual: "15",
        writeback_snapshot: {
          catalog_mrp: "100",
          catalog_purchase_price: "10",
          catalog_supplier_price: "10",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "purchase_price", proposedValue: "15" }),
        expect.objectContaining({ field: "supplier_price", proposedValue: "15" }),
      ])
    );
  });

  it("proposes purchase unit when PO UOM differs from catalog default", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        uom_code: "BOX",
        catalog_context: catalogContext,
        writeback_snapshot: {
          catalog_mrp: null,
          catalog_purchase_price: "10",
          catalog_supplier_price: "10",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "purchase_uom",
          catalogValue: "PCS",
          proposedValue: "BOX",
        }),
      ])
    );
  });

  it("skips purchase unit when PO UOM is not in item options", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        uom_code: "PALLET",
        catalog_context: catalogContext,
        writeback_snapshot: {
          catalog_mrp: null,
          catalog_purchase_price: "10",
          catalog_supplier_price: "10",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);

    expect(rows.some((row) => row.field === "purchase_uom")).toBe(false);
  });

  it("returns no rows when PO values match catalog snapshot", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        unit_price_contractual: "10",
        uom_code: "PCS",
        catalog_context: { mrp: "100" } as PoDraftLine["catalog_context"],
        writeback_snapshot: {
          catalog_mrp: "100",
          catalog_purchase_price: "10",
          catalog_supplier_price: "10",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);
    expect(rows).toHaveLength(0);
  });
});

describe("formatWritebackCatalogValue", () => {
  it("renders em dash for blank catalog values", () => {
    expect(formatWritebackCatalogValue(null)).toBe("—");
    expect(formatWritebackCatalogValue("")).toBe("—");
  });
});

describe("groupPoCatalogWritebackRows", () => {
  it("groups field deltas under one item header per PO line", () => {
    const rows = buildPoCatalogWritebackRows([
      line({
        key: "paid",
        unit_price_contractual: "15",
        mrp_reference: "120",
        catalog_context: { mrp: null } as PoDraftLine["catalog_context"],
        writeback_snapshot: {
          catalog_mrp: "100",
          catalog_purchase_price: "10",
          catalog_supplier_price: "800",
          catalog_purchase_uom: "PCS",
        },
      }),
    ]);

    const groups = groupPoCatalogWritebackRows(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.itemName).toBe("Widget");
    expect(groups[0]?.variantSku).toBe("SKU-1");
    expect(groups[0]?.fields.mrp?.proposedValue).toBe("120");
    expect(groups[0]?.fields.purchase_price?.proposedValue).toBe("15");
    expect(groups[0]?.fields.supplier_price?.proposedValue).toBe("15");
  });
});

describe("writeback bulk selection helpers", () => {
  it("resolves indeterminate column state", () => {
    const groups = groupPoCatalogWritebackRows([
      {
        id: "paid:mrp",
        lineKey: "paid",
        itemId: "item",
        variantId: "variant",
        itemName: "Widget",
        variantSku: "SKU-1",
        field: "mrp",
        fieldLabel: "MRP",
        catalogValue: "1",
        proposedValue: "2",
      },
      {
        id: "paid:purchase_price",
        lineKey: "paid",
        itemId: "item",
        variantId: "variant",
        itemName: "Widget",
        variantSku: "SKU-1",
        field: "purchase_price",
        fieldLabel: "Purchase price",
        catalogValue: "1",
        proposedValue: "2",
      },
    ]);

    const columnIds = writebackColumnSelectableIds(groups, "mrp");
    const selected = new Set([columnIds[0]!]);
    expect(resolveWritebackBulkCheckboxState(columnIds, selected)).toBe(true);
    expect(resolveWritebackBulkCheckboxState(writebackGroupSelectableIds(groups[0]!), selected)).toBe(
      "indeterminate"
    );
  });
});
