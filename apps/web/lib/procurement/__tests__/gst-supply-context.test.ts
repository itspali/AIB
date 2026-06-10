import { describe, expect, it } from "vitest";
import {
  gstIsOverseasParty,
  gstResolveSupplyContext,
  shouldZeroVendorGstOnPo,
} from "@/lib/tax/gst-supply-context";

describe("gst supply context", () => {
  it("detects overseas parties", () => {
    expect(gstIsOverseasParty("OVERSEAS_EXPORT", "US")).toBe(true);
    expect(gstIsOverseasParty("REGULAR_B2B", "US")).toBe(true);
    expect(gstIsOverseasParty("REGULAR_B2B", "IN")).toBe(false);
  });

  it("resolves import goods for overseas supplier in India tenant", () => {
    const ctx = gstResolveSupplyContext({
      tenantCountry: "IN",
      partyTaxTreatment: "OVERSEAS_EXPORT",
      partyCountry: "US",
      partyState: null,
      destinationState: "MH",
      documentSide: "PURCHASE",
      supplyKind: "GOODS",
    });
    expect(ctx.supplyNature).toBe("IMPORT_GOODS");
    expect(ctx.taxMechanism).toBe("IMPORT_IGST");
    expect(shouldZeroVendorGstOnPo(ctx.taxMechanism)).toBe(true);
  });

  it("resolves import services with RCM", () => {
    const ctx = gstResolveSupplyContext({
      tenantCountry: "IN",
      partyTaxTreatment: "OVERSEAS_EXPORT",
      partyCountry: "GB",
      partyState: null,
      destinationState: "DL",
      documentSide: "PURCHASE",
      supplyKind: "SERVICES",
    });
    expect(ctx.supplyNature).toBe("IMPORT_SERVICES");
    expect(ctx.taxMechanism).toBe("REVERSE_CHARGE");
  });

  it("resolves intrastate domestic purchase", () => {
    const ctx = gstResolveSupplyContext({
      tenantCountry: "IN",
      partyTaxTreatment: "REGULAR_B2B",
      partyCountry: "IN",
      partyState: "MH",
      destinationState: "mh",
      documentSide: "PURCHASE",
    });
    expect(ctx.supplyNature).toBe("INTRASTATE");
    expect(ctx.taxMechanism).toBe("FORWARD");
    expect(ctx.taxTreatmentApplied).toBe("CGST_SGST");
  });

  it("resolves zero-rated export sale", () => {
    const ctx = gstResolveSupplyContext({
      tenantCountry: "IN",
      partyTaxTreatment: "OVERSEAS_EXPORT",
      partyCountry: "US",
      partyState: null,
      destinationState: "MH",
      documentSide: "SALE",
    });
    expect(ctx.supplyNature).toBe("EXPORT");
    expect(ctx.taxMechanism).toBe("ZERO_RATED");
  });

  it("falls back to state nexus for non-India tenant", () => {
    const ctx = gstResolveSupplyContext({
      tenantCountry: "US",
      partyTaxTreatment: "REGULAR_B2B",
      partyCountry: "US",
      partyState: "CA",
      destinationState: "CA",
      documentSide: "PURCHASE",
    });
    expect(ctx.supplyNature).toBe("INTRASTATE");
    expect(ctx.taxMechanism).toBe("FORWARD");
  });
});
