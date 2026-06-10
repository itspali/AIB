import { describe, expect, it } from "vitest";
import {
  filterTaxComponentsForSupply,
  parsePoLineTaxComponentsJson,
  resolvePoLineTaxComponentBreakdown,
  taxComponentBucket,
} from "@/lib/procurement/purchase-orders/po-line-tax-components";

describe("po line tax components", () => {
  const gst18Components = [
    { name: "CGST", rate: 9, sort_order: 0 },
    { name: "SGST", rate: 9, sort_order: 1 },
    { name: "IGST", rate: 18, sort_order: 2 },
  ];

  it("classifies component names into buckets", () => {
    expect(taxComponentBucket("CGST_9")).toBe("CGST");
    expect(taxComponentBucket("SGST 9")).toBe("SGST");
    expect(taxComponentBucket("IGST-18")).toBe("IGST");
    expect(taxComponentBucket("CESS")).toBeNull();
  });

  it("filters intrastate components to CGST and SGST", () => {
    const filtered = filterTaxComponentsForSupply(gst18Components, "INTRASTATE");
    expect(filtered.map((row) => row.name)).toEqual(["CGST", "SGST"]);
  });

  it("filters interstate components to IGST only", () => {
    const filtered = filterTaxComponentsForSupply(gst18Components, "INTERSTATE");
    expect(filtered.map((row) => row.name)).toEqual(["IGST"]);
  });

  it("splits line tax across intrastate components", () => {
    const breakdown = resolvePoLineTaxComponentBreakdown({
      taxableBase: 200,
      lineTaxAmount: 36,
      components: gst18Components,
      supplyNature: "INTRASTATE",
    });
    expect(breakdown.cgst_amount).toBe(18);
    expect(breakdown.sgst_amount).toBe(18);
    expect(breakdown.igst_amount).toBe(0);
    expect(breakdown.components).toHaveLength(2);
  });

  it("assigns full line tax to IGST on interstate supply", () => {
    const breakdown = resolvePoLineTaxComponentBreakdown({
      taxableBase: 200,
      lineTaxAmount: 36,
      components: gst18Components,
      supplyNature: "INTERSTATE",
    });
    expect(breakdown.cgst_amount).toBe(0);
    expect(breakdown.sgst_amount).toBe(0);
    expect(breakdown.igst_amount).toBe(36);
  });

  it("synthesizes CGST/SGST from flat rate when components are missing", () => {
    const breakdown = resolvePoLineTaxComponentBreakdown({
      taxableBase: 200,
      lineTaxAmount: 36,
      components: [],
      supplyNature: "INTRASTATE",
      flatTaxRate: 18,
    });
    expect(breakdown.cgst_amount).toBe(18);
    expect(breakdown.sgst_amount).toBe(18);
    expect(breakdown.igst_amount).toBe(0);
  });

  it("synthesizes IGST from flat rate when components are missing", () => {
    const breakdown = resolvePoLineTaxComponentBreakdown({
      taxableBase: 200,
      lineTaxAmount: 36,
      components: [],
      supplyNature: "INTERSTATE",
      flatTaxRate: 18,
    });
    expect(breakdown.igst_amount).toBe(36);
  });

  it("parses persisted tax component JSON", () => {
    expect(
      parsePoLineTaxComponentsJson([
        { name: "CGST", rate: 9, amount: 1.8 },
        { name: "SGST", rate: 9, amount: 1.8 },
      ])
    ).toEqual([
      { name: "CGST", rate: 9, amount: 1.8 },
      { name: "SGST", rate: 9, amount: 1.8 },
    ]);
  });
});
