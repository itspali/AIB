import { describe, expect, it } from "vitest";
import { clauseToLabel, compileFilterQuery } from "@/lib/search/compiler/compile";
import {
  isDraftReadyFilterClause,
  isIncompleteFilterClause,
} from "@/lib/search/compiler/parser";
import { getFieldDisplayLabel } from "@/lib/search/permissions/field-labels";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import { filterCatalogRowsInMemory } from "@/lib/search/executor/apply-ast-in-memory";
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

  it("parses substring queries with contains operator", () => {
    const fieldDict = buildFieldDict("items", FULL_PERMISSIONS);
    const result = compileFilterQuery("name contains 004", "items", fieldDict);

    expect(result.ast).toContainEqual({
      kind: "predicate",
      field: "name",
      operator: "ILIKE",
      value: "004",
    });
    expect(result.clauseSegments).toEqual(["name contains 004"]);
  });

  it("labels ILIKE clauses as contains", () => {
    expect(
      clauseToLabel({
        kind: "predicate",
        field: "name",
        operator: "ILIKE",
        value: "004",
      })
    ).toBe("name contains 004");
  });

  it("labels field keys with friendly display names in chips", () => {
    expect(
      clauseToLabel({
        kind: "field_compare",
        left: "purchase_price",
        operator: "FIELD_GT",
        right: "selling_price",
      })
    ).toBe("purchase price > selling price");

    expect(
      clauseToLabel({
        kind: "predicate",
        field: "category_name",
        operator: "EQ",
        value: "electronics",
      })
    ).toBe("category name is electronics");

    expect(
      clauseToLabel({
        kind: "predicate",
        field: "category_id",
        operator: "EQ",
        value: "uuid-here",
      })
    ).toBe("category is uuid-here");
  });

  it("resolves display labels for hint suggestions", () => {
    expect(getFieldDisplayLabel("purchase_price")).toBe("purchase price");
    expect(getFieldDisplayLabel("selling_price")).toBe("selling price");
    expect(getFieldDisplayLabel("category_name")).toBe("category name");
    expect(getFieldDisplayLabel("default_sku")).toBe("default sku");
  });

  it("parses bare text field queries as substring ILIKE", () => {
    const fieldDict = buildFieldDict("items", FULL_PERMISSIONS);
    const nameResult = compileFilterQuery("name test", "items", fieldDict);
    expect(nameResult.ast).toContainEqual({
      kind: "predicate",
      field: "name",
      operator: "ILIKE",
      value: "test",
    });

    const isResult = compileFilterQuery("name is test", "items", fieldDict);
    expect(isResult.ast).toContainEqual({
      kind: "predicate",
      field: "name",
      operator: "ILIKE",
      value: "test",
    });
  });

  it("parses numeric literal comparisons on financial fields", () => {
    const fieldDict = buildFieldDict("items", FULL_PERMISSIONS);

    expect(compileFilterQuery("selling price >= 100", "items", fieldDict).ast).toContainEqual({
      kind: "predicate",
      field: "selling_price",
      operator: "GTE",
      value: 100,
    });

    expect(compileFilterQuery("sales price is at least 250", "items", fieldDict).ast).toContainEqual({
      kind: "predicate",
      field: "selling_price",
      operator: "GTE",
      value: 250,
    });

    expect(
      compileFilterQuery("selling price between 500 and 1000", "items", fieldDict).ast
    ).toContainEqual({
      kind: "predicate",
      field: "selling_price",
      operator: "BETWEEN",
      value: [500, 1000],
    });

    const rangeResult = compileFilterQuery(
      "selling price is more than 500 but less than 1000",
      "items",
      fieldDict
    );
    expect(rangeResult.ast).toContainEqual({
      kind: "predicate",
      field: "selling_price",
      operator: "GT",
      value: 500,
    });
    expect(rangeResult.ast).toContainEqual({
      kind: "predicate",
      field: "selling_price",
      operator: "LT",
      value: 1000,
    });
  });

  it("labels numeric literal predicates with friendly field names", () => {
    expect(
      clauseToLabel({
        kind: "predicate",
        field: "selling_price",
        operator: "GTE",
        value: 100,
      })
    ).toBe("selling price >= 100");

    expect(
      clauseToLabel({
        kind: "predicate",
        field: "selling_price",
        operator: "BETWEEN",
        value: [500, 1000],
      })
    ).toBe("selling price between 500 and 1000");
  });

  it("filters catalog rows in memory with numeric thresholds", () => {
    const rows = [
      {
        item_id: "1",
        name: "Budget",
        description: null,
        category_id: null,
        category_name: null,
        hsn_sac_code: null,
        base_unit_of_measure: null,
        created_at: null,
        default_sku: null,
        selling_price: 80,
        purchase_price: null,
      },
      {
        item_id: "2",
        name: "Premium",
        description: null,
        category_id: null,
        category_name: null,
        hsn_sac_code: null,
        base_unit_of_measure: null,
        created_at: null,
        default_sku: null,
        selling_price: 750,
        purchase_price: null,
      },
    ];

    const gteIds = filterCatalogRowsInMemory(rows, [
      { kind: "predicate", field: "selling_price", operator: "GTE", value: 100 },
    ]);
    expect(gteIds).toEqual(["2"]);

    const rangeIds = filterCatalogRowsInMemory(rows, [
      { kind: "predicate", field: "selling_price", operator: "GT", value: 500 },
      { kind: "predicate", field: "selling_price", operator: "LT", value: 1000 },
    ]);
    expect(rangeIds).toEqual(["2"]);
  });

  it("rejects incomplete modal draft clauses", () => {
    const fieldDict = buildFieldDict("items", FULL_PERMISSIONS);

    expect(isIncompleteFilterClause("name contains")).toBe(true);
    expect(isIncompleteFilterClause("selling price >")).toBe(true);
    expect(isIncompleteFilterClause("name is")).toBe(true);
    expect(isIncompleteFilterClause("name contains widget")).toBe(false);

    expect(isDraftReadyFilterClause("name contains", fieldDict)).toBe(false);
    expect(isDraftReadyFilterClause("name contains widget", fieldDict)).toBe(true);
    expect(isDraftReadyFilterClause("selling price >= 100", fieldDict)).toBe(true);
    expect(isDraftReadyFilterClause("selling price >=", fieldDict)).toBe(false);
    expect(isDraftReadyFilterClause("category", fieldDict)).toBe(false);
    expect(isDraftReadyFilterClause("category electronics", fieldDict)).toBe(true);
  });

  it("filters catalog rows in memory with ILIKE", () => {
    const rows = [
      {
        item_id: "1",
        name: "Widget 004",
        description: null,
        category_id: null,
        category_name: null,
        hsn_sac_code: null,
        base_unit_of_measure: null,
        created_at: null,
        default_sku: null,
        selling_price: null,
        purchase_price: null,
      },
      {
        item_id: "2",
        name: "Other",
        description: null,
        category_id: null,
        category_name: null,
        hsn_sac_code: null,
        base_unit_of_measure: null,
        created_at: null,
        default_sku: null,
        selling_price: null,
        purchase_price: null,
      },
    ];

    const ids = filterCatalogRowsInMemory(rows, [
      { kind: "predicate", field: "name", operator: "ILIKE", value: "004" },
    ]);
    expect(ids).toEqual(["1"]);
  });
});
