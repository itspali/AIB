import { describe, expect, it } from "vitest";
import {
  getAllViewLabel,
  getModuleViewDefinition,
  isSavedViewsScope,
  assertRegisteredModuleName,
  MODULE_VIEW_ALL,
} from "@/lib/search/views/module-view-registry";
import {
  extractStructuralAst,
  isSavedViewDirty,
  normalizeSavedViewQuery,
  serializeStructuralAst,
} from "@/lib/search/views/saved-view-utils";
import type { AstClause } from "@/lib/search/types";

const SAMPLE_AST: AstClause[] = [
  { kind: "predicate", field: "hsn_sac_code", operator: "EQ", value: "12345" },
  { kind: "text", value: "spare" },
];

describe("module-view-registry", () => {
  it("enables saved views for items, categories, and locations", () => {
    expect(isSavedViewsScope("items")).toBe(true);
    expect(isSavedViewsScope("categories")).toBe(true);
    expect(isSavedViewsScope("locations")).toBe(true);
    expect(isSavedViewsScope("all")).toBe(false);
    expect(isSavedViewsScope("settings")).toBe(false);
  });

  it("registers module names for persistence", () => {
    expect(assertRegisteredModuleName("items")).toBe(true);
    expect(assertRegisteredModuleName("procurement")).toBe(false);
    expect(getModuleViewDefinition("items")?.moduleName).toBe("items");
    expect(getAllViewLabel("items")).toBe("All items");
    expect(MODULE_VIEW_ALL).toBe("__all__");
  });
});

describe("saved-view-utils", () => {
  it("strips text clauses from persisted AST snapshots", () => {
    expect(extractStructuralAst(SAMPLE_AST)).toHaveLength(1);
    expect(extractStructuralAst(SAMPLE_AST)[0]?.kind).toBe("predicate");
  });

  it("detects dirty state when query or AST diverges", () => {
    const snapshot = {
      raw_search_text: "having HSN number 12345",
      compiled_ast: extractStructuralAst(SAMPLE_AST),
    };

    expect(
      isSavedViewDirty(snapshot, "having HSN number 12345", extractStructuralAst(SAMPLE_AST))
    ).toBe(false);

    expect(
      isSavedViewDirty(snapshot, "having HSN number 99999", extractStructuralAst(SAMPLE_AST))
    ).toBe(true);

    expect(isSavedViewDirty(null, "query", SAMPLE_AST)).toBe(false);
  });

  it("normalizes whitespace in saved view queries", () => {
    expect(normalizeSavedViewQuery("  foo   bar  ")).toBe("foo bar");
    expect(serializeStructuralAst(SAMPLE_AST)).toBe(
      serializeStructuralAst(extractStructuralAst(SAMPLE_AST))
    );
  });
});

describe("items numeric literal compiler", () => {
  it("compiles purchase price literal greater-than into AST", async () => {
    const { compileFilterQuery } = await import("@/lib/search/compiler/compile");
    const { buildFieldDict } = await import("@/lib/search/permissions/resolve-field-dict");

    const permissions = {
      financialVisible: true,
      allowedFields: ["purchase_price", "selling_price", "name"],
      throttled: false,
    };

    const fieldDict = buildFieldDict("items", permissions);
    const result = compileFilterQuery("purchase price > 100", "items", fieldDict);

    expect(result.ast).toContainEqual({
      kind: "predicate",
      field: "purchase_price",
      operator: "GT",
      value: 100,
    });
  });
});
