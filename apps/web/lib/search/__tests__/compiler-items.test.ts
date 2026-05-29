import { describe, expect, it } from "vitest";
import { compileFilterQuery } from "@/lib/search/compiler/compile";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import { scanQueryForSecuritySignatures } from "@/lib/search/telemetry/signatures";
import type { SearchFieldPermissions } from "@/lib/search/types";

const FULL_PERMISSIONS: SearchFieldPermissions = {
  financialVisible: true,
  allowedFields: [
    "purchase_price",
    "selling_price",
    "hsn_sac_code",
    "category_name",
    "base_unit_of_measure",
    "created_at",
    "name",
    "default_sku",
    "city",
    "location_type",
    "code",
  ],
  throttled: false,
};

const RESTRICTED_PERMISSIONS: SearchFieldPermissions = {
  financialVisible: false,
  allowedFields: FULL_PERMISSIONS.allowedFields.filter(
    (field) => field !== "purchase_price" && field !== "selling_price"
  ),
  throttled: false,
};

const SPEC_QUERY =
  "purchase price is more than the sales price created in the first week of May having HSN number 12345 having category test whose base UOM is pieces or liters";

describe("items native filter compiler", () => {
  it("compiles the architecture spec example into accurate AST parameters", () => {
    const fieldDict = buildFieldDict("items", FULL_PERMISSIONS);
    const referenceDate = new Date("2026-05-29T12:00:00.000Z");
    const result = compileFilterQuery(SPEC_QUERY, "items", fieldDict, {
      referenceDate,
      timezone: "UTC",
    });

    const fieldCompare = result.ast.find((clause) => clause.kind === "field_compare");
    expect(fieldCompare).toMatchObject({
      kind: "field_compare",
      left: "purchase_price",
      operator: "FIELD_GT",
      right: "selling_price",
    });

    const createdBetween = result.ast.find(
      (clause) =>
        clause.kind === "predicate" &&
        clause.field === "created_at" &&
        clause.operator === "BETWEEN"
    );
    expect(createdBetween).toBeTruthy();
    if (createdBetween?.kind === "predicate" && Array.isArray(createdBetween.value)) {
      expect(createdBetween.value[0]).toBe("2026-05-01T00:00:00.000Z");
      expect(createdBetween.value[1]).toBe("2026-05-07T23:59:59.999Z");
    }

    expect(result.ast).toContainEqual({
      kind: "predicate",
      field: "hsn_sac_code",
      operator: "EQ",
      value: "12345",
    });

    expect(result.ast).toContainEqual({
      kind: "predicate",
      field: "category_name",
      operator: "EQ",
      value: "test",
    });

    expect(result.ast).toContainEqual({
      kind: "predicate",
      field: "base_unit_of_measure",
      operator: "IN",
      value: ["pieces", "liters"],
    });
  });

  it("masks financial synonyms when registry permissions disallow them", () => {
    const fieldDict = buildFieldDict("items", RESTRICTED_PERMISSIONS);
    const result = compileFilterQuery(
      "purchase price is more than the sales price",
      "items",
      fieldDict
    );

    expect(result.ast.some((clause) => clause.kind === "field_compare")).toBe(false);
    expect(result.unparsedTokens.length).toBeGreaterThan(0);
  });

  it("rejects tampered financial AST fields server-side", () => {
    const tamperedAst = [
      {
        kind: "field_compare" as const,
        left: "purchase_price",
        operator: "FIELD_GT" as const,
        right: "selling_price",
      },
    ];

    const validation = validateFilterAst(tamperedAst, "items", RESTRICTED_PERMISSIONS);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.error).toBe("FORBIDDEN_FIELD");
      expect(validation.field).toBe("purchase_price");
    }
  });

  it("flags malicious SQL signatures", () => {
    const scan = scanQueryForSecuritySignatures("name test; drop table items");
    expect(scan.flagged).toBe(true);
    expect(scan.reasons).toContain("statement_terminator");
  });
});
