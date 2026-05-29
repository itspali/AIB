import { describe, expect, it } from "vitest";
import { compileFilterQuery } from "@/lib/search/compiler/compile";
import { buildFieldDict } from "@/lib/search/permissions/resolve-field-dict";
import { validateFilterAst } from "@/lib/search/executor/validate-ast";
import {
  extractStructuralAst,
  isSavedViewDirty,
  normalizeSavedViewQuery,
  serializeStructuralAst,
} from "@/lib/search/views/saved-view-utils";
import { getAllViewLabel, isSavedViewsScope } from "@/lib/search/views/module-view-registry";
import type { AstClause, SearchFieldPermissions } from "@/lib/search/types";

const PERMISSIONS: SearchFieldPermissions = {
  financialVisible: true,
  allowedFields: ["purchase_price", "selling_price", "name", "hsn_sac_code", "category_name"],
  throttled: false,
};

function compileItemsQuery(query: string) {
  const fieldDict = buildFieldDict("items", PERMISSIONS);
  return compileFilterQuery(query, "items", fieldDict);
}

function viewDisplayLabel(input: {
  scope: "items";
  activeSavedViewId: string | null;
  hasActiveFilters: boolean;
  viewName?: string;
  isDefault?: boolean;
}): string {
  const allLabel = getAllViewLabel(input.scope);
  const viewMatchesFilters = input.activeSavedViewId != null && input.hasActiveFilters;

  if (viewMatchesFilters && input.viewName) {
    return `${input.isDefault ? "★ " : ""}${input.viewName}`;
  }
  if (input.hasActiveFilters) {
    return `${allLabel} (filtered)`;
  }
  return allLabel;
}

describe("saved views integration", () => {
  it("round-trips a typical saved view query through compile and dirty detection", () => {
    const query = "purchase price < 1000";
    const compiled = compileItemsQuery(query);
    const structural = extractStructuralAst(compiled.ast);
    const validation = validateFilterAst(compiled.ast, "items", PERMISSIONS);

    expect(validation.ok).toBe(true);

    const snapshot = {
      raw_search_text: query,
      compiled_ast: structural,
    };

    expect(isSavedViewDirty(snapshot, query, compiled.ast)).toBe(false);

    const edited = compileItemsQuery("purchase price < 500");
    expect(isSavedViewDirty(snapshot, "purchase price < 500", edited.ast)).toBe(true);
  });

  it("recompiled AST matches persisted snapshot after normalization", () => {
    const query = "having HSN number 12345";
    const compiled = compileItemsQuery(query);
    const persisted = extractStructuralAst(compiled.ast);
    const recompiled = compileItemsQuery(query);

    expect(serializeStructuralAst(persisted)).toBe(
      serializeStructuralAst(extractStructuralAst(recompiled.ast))
    );
    expect(
      isSavedViewDirty(
        { raw_search_text: query, compiled_ast: persisted },
        query,
        recompiled.ast
      )
    ).toBe(false);
  });

  it("shows All items when filters are cleared even if a view id lingers in UI state", () => {
    expect(
      viewDisplayLabel({
        scope: "items",
        activeSavedViewId: "view-123",
        hasActiveFilters: false,
        viewName: "High margin",
      })
    ).toBe("All items");
  });

  it("shows saved view name only while filters are active", () => {
    expect(
      viewDisplayLabel({
        scope: "items",
        activeSavedViewId: "view-123",
        hasActiveFilters: true,
        viewName: "High margin",
        isDefault: true,
      })
    ).toBe("★ High margin");
  });

  it("shows ad-hoc filtered label when filters exist without a saved view", () => {
    expect(
      viewDisplayLabel({
        scope: "items",
        activeSavedViewId: null,
        hasActiveFilters: true,
      })
    ).toBe("All items (filtered)");
  });

  it("validates AST before a view would be persisted", () => {
    const forbidden = compileItemsQuery("purchase price < 1000");
    const restricted: SearchFieldPermissions = {
      financialVisible: false,
      allowedFields: PERMISSIONS.allowedFields.filter((field) => field !== "purchase_price"),
      throttled: false,
    };
    const result = validateFilterAst(forbidden.ast, "items", restricted);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("FORBIDDEN_FIELD");
    }
  });

  it("normalizes whitespace consistently for dirty checks", () => {
    const snapshot = {
      raw_search_text: "purchase  price   <   1000",
      compiled_ast: compileItemsQuery("purchase price < 1000").ast.filter(
        (clause: AstClause) => clause.kind !== "text"
      ),
    };

    expect(
      isSavedViewDirty(snapshot, "purchase price < 1000", compileItemsQuery("purchase price < 1000").ast)
    ).toBe(false);
    expect(normalizeSavedViewQuery(snapshot.raw_search_text)).toBe("purchase price < 1000");
  });

  it("supports saved views on items, categories, and locations scopes only", () => {
    expect(isSavedViewsScope("items")).toBe(true);
    expect(isSavedViewsScope("categories")).toBe(true);
    expect(isSavedViewsScope("locations")).toBe(true);
    expect(isSavedViewsScope("all")).toBe(false);
    expect(isSavedViewsScope("settings")).toBe(false);
  });
});
