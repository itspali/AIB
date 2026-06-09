import type { DocumentColumnPref, DocumentItemDetailFlow } from "@/lib/documents/types";

/** Group item-detail fields into render rows (new line vs inline with previous). */
export function groupItemDetailRows(columns: readonly DocumentColumnPref[]): DocumentColumnPref[][] {
  const rows: DocumentColumnPref[][] = [];

  for (const column of columns) {
    const flow: DocumentItemDetailFlow = column.itemDetailFlow ?? "new_line";
    if (flow === "inline_previous" && rows.length > 0) {
      rows[rows.length - 1]!.push(column);
    } else {
      rows.push([column]);
    }
  }

  return rows;
}
