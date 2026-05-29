import { describe, expect, it } from "vitest";
import type { CategoryRow } from "@/lib/categories/types";
import { filterCategoriesByAst } from "@/lib/search/executor/client-scopes";

const ROWS: CategoryRow[] = [
  {
    id: "1",
    name: "Electronics",
    parent_id: null,
    is_active: true,
    attribute_templates: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Books",
    parent_id: null,
    is_active: true,
    attribute_templates: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

describe("filterCategoriesByAst", () => {
  it("matches category_name predicates against row.name", () => {
    const filtered = filterCategoriesByAst(ROWS, [
      {
        kind: "predicate",
        field: "category_name",
        operator: "EQ",
        value: "Electronics",
      },
    ]);

    expect(filtered.map((row) => row.name)).toEqual(["Electronics"]);
  });

  it("supports ILIKE contains on category_name", () => {
    const filtered = filterCategoriesByAst(ROWS, [
      {
        kind: "predicate",
        field: "category_name",
        operator: "ILIKE",
        value: "book",
      },
    ]);

    expect(filtered.map((row) => row.name)).toEqual(["Books"]);
  });
});
