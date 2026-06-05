import { describe, expect, it } from "vitest";
import {
  classificationsForItemType,
  deriveClassificationOnItemTypeChange,
  validateItemTypeClassificationPair,
} from "@/lib/products/item-type-classification";

describe("classificationsForItemType", () => {
  it("returns physical supply-chain roles without kit/bundle", () => {
    expect(classificationsForItemType("PHYSICAL")).toEqual([
      "RAW_MATERIAL",
      "WIP_ASSEMBLY",
      "FINISHED_GOOD",
      "CONSUMABLE",
    ]);
  });

  it("can include legacy physical good for existing records", () => {
    expect(
      classificationsForItemType("PHYSICAL", { includeLegacyPhysicalGood: true })
    ).toContain("PHYSICAL_GOOD");
  });

  it("returns only service classification for service items", () => {
    expect(classificationsForItemType("SERVICE")).toEqual(["SERVICE"]);
  });

  it("returns digital classifications", () => {
    expect(classificationsForItemType("DIGITAL")).toEqual(["FINISHED_GOOD", "CONSUMABLE"]);
  });
});

describe("deriveClassificationOnItemTypeChange", () => {
  it("forces service classification for service type", () => {
    expect(deriveClassificationOnItemTypeChange("SERVICE", "FINISHED_GOOD")).toBe("SERVICE");
  });

  it("resets invalid digital classification", () => {
    expect(deriveClassificationOnItemTypeChange("DIGITAL", "RAW_MATERIAL")).toBe("FINISHED_GOOD");
  });

  it("migrates legacy kit bundle role to finished good", () => {
    expect(deriveClassificationOnItemTypeChange("PHYSICAL", "KIT_BUNDLE")).toBe("FINISHED_GOOD");
  });

  it("preserves legacy physical good when requested", () => {
    expect(
      deriveClassificationOnItemTypeChange("PHYSICAL", "PHYSICAL_GOOD", {
        preserveLegacyPhysicalGood: true,
      })
    ).toBe("PHYSICAL_GOOD");
  });
});

describe("validateItemTypeClassificationPair", () => {
  it("accepts goods finished good without composition", () => {
    expect(
      validateItemTypeClassificationPair("PHYSICAL", "FINISHED_GOOD", false)
    ).toHaveLength(0);
  });

  it("accepts finished good with composition flag", () => {
    expect(
      validateItemTypeClassificationPair("PHYSICAL", "FINISHED_GOOD", true)
    ).toHaveLength(0);
  });

  it("rejects service type with finished good classification", () => {
    const issues = validateItemTypeClassificationPair("SERVICE", "FINISHED_GOOD", false);
    expect(issues.some((i) => i.path === "classification")).toBe(true);
  });

  it("rejects legacy kit bundle classification in picker flow", () => {
    const issues = validateItemTypeClassificationPair("PHYSICAL", "KIT_BUNDLE", true);
    expect(issues.some((i) => i.path === "classification")).toBe(true);
  });

  it("allows legacy physical good on physical items", () => {
    expect(
      validateItemTypeClassificationPair("PHYSICAL", "PHYSICAL_GOOD", false, {
        allowLegacyPhysicalGood: true,
      })
    ).toHaveLength(0);
  });
});
