import { describe, expect, it } from "vitest";
import { DEFAULT_PO_SCREEN_LAYOUT } from "@/lib/documents/purchase-order-layout";
import {
  applyGstRegisteredDocumentLayoutOverrides,
  HSN_CATALOG_FIELD_ID,
  isGstMandatoryCatalogFieldId,
} from "@/lib/documents/gst-document-layout-compliance";
import { DEFAULT_SALES_ORDER_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";

describe("applyGstRegisteredDocumentLayoutOverrides", () => {
  it("forces HSN/SAC visible for procurement layouts", () => {
    const next = applyGstRegisteredDocumentLayoutOverrides(DEFAULT_PO_SCREEN_LAYOUT, true);
    const hsn = next.columns.find((column) => column.id === HSN_CATALOG_FIELD_ID);
    expect(hsn?.defaultVisible).toBe(true);
    expect(next.catalogLineFieldOrder).toContain(HSN_CATALOG_FIELD_ID);
  });

  it("forces HSN/SAC visible for sales layouts", () => {
    const next = applyGstRegisteredDocumentLayoutOverrides(DEFAULT_SALES_ORDER_SCREEN_LAYOUT, true);
    const hsn = next.columns.find((column) => column.id === HSN_CATALOG_FIELD_ID);
    expect(hsn?.defaultVisible).toBe(true);
    expect(next.catalogLineFieldOrder).toContain(HSN_CATALOG_FIELD_ID);
  });

  it("leaves layout unchanged when not GST registered", () => {
    const next = applyGstRegisteredDocumentLayoutOverrides(DEFAULT_PO_SCREEN_LAYOUT, false);
    expect(next).toEqual(DEFAULT_PO_SCREEN_LAYOUT);
  });
});

describe("isGstMandatoryCatalogFieldId", () => {
  it("returns true only for HSN when GST registered", () => {
    expect(isGstMandatoryCatalogFieldId(HSN_CATALOG_FIELD_ID, true)).toBe(true);
    expect(isGstMandatoryCatalogFieldId(HSN_CATALOG_FIELD_ID, false)).toBe(false);
    expect(isGstMandatoryCatalogFieldId("item", true)).toBe(false);
  });
});
