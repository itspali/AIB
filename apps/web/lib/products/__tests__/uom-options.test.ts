import { describe, expect, it } from "vitest";
import { resolveItemCommerceUomOptions } from "@/lib/products/uom-options";

describe("resolveItemCommerceUomOptions", () => {
  const managed = [
    { code: "PCS", name: "Pieces" },
    { code: "BOX", name: "Box" },
    { code: "KG", name: "Kilogram" },
  ];

  it("includes stock unit and alternates only", () => {
    const options = resolveItemCommerceUomOptions(
      "PCS",
      [{ uom_code: "BOX" }, { uom_code: "KG" }, { uom_code: "PCS" }],
      managed
    );
    expect(options.map((o) => o.code)).toEqual(["PCS", "BOX", "KG"]);
    expect(options[0]?.name).toBe("Pieces");
  });

  it("retains a saved unit outside alternates for display", () => {
    const options = resolveItemCommerceUomOptions("PCS", [], managed, "PALLET");
    expect(options.map((o) => o.code)).toEqual(["PCS", "PALLET"]);
  });
});
