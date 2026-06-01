import { describe, expect, it } from "vitest";
import {
  classificationForBundleEnabled,
  classificationWhenBundleDisabled,
  classificationsForItemType,
  deriveClassificationOnItemTypeChange,
  validateItemTypeClassificationPair,
} from "@/lib/products/item-type-classification";

describe("classificationsForItemType", () => {
  it("returns physical supply-chain roles without legacy by default", () => {
    expect(classificationsForItemType("PHYSICAL")).toEqual([
      "RAW_MATERIAL",
      "WIP_ASSEMBLY",
      "FINISHED_GOOD",
      "CONSUMABLE",
      "KIT_BUNDLE",
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

  it("preserves legacy physical good when requested", () => {
    expect(
      deriveClassificationOnItemTypeChange("PHYSICAL", "PHYSICAL_GOOD", {
        preserveLegacyPhysicalGood: true,
      })
    ).toBe("PHYSICAL_GOOD");
  });
});

describe("bundle classification sync", () => {
  it("promotes generic physical classes to kit bundle", () => {
    expect(classificationForBundleEnabled("FINISHED_GOOD")).toBe("KIT_BUNDLE");
    expect(classificationForBundleEnabled("PHYSICAL_GOOD")).toBe("KIT_BUNDLE");
  });

  it("demotes kit bundle when bundle is disabled", () => {
    expect(classificationWhenBundleDisabled("KIT_BUNDLE")).toBe("FINISHED_GOOD");
  });
});

describe("validateItemTypeClassificationPair", () => {
  it("accepts goods finished good without bundle", () => {
    expect(
      validateItemTypeClassificationPair("PHYSICAL", "FINISHED_GOOD", false)
    ).toHaveLength(0);
  });

  it("rejects service type with finished good classification", () => {
    const issues = validateItemTypeClassificationPair("SERVICE", "FINISHED_GOOD", false);
    expect(issues.some((i) => i.path === "classification")).toBe(true);
  });

  it("requires bundle flag for kit classification", () => {
    const issues = validateItemTypeClassificationPair("PHYSICAL", "KIT_BUNDLE", false);
    expect(issues.some((i) => i.path === "is_bundle")).toBe(true);
  });

  it("requires kit classification when bundle is enabled", () => {
    const issues = validateItemTypeClassificationPair("PHYSICAL", "FINISHED_GOOD", true);
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
