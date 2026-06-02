import { describe, expect, it } from "vitest";
import {
  overallCompletenessPercent,
  rollUpStageStatus,
  type SectionStatus,
} from "@/lib/products/item-completeness";

describe("rollUpStageStatus", () => {
  it("returns empty for no sections", () => {
    expect(rollUpStageStatus([])).toBe("empty");
  });

  it("lets an error win over everything", () => {
    expect(rollUpStageStatus(["complete", "error", "complete"])).toBe("error");
  });

  it("is complete only when every section is complete", () => {
    expect(rollUpStageStatus(["complete", "complete"])).toBe("complete");
  });

  it("is partial when some but not all sections are complete", () => {
    expect(rollUpStageStatus(["complete", "empty"])).toBe("partial");
  });

  it("is empty when nothing is complete", () => {
    expect(rollUpStageStatus(["empty", "empty"])).toBe("empty");
  });
});

describe("overallCompletenessPercent", () => {
  it("returns 0 for no sections", () => {
    expect(overallCompletenessPercent([])).toBe(0);
  });

  it("counts only complete sections", () => {
    const statuses: SectionStatus[] = ["complete", "complete", "empty", "error"];
    expect(overallCompletenessPercent(statuses)).toBe(50);
  });

  it("rounds to the nearest integer", () => {
    const statuses: SectionStatus[] = ["complete", "empty", "empty"];
    expect(overallCompletenessPercent(statuses)).toBe(33);
  });
});
