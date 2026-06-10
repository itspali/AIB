import { describe, expect, it } from "vitest";
import {
  mapSalesTaxModeToPoSupplyNature,
  poTaxSupplyNatureLabel,
  resolvePoTaxSupplyNature,
} from "@/lib/procurement/purchase-orders/po-tax-supply";

describe("po tax supply nature", () => {
  it("labels intrastate and interstate for UI", () => {
    expect(poTaxSupplyNatureLabel("INTRASTATE")).toBe("Intrastate");
    expect(poTaxSupplyNatureLabel("INTERSTATE")).toBe("Interstate");
  });

  it("resolves intrastate when supplier and destination states match", () => {
    expect(resolvePoTaxSupplyNature("MH", "mh")).toBe("INTRASTATE");
  });

  it("resolves interstate when states differ or are missing", () => {
    expect(resolvePoTaxSupplyNature("MH", "DL")).toBe("INTERSTATE");
    expect(resolvePoTaxSupplyNature("", "DL")).toBe("INTERSTATE");
  });

  it("maps sales tax mode tokens to PO supply nature", () => {
    expect(mapSalesTaxModeToPoSupplyNature("CGST_SGST")).toBe("INTRASTATE");
    expect(mapSalesTaxModeToPoSupplyNature("IGST")).toBe("INTERSTATE");
  });
});
