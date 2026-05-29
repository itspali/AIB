import { describe, expect, it } from "vitest";
import { compileFilterQuery } from "@/lib/search/compiler/compile";
import { serializeCriterionDraft } from "@/lib/search/compiler/clause-serialize";
import { isDraftReadyFilterClause } from "@/lib/search/compiler/parser";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import type { CriterionDraft, SearchFieldPermissions } from "@/lib/search/types";

const PERMISSIONS: SearchFieldPermissions = {
  financialVisible: true,
  allowedFields: [
    "name",
    "category_name",
    "selling_price",
    "purchase_price",
    "is_active",
    "default_sku",
    "hsn_sac_code",
    "base_unit_of_measure",
    "created_at",
  ],
  throttled: false,
};

describe("clause-serialize", () => {
  it("serializes multi-value IN criteria", () => {
    const draft: CriterionDraft = {
      field: "category_name",
      parts: [{ operator: "IN", value: ["Electronics", "Books"] }],
    };

    expect(serializeCriterionDraft(draft)).toBe("category name is Electronics or Books");
  });

  it("serializes compound same-field criteria", () => {
    const draft: CriterionDraft = {
      field: "name",
      parts: [
        { operator: "ILIKE", value: "test" },
        { operator: "ILIKE", value: "^A" },
      ],
    };

    expect(serializeCriterionDraft(draft)).toBe(
      "name contains test and name starts with A"
    );
  });

  it("round-trips through parser for category name is", () => {
    const draft: CriterionDraft = {
      field: "category_name",
      parts: [{ operator: "EQ", value: "Electronics" }],
    };
    const segment = serializeCriterionDraft(draft);
    const fieldDict = buildFieldDict("items", PERMISSIONS);

    expect(isDraftReadyFilterClause(segment, fieldDict)).toBe(true);
    const compiled = compileFilterQuery(segment, "items", fieldDict);
    expect(compiled.ast).toContainEqual({
      kind: "predicate",
      field: "category_name",
      operator: "EQ",
      value: "Electronics",
    });
  });

  it("round-trips numeric between criteria", () => {
    const draft: CriterionDraft = {
      field: "selling_price",
      parts: [{ operator: "BETWEEN", value: [100, 500] }],
    };
    const segment = serializeCriterionDraft(draft);
    const fieldDict = buildFieldDict("items", PERMISSIONS);

    expect(isDraftReadyFilterClause(segment, fieldDict)).toBe(true);
  });
});
