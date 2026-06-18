import { documentColumnTypographyStyleAttr } from "@/lib/documents/document-typography-classes";
import type { DocumentPrintLine } from "@/lib/documents/build-document-print-model";
import { groupItemDetailRows } from "@/lib/documents/item-detail-rows";
import type { DocumentColumnPref } from "@/lib/documents/types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isEmptyDetailValue(value: string | undefined): boolean {
  return value == null || value.trim() === "" || value === "—";
}

/** Render item-detail / catalog sublines under the line item cell in print HTML. */
export function renderPrintLineItemDetailsHtml(
  detailColumns: readonly DocumentColumnPref[],
  line: DocumentPrintLine
): string {
  const columnsToRender = detailColumns.filter((column) => !isEmptyDetailValue(line[column.id]));
  const detailRows = groupItemDetailRows(columnsToRender);
  if (detailRows.length === 0) return "";

  const rowsHtml = detailRows
    .map((rowColumns) => {
      if (rowColumns.length > 1) {
        const parts = rowColumns
          .map((column, columnIndex) => {
            const value = line[column.id] ?? "—";
            const label =
              column.showLabel !== false
                ? `<span class="line-detail__label"${documentColumnTypographyStyleAttr(column, "label")}>${escapeHtml(column.label)}:</span> `
                : "";
            const separator =
              columnIndex > 0 ? `<span class="line-detail__sep" aria-hidden="true">·</span> ` : "";
            return `${separator}${label}<span class="line-detail__value"${documentColumnTypographyStyleAttr(column, "value")}>${escapeHtml(value)}</span>`;
          })
          .join("");
        return `<div class="line-detail__row line-detail__row--inline">${parts}</div>`;
      }

      const column = rowColumns[0]!;
      const value = line[column.id] ?? "—";
      const label =
        column.showLabel !== false
          ? `<span class="line-detail__label"${documentColumnTypographyStyleAttr(column, "label")}>${escapeHtml(column.label)}:</span> `
          : "";
      return `<div class="line-detail__row">${label}<span class="line-detail__value"${documentColumnTypographyStyleAttr(column, "value")}>${escapeHtml(value)}</span></div>`;
    })
    .join("");

  return `<div class="line-detail">${rowsHtml}</div>`;
}
