import { describe, expect, it } from "vitest";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { emptyPoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  applyGstRegisteredPoLayoutOverrides,
  isOrganizationGstRegistered,
  patchPoLineHsnSacCode,
  validatePoGstComplianceLines,
  hasPoLineGstTaxConfigured,
  PO_HSN_CATALOG_FIELD_ID,
} from "@/lib/procurement/purchase-orders/po-gst-compliance";
import { DEFAULT_PO_SCREEN_LAYOUT } from "@/lib/documents/purchase-order-layout";

function line(overrides: Partial<PoDraftLine> & Pick<PoDraftLine, "key">): PoDraftLine {
  return {
    sku: "",
    variant_id: overrides.variant_id ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    item_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    item_name: "Widget",
    variant_sku: "SKU-1",
    quantity_ordered: "1",
    unit_price_contractual: "10",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    catalog_context: {
      ...emptyPoLineCatalogContext(),
      base_unit_of_measure: "PCS",
    },
    ...overrides,
  };
}

describe("isOrganizationGstRegistered", () => {
  it("returns true for Indian org with valid GSTIN", () => {
    expect(
      isOrganizationGstRegistered({
        country_code: "IN",
        tax_identifier: "27AABCA1234A1Z5",
      })
    ).toBe(true);
  });

  it("returns false without GSTIN or outside India", () => {
    expect(
      isOrganizationGstRegistered({
        country_code: "IN",
        tax_identifier: null,
      })
    ).toBe(false);
    expect(
      isOrganizationGstRegistered({
        country_code: "US",
        tax_identifier: "27AABCA1234A1Z5",
      })
    ).toBe(false);
  });
});

describe("applyGstRegisteredPoLayoutOverrides", () => {
  it("forces HSN/SAC visible in catalog line fields", () => {
    const next = applyGstRegisteredPoLayoutOverrides(DEFAULT_PO_SCREEN_LAYOUT, true);
    const hsn = next.columns.find((column) => column.id === PO_HSN_CATALOG_FIELD_ID);
    expect(hsn?.defaultVisible).toBe(true);
    expect(next.catalogLineFieldOrder).toContain(PO_HSN_CATALOG_FIELD_ID);
  });
});

describe("validatePoGstComplianceLines", () => {
  it("requires HSN on paid lines for GST registered orgs", () => {
    expect(
      validatePoGstComplianceLines(
        [line({ key: "1", catalog_context: { ...line({ key: "x" }).catalog_context!, hsn_sac_code: null } })],
        true
      )
    ).toMatch(/HSN\/SAC is required/);
  });

  it("requires GST tax % when HSN is present", () => {
    expect(
      validatePoGstComplianceLines(
        [
          line({
            key: "1",
            catalog_context: {
              ...line({ key: "x" }).catalog_context!,
              hsn_sac_code: "8471",
              tax_code_id: null,
              tax_rate: 0,
            },
          }),
        ],
        true
      )
    ).toMatch(/GST tax % is required/);
  });

  it("passes when HSN and tax rule are configured", () => {
    expect(
      validatePoGstComplianceLines(
        [
          line({
            key: "1",
            catalog_context: {
              ...line({ key: "x" }).catalog_context!,
              hsn_sac_code: "8471",
              tax_code_id: "tax-18",
              tax_rate: 18,
            },
          }),
        ],
        true
      )
    ).toBeNull();
  });

  it("skips GST tax validation on import supply", () => {
    expect(
      validatePoGstComplianceLines(
        [
          line({
            key: "1",
            catalog_context: {
              ...line({ key: "x" }).catalog_context!,
              hsn_sac_code: "8471",
              tax_code_id: null,
              tax_rate: 0,
            },
          }),
        ],
        true,
        { supplyNature: "IMPORT_GOODS" }
      )
    ).toBeNull();
  });

  it("skips promotional lines", () => {
    expect(
      validatePoGstComplianceLines(
        [line({ key: "1", unit_price_contractual: "0", is_promotional: true })],
        true
      )
    ).toBeNull();
  });
});

describe("hasPoLineGstTaxConfigured", () => {
  it("accepts tax code id or positive catalog rate", () => {
    expect(
      hasPoLineGstTaxConfigured(
        line({
          key: "1",
          catalog_context: { ...line({ key: "x" }).catalog_context!, tax_code_id: "tax-5", tax_rate: 5 },
        })
      )
    ).toBe(true);
    expect(
      hasPoLineGstTaxConfigured(
        line({
          key: "1",
          catalog_context: { ...line({ key: "x" }).catalog_context!, tax_code_id: null, tax_rate: 12 },
        })
      )
    ).toBe(true);
    expect(hasPoLineGstTaxConfigured(line({ key: "1" }))).toBe(false);
  });
});

describe("patchPoLineHsnSacCode", () => {
  it("updates catalog context HSN", () => {
    const draft = line({ key: "1" });
    expect(patchPoLineHsnSacCode(draft, "8471")).toEqual({
      catalog_context: {
        ...draft.catalog_context!,
        hsn_sac_code: "8471",
      },
    });
  });
});
