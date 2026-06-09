import { describe, expect, it } from "vitest";
import { pruneCustomFieldValues } from "@/lib/entity-categories/prune-custom-fields";

describe("pruneCustomFieldValues", () => {
  it("keeps only allowed keys", () => {
    expect(
      pruneCustomFieldValues(
        { industry: "Retail", region: "West", legacy: "drop" },
        ["industry", "region"]
      )
    ).toEqual({ industry: "Retail", region: "West" });
  });

  it("returns empty object when no keys are allowed", () => {
    expect(pruneCustomFieldValues({ industry: "Retail" }, [])).toEqual({});
  });

  it("returns empty object when values are empty", () => {
    expect(pruneCustomFieldValues({}, ["industry"])).toEqual({});
  });

  it("preserves empty string values for allowed keys", () => {
    expect(pruneCustomFieldValues({ industry: "" }, ["industry"])).toEqual({ industry: "" });
  });
});
