import { describe, expect, it } from "vitest";
import {
  analyzeActiveSegment,
  applyHintToQuery,
  buildOmnibarHints,
} from "@/lib/search/hints/build-hints";
import { compileFilterQuery } from "@/lib/search/compiler/compile";
import type { ResolvedFieldDictEntry } from "@/lib/search/types";

const fieldDict: ResolvedFieldDictEntry[] = [
  { key: "name", synonyms: ["name", "item name"] },
  { key: "category_name", synonyms: ["category name", "category"] },
  { key: "purchase_price", synonyms: ["purchase price"] },
  { key: "created_at", synonyms: ["created at", "created"] },
  { key: "is_active", synonyms: ["active status", "is active"] },
];

describe("buildOmnibarHints", () => {
  it("shows all fields when the segment is empty", () => {
    const hints = buildOmnibarHints("", 0, "items", fieldDict);
    expect(hints.every((hint) => hint.kind === "field")).toBe(true);
    expect(hints.length).toBe(fieldDict.length);
  });

  it("shows text-specific operators after a text field is selected", () => {
    const query = "name ";
    const hints = buildOmnibarHints(query, query.length, "items", fieldDict);
    const labels = hints.map((hint) => hint.label);
    expect(labels).toContain("starts with");
    expect(labels).toContain("contains");
    expect(labels).toContain("not contains");
    expect(labels).toContain("empty");
    expect(labels).toContain("not empty");
  });

  it("shows numeric-specific operators after a price field is selected", () => {
    const query = "purchase price ";
    const hints = buildOmnibarHints(query, query.length, "items", fieldDict);
    const labels = hints.map((hint) => hint.label);
    expect(labels).toContain("less than");
    expect(labels).toContain("more than");
    expect(labels).toContain("zero");
    expect(labels).toContain("less than zero");
  });

  it("shows date period suggestions for date fields", () => {
    const query = "created at in ";
    const hints = buildOmnibarHints(query, query.length, "items", fieldDict);
    expect(hints.some((hint) => hint.label === "Today")).toBe(true);
    expect(hints.some((hint) => hint.label === "Last month")).toBe(true);
  });

  it("shows connector hints when the segment is complete", () => {
    const query = "name contains widget";
    const hints = buildOmnibarHints(query, query.length, "items", fieldDict);
    expect(hints.map((hint) => hint.label)).toEqual([
      "AND — add another condition",
      "OR — combine values",
    ]);
  });

  it("shows boolean value hints for active status fields", () => {
    const query = "active status is ";
    const hints = buildOmnibarHints(query, query.length, "items", fieldDict);
    expect(hints.map((hint) => hint.label)).toEqual(["Active", "Inactive"]);
  });

  it("filters catalog value hints by typed prefix", () => {
    const query = "category name is ele";
    const catalog = [
      { value: "Electronics", label: "Electronics" },
      { value: "Books", label: "Books" },
    ];
    const hints = buildOmnibarHints(query, query.length, "items", fieldDict, {
      valueOptions: catalog,
    });
    expect(hints).toHaveLength(1);
    expect(hints[0]?.label).toBe("Electronics");
    expect(analyzeActiveSegment(query, query.length, fieldDict, catalog).phase).toBe("value");
  });
});

describe("analyzeActiveSegment", () => {
  it("detects operator phase after field selection", () => {
    expect(analyzeActiveSegment("name ", 5, fieldDict).phase).toBe("operator");
  });

  it("detects value phase after operator selection", () => {
    expect(analyzeActiveSegment("name contains ", 14, fieldDict).phase).toBe("value");
  });

  it("detects connector phase for a complete clause", () => {
    expect(analyzeActiveSegment("name contains widget", 20, fieldDict).phase).toBe(
      "connector"
    );
  });
});

describe("applyHintToQuery", () => {
  it("replaces the value prefix when a value hint is applied", () => {
    const query = "category name is ele";
    const cursor = query.length;
    const catalog = [{ value: "Electronics", label: "Electronics" }];
    const hints = buildOmnibarHints(query, cursor, "items", fieldDict, {
      valueOptions: catalog,
    });
    const valueHint = hints.find((hint) => hint.kind === "value")!;
    const { nextQuery, nextCursor } = applyHintToQuery(query, cursor, valueHint, fieldDict);
    expect(nextQuery).toBe("category name is Electronics");
    expect(nextCursor).toBe(nextQuery.length);
  });

  it("appends AND connector to continue building", () => {
    const query = "name contains widget";
    const hint = buildOmnibarHints(query, query.length, "items", fieldDict)[0]!;
    const { nextQuery } = applyHintToQuery(query, query.length, hint, fieldDict);
    expect(nextQuery).toBe("name contains widget and ");
  });
});

describe("typed operator compilation", () => {
  it("compiles not contains and empty operators", () => {
    const notContains = compileFilterQuery("name does not contain test", "items", fieldDict);
    expect(notContains.ast[0]).toMatchObject({
      kind: "predicate",
      field: "name",
      operator: "NOT_ILIKE",
      value: "test",
    });

    const isEmpty = compileFilterQuery("name is empty", "items", fieldDict);
    expect(isEmpty.ast[0]).toMatchObject({
      kind: "predicate",
      field: "name",
      operator: "IS_NULL",
    });
  });

  it("compiles relative date periods", () => {
    const result = compileFilterQuery("created at in today", "items", fieldDict);
    expect(result.ast[0]).toMatchObject({
      kind: "predicate",
      field: "created_at",
      operator: "BETWEEN",
    });
  });
});
