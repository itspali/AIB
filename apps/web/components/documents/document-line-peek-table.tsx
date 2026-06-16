"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_LINE_CELL_BORDER,
  DOCUMENT_LINE_HEADER_CELL,
  DOCUMENT_LINE_ROW_BASE,
  DOCUMENT_LINE_ROW_CELL_HOVER,
} from "@/components/documents/document-line-entry-grid";

export type DocumentLinePeekColumn = {
  id: string;
  label: string;
  align?: "left" | "right" | "center";
  widthClass?: string;
};

type Props<T> = {
  lines: T[];
  columns: DocumentLinePeekColumn[];
  minTableWidth?: string;
  showLineNumbers?: boolean;
  getRowKey: (line: T, index: number) => string;
  renderCell: (column: DocumentLinePeekColumn, line: T, lineIndex: number) => ReactNode;
};

function peekColumnClass(column: DocumentLinePeekColumn) {
  return cn(
    column.align === "right"
      ? "text-right"
      : column.align === "center"
        ? "text-center"
        : "text-left",
    column.widthClass
  );
}

export function DocumentLinePeekTable<T>({
  lines,
  columns,
  minTableWidth = "min-w-[34rem]",
  showLineNumbers = true,
  getRowKey,
  renderCell,
}: Props<T>) {
  return (
    <div className="po-peek-lines-table po-line-grid-scroll">
      <table className={cn("w-full table-fixed border-collapse text-sm", minTableWidth)}>
        <thead className="text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {showLineNumbers ? (
              <th
                scope="col"
                className={cn(
                  "w-9 px-0 py-1.5 text-center text-xs font-medium",
                  DOCUMENT_LINE_HEADER_CELL
                )}
                aria-label="Line number"
              >
                #
              </th>
            ) : null}
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "px-1.5 py-1.5 text-xs font-medium",
                  peekColumnClass(column),
                  DOCUMENT_LINE_HEADER_CELL
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, lineIndex) => (
            <tr
              key={getRowKey(line, lineIndex)}
              className={cn("border-b-2 border-b-border last:border-0", DOCUMENT_LINE_ROW_BASE)}
            >
              {showLineNumbers ? (
                <td
                  className={cn(
                    "w-9 px-0 py-1 text-center align-middle text-xs tabular-nums text-muted-foreground",
                    DOCUMENT_LINE_CELL_BORDER,
                    DOCUMENT_LINE_ROW_CELL_HOVER
                  )}
                >
                  {lineIndex + 1}
                </td>
              ) : null}
              {columns.map((column) => (
                <td
                  key={column.id}
                  className={cn(
                    "p-2 align-top",
                    DOCUMENT_LINE_CELL_BORDER,
                    peekColumnClass(column),
                    DOCUMENT_LINE_ROW_CELL_HOVER
                  )}
                >
                  {renderCell(column, line, lineIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DocumentLinePeekItemCell({
  itemName,
  variantSku,
}: {
  itemName: string;
  variantSku: string;
}) {
  return (
    <>
      <div className="text-xs font-medium">{itemName}</div>
      <div className="font-mono text-xs text-muted-foreground">{variantSku}</div>
    </>
  );
}

export function DocumentLinePeekValueCell({
  value,
  align = "right",
}: {
  value: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <span
      className={cn(
        "tabular-nums",
        align === "right" ? "block text-right" : align === "center" ? "block text-center" : "block"
      )}
    >
      {value}
    </span>
  );
}
