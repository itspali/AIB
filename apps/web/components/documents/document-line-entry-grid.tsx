"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DocumentLineRemoveButton } from "@/components/documents/document-line-entry-cells";

export type DocumentLineColumn = {
  id: string;
  label: string;
  align?: "left" | "right" | "center";
  widthClass?: string;
  /** Fixed `<col>` width in rem; item uses min width and fills remaining space. */
  colWidthRem?: number;
  /** Minimum `<col>` width in rem (item column). */
  colMinWidthRem?: number;
  editable?: boolean;
  headerClassName?: string;
};

export const DOCUMENT_LINE_HEADER_CELL =
  "border border-border sticky top-0 z-[5] bg-muted/95 backdrop-blur-sm shadow-[inset_0_-1px_0_0_hsl(var(--border))]";

export const DOCUMENT_LINE_BODY_CELL = "border border-border";

export const DOCUMENT_LINE_EDITABLE_CELL = "border border-border po-line-cell-surface";

type LineRow = { key: string };

type Props<T extends LineRow> = {
  lines: T[];
  columns: DocumentLineColumn[];
  minTableWidth?: string;
  fillHeight?: boolean;
  showLineNumbers?: boolean;
  showRemoveColumn?: boolean;
  disabled?: boolean;
  canRemoveLine?: (line: T, lineIndex: number, lines: T[]) => boolean;
  onRemoveLine?: (key: string) => void;
  renderCell: (column: DocumentLineColumn, line: T, lineIndex: number) => ReactNode;
};

function lineColumnClass(
  column: DocumentLineColumn,
  extra?: string
) {
  return cn(
    column.id === "item" || column.id === "line_image"
      ? column.id === "line_image"
        ? "p-0 align-middle"
        : "min-w-0 p-0 align-top whitespace-normal"
      : "p-0 align-middle",
    column.align === "right"
      ? "text-right"
      : column.align === "center"
        ? "text-center"
        : "text-left",
    column.widthClass,
    extra
  );
}

export function DocumentLineEntryGrid<T extends LineRow>({
  lines,
  columns,
  minTableWidth = "min-w-[34rem]",
  fillHeight = false,
  showLineNumbers = true,
  showRemoveColumn = true,
  disabled = false,
  canRemoveLine,
  onRemoveLine,
  renderCell,
}: Props<T>) {
  return (
    <div
      className={cn(
        "po-line-grid-canvas w-full min-w-0 max-w-full rounded-md border border-border",
        fillHeight && "flex min-h-0 min-w-0 flex-1 flex-col"
      )}
    >
      <div
        className={cn(
          "po-line-grid-scroll",
          fillHeight ? "min-h-0 flex-1 overflow-x-auto overflow-y-auto" : "overflow-y-visible"
        )}
      >
        <table
          className={cn(
            "w-full table-fixed border-collapse text-sm",
            minTableWidth,
            "[&_input:focus-visible]:border-transparent [&_input:focus-visible]:shadow-none [&_input:focus-visible]:ring-0 [&_input:focus-visible]:ring-offset-0"
          )}
        >
          <colgroup>
            {showLineNumbers ? <col style={{ width: "2.25rem" }} /> : null}
            {columns.map((column) => (
              <col
                key={column.id}
                style={
                  column.colMinWidthRem != null
                    ? { minWidth: `${column.colMinWidthRem}rem` }
                    : column.colWidthRem != null
                      ? { width: `${column.colWidthRem}rem` }
                      : undefined
                }
              />
            ))}
            {showRemoveColumn ? <col style={{ width: "2.25rem" }} /> : null}
          </colgroup>
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
                    lineColumnClass(column, "px-1.5 py-1.5 text-xs font-medium"),
                    DOCUMENT_LINE_HEADER_CELL,
                    column.headerClassName
                  )}
                >
                  {column.label}
                </th>
              ))}
              {showRemoveColumn ? (
                <th
                  className={cn("w-9 px-0 py-1.5", DOCUMENT_LINE_HEADER_CELL)}
                  scope="col"
                  aria-label="Remove line"
                />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, lineIndex) => {
              const canRemove = canRemoveLine
                ? canRemoveLine(line, lineIndex, lines)
                : lines.length > 1;

              return (
                <tr key={line.key}>
                  {showLineNumbers ? (
                    <td className="w-9 border border-border px-0 py-1 text-center align-middle text-xs tabular-nums text-muted-foreground">
                      {lineIndex + 1}
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn(
                        lineColumnClass(column),
                        column.editable ? DOCUMENT_LINE_EDITABLE_CELL : DOCUMENT_LINE_BODY_CELL
                      )}
                    >
                      {renderCell(column, line, lineIndex)}
                    </td>
                  ))}
                  {showRemoveColumn ? (
                    <td className="w-9 border border-border p-0 text-center align-middle">
                      {onRemoveLine ? (
                        <DocumentLineRemoveButton
                          lineKey={line.key}
                          disabled={disabled}
                          canRemove={canRemove}
                          onRemove={onRemoveLine}
                        />
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type SectionProps = {
  children: ReactNode;
  title?: string;
  fillHeight?: boolean;
  showSectionTitle?: boolean;
};

export function DocumentLineEntrySection({
  children,
  title = "Lines",
  fillHeight = false,
  showSectionTitle = true,
}: SectionProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", fillHeight && "min-h-0 flex-1")}>
      {showSectionTitle ? (
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : (
        <span className="sr-only">{title}</span>
      )}
      <div className={cn(fillHeight && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </div>
  );
}
