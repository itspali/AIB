import { describe, expect, it } from "vitest";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import type { DocumentColumnPref } from "@/lib/documents/types";

describe("groupItemDetailRows", () => {
  const columns: DocumentColumnPref[] = [
    { id: "unit", label: "Unit", defaultVisible: true, itemDetailFlow: "new_line" },
    { id: "discount_pct", label: "Disc %", defaultVisible: true, itemDetailFlow: "inline_previous" },
    { id: "notes", label: "Notes", defaultVisible: true, itemDetailFlow: "new_line" },
  ];

  it("groups inline_previous fields with the previous row", () => {
    expect(groupItemDetailRows(columns).map((row) => row.map((column) => column.id))).toEqual([
      ["unit", "discount_pct"],
      ["notes"],
    ]);
  });
});
