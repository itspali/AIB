import { describe, expect, it } from "vitest";
import {
  isLegacyComponentOnlyTaxCode,
  itemTaxCodePickerDescription,
  itemTaxCodePickerLabel,
  resolveItemTaxCodePickerOptions,
  type ItemTaxCodeRow,
} from "@/lib/tax/item-tax-code-picker";

const row = (partial: Partial<ItemTaxCodeRow> & Pick<ItemTaxCodeRow, "id" | "name">): ItemTaxCodeRow => ({
  id: partial.id,
  code: partial.code ?? partial.id,
  name: partial.name,
  rate: partial.rate ?? 0,
  kind: partial.kind ?? "GST",
  is_variable: partial.is_variable ?? false,
});

describe("isLegacyComponentOnlyTaxCode", () => {
  it("flags lone CGST and SGST component codes", () => {
    expect(isLegacyComponentOnlyTaxCode({ name: "CGST_9", code: "CGST_9" })).toBe(true);
    expect(isLegacyComponentOnlyTaxCode({ name: "SGST_9", code: "SGST_9" })).toBe(true);
  });

  it("allows full-rate and slab rules", () => {
    expect(isLegacyComponentOnlyTaxCode({ name: "IGST_18", code: "IGST_18" })).toBe(false);
    expect(isLegacyComponentOnlyTaxCode({ name: "GST 18%", code: "GST18" })).toBe(false);
    expect(isLegacyComponentOnlyTaxCode({ name: "GST-5-12", code: "GST-APPAREL" })).toBe(false);
  });
});

describe("itemTaxCodePickerLabel", () => {
  it("renames legacy IGST component codes to GST rate labels", () => {
    expect(itemTaxCodePickerLabel(row({ id: "1", name: "IGST_18", rate: 18 }))).toBe("GST 18%");
  });

  it("keeps variable slab names", () => {
    expect(
      itemTaxCodePickerLabel(row({ id: "2", name: "GST-5-12", rate: 12, is_variable: true }))
    ).toBe("GST-5-12");
  });
});

describe("resolveItemTaxCodePickerOptions", () => {
  const codes = [
    row({ id: "cgst", name: "CGST_9", rate: 9 }),
    row({ id: "sgst", name: "SGST_9", rate: 9 }),
    row({ id: "igst", name: "IGST_18", rate: 18 }),
    row({ id: "slab", name: "GST-5-12", rate: 12, is_variable: true }),
  ];

  it("excludes component-only codes from the picker list", () => {
    const options = resolveItemTaxCodePickerOptions(codes);
    expect(options.map((o) => o.id)).toEqual(["igst", "slab"]);
  });

  it("retains a stale component selection with a warning description", () => {
    const options = resolveItemTaxCodePickerOptions(codes, { includeTaxCodeId: "cgst" });
    expect(options.some((o) => o.id === "cgst")).toBe(true);
    const stale = options.find((o) => o.id === "cgst");
    expect(stale?.pickerDescription).toContain("Component-only");
  });
});

describe("itemTaxCodePickerDescription", () => {
  it("mentions invoice place-of-supply for standard GST rates", () => {
    expect(itemTaxCodePickerDescription(row({ id: "1", name: "GST 18%", rate: 18 }))).toContain(
      "invoice"
    );
  });
});
