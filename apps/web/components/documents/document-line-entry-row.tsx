"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DocumentLineDragHandle,
  DocumentLineDuplicateButton,
  DocumentLineRemoveButton,
} from "@/components/documents/document-line-entry-cells";
import {
  DOCUMENT_LINE_BODY_CELL,
  DOCUMENT_LINE_EDITABLE_CELL,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";

type LineRow = { key: string };

type Props<T extends LineRow> = {
  line: T;
  lineIndex: number;
  lines: T[];
  columns: DocumentLineColumn[];
  disabled: boolean;
  showLineNumbers: boolean;
  showActionsColumn: boolean;
  lineNumberColWidth: string;
  canRemove: boolean;
  canDuplicate: boolean;
  canReorder: boolean;
  onRemoveLine?: (key: string) => void;
  onDuplicateLine?: (key: string) => void;
  onReorderLine?: (fromKey: string, toKey: string) => void;
  lineColumnClass: (column: DocumentLineColumn, extra?: string) => string;
  renderCell: (column: DocumentLineColumn, line: T, lineIndex: number) => ReactNode;
};

export function DocumentLineEntryRow<T extends LineRow>({
  line,
  lineIndex,
  lines,
  columns,
  disabled,
  showLineNumbers,
  showActionsColumn,
  lineNumberColWidth,
  canRemove,
  canDuplicate,
  canReorder,
  onRemoveLine,
  onDuplicateLine,
  onReorderLine,
  lineColumnClass,
  renderCell,
}: Props<T>) {
  const [dragOver, setDragOver] = useState(false);
  const reorderEnabled = canReorder && Boolean(onReorderLine) && !disabled;

  return (
    <tr
      onDragOver={(event) => {
        if (!reorderEnabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        if (!reorderEnabled) return;
        event.preventDefault();
        const fromKey = event.dataTransfer.getData("text/plain");
        if (fromKey && fromKey !== line.key) {
          onReorderLine?.(fromKey, line.key);
        }
        setDragOver(false);
      }}
      className={cn(reorderEnabled && dragOver && "bg-accent/50")}
    >
      {showLineNumbers ? (
        <td
          className="border border-border px-0 py-1 text-center align-top text-xs tabular-nums text-muted-foreground"
          style={{ width: lineNumberColWidth }}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            {onReorderLine ? (
              <DocumentLineDragHandle
                lineKey={line.key}
                disabled={disabled}
                canDrag={canReorder}
              />
            ) : null}
            <span>{lineIndex + 1}</span>
          </div>
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
      {showActionsColumn ? (
        <td className="border border-border p-0 text-center align-top">
          <div className="flex items-center justify-center">
            {onDuplicateLine ? (
              <DocumentLineDuplicateButton
                lineKey={line.key}
                disabled={disabled}
                canDuplicate={canDuplicate}
                onDuplicate={onDuplicateLine}
              />
            ) : null}
            {onRemoveLine ? (
              <DocumentLineRemoveButton
                lineKey={line.key}
                disabled={disabled}
                canRemove={canRemove}
                onRemove={onRemoveLine}
              />
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}
