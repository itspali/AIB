import { describe, expect, it } from "vitest";
import {
  categoryDeleteBlockedMessage,
  categoryDeleteBlockedWithInactiveHint,
  getCategoryDeleteBlockers,
} from "@/lib/categories/validate-delete";
import type { CategoryRow } from "@/lib/categories/types";

const baseRow = (id: string, parent_id: string | null = null): CategoryRow => ({
  id,
  name: id,
  parent_id,
  is_active: true,
  attribute_templates: [],
  inherit_parent_attributes: true,
  default_variant_strategy: "SINGLE_SKU",
  qc_receipt_policy: "INHERIT",
  created_at: "",
  updated_at: "",
});

describe("getCategoryDeleteBlockers", () => {
  it("returns empty when category has no items or children", () => {
    const rows = [baseRow("a"), baseRow("b", "a")];
    expect(getCategoryDeleteBlockers("b", rows, {})).toEqual([]);
  });

  it("blocks when items are assigned", () => {
    expect(getCategoryDeleteBlockers("a", [baseRow("a")], { a: 3 })).toEqual([
      { kind: "items", count: 3 },
    ]);
  });

  it("blocks when child categories exist", () => {
    const rows = [baseRow("parent"), baseRow("child", "parent")];
    expect(getCategoryDeleteBlockers("parent", rows)).toEqual([
      { kind: "children", count: 1 },
    ]);
  });

  it("reports both blockers", () => {
    const rows = [baseRow("parent"), baseRow("child", "parent")];
    expect(getCategoryDeleteBlockers("parent", rows, { parent: 2 })).toEqual([
      { kind: "items", count: 2 },
      { kind: "children", count: 1 },
    ]);
  });
});

describe("categoryDeleteBlockedMessage", () => {
  it("formats a combined message", () => {
    const message = categoryDeleteBlockedMessage([
      { kind: "items", count: 1 },
      { kind: "children", count: 2 },
    ]);
    expect(message).toContain("Cannot delete");
    expect(message).toContain("1 item is assigned");
    expect(message).toContain("2 child categories exist");
  });
});

describe("categoryDeleteBlockedWithInactiveHint", () => {
  it("suggests marking inactive when category is active", () => {
    const message = categoryDeleteBlockedWithInactiveHint([{ kind: "items", count: 2 }], false);
    expect(message).toContain("mark it inactive");
  });

  it("notes when already inactive", () => {
    const message = categoryDeleteBlockedWithInactiveHint([{ kind: "items", count: 1 }], true);
    expect(message).toContain("already inactive");
  });
});
