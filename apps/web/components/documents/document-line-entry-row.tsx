"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DocumentLineDragHandle,
  DocumentLineDuplicateButton,
  DocumentLineRemoveButton,
} from "@/components/documents/document-line-entry-cells";
import {
  DOCUMENT_LINE_BODY_CELL,
  DOCUMENT_LINE_EDITABLE_CELL,
  DOCUMENT_LINE_ROW_BASE,
  DOCUMENT_LINE_ROW_CELL_HOVER,
  type DocumentLineColumn,
} from "@/components/documents/document-line-entry-grid";
import {
  computeLineRowVisualShiftPx,
  lineRowCellShiftStyle,
  setTableRowDragImage,
  type LineRowDragState,
  type LineRowDropPosition,
} from "@/lib/documents/line-row-drag";

type LineRow = { key: string };

export type { LineRowDragState };

type Props<T extends LineRow> = {
  line: T;
  lineIndex: number;
  lineKeys: readonly string[];
  columns: DocumentLineColumn[];
  disabled: boolean;
  showLineNumbers: boolean;
  showActionsColumn: boolean;
  lineNumberColWidth: string;
  canRemove: boolean;
  canDuplicate: boolean;
  canReorder: boolean;
  dragState: LineRowDragState;
  onDragStateChange: (state: LineRowDragState) => void;
  onDragEnd?: () => void;
  onMeasureRowHeights: () => Record<string, number>;
  onRemoveLine?: (key: string) => void;
  onDuplicateLine?: (key: string) => void;
  onReorderLine?: (
    fromKey: string,
    toKey: string,
    position: LineRowDropPosition
  ) => void;
  lineColumnClass: (column: DocumentLineColumn, extra?: string) => string;
  renderCell: (column: DocumentLineColumn, line: T, lineIndex: number) => ReactNode;
};

export function DocumentLineEntryRow<T extends LineRow>({
  line,
  lineIndex,
  lineKeys,
  columns,
  disabled,
  showLineNumbers,
  showActionsColumn,
  lineNumberColWidth,
  canRemove,
  canDuplicate,
  canReorder,
  dragState,
  onDragStateChange,
  onDragEnd,
  onMeasureRowHeights,
  onRemoveLine,
  onDuplicateLine,
  onReorderLine,
  lineColumnClass,
  renderCell,
}: Props<T>) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  const isDragging = dragState.draggingKey === line.key;
  const isReordering = Boolean(dragState.draggingKey);
  const visualShiftPx = computeLineRowVisualShiftPx(
    lineIndex,
    line.key,
    lineKeys,
    dragState
  );
  const cellShiftStyle = lineRowCellShiftStyle(visualShiftPx, isReordering);

  return (
    <tr ref={rowRef} data-line-key={line.key} className={DOCUMENT_LINE_ROW_BASE}>
      {showLineNumbers ? (
        <td
          className={cn(
            "border border-border px-0 py-1 text-center align-top text-xs tabular-nums text-muted-foreground",
            !isDragging && DOCUMENT_LINE_ROW_CELL_HOVER,
            isDragging && "opacity-40"
          )}
          style={{ width: lineNumberColWidth, ...cellShiftStyle }}
        >
          <div className="flex flex-col items-center justify-center gap-0.5">
            {onReorderLine ? (
              <DocumentLineDragHandle
                lineKey={line.key}
                disabled={disabled}
                canDrag={canReorder}
                onDragStart={(event) => {
                  onDragStateChange({
                    draggingKey: line.key,
                    dropTargetKey: null,
                    dropPosition: null,
                    rowHeights: onMeasureRowHeights(),
                  });
                  const row = rowRef.current;
                  if (row) {
                    setTableRowDragImage(event, row);
                  }
                }}
                onDragEnd={() => {
                  onDragEnd?.();
                }}
              />
            ) : null}
            <span>{lineIndex + 1}</span>
          </div>
        </td>
      ) : null}
      {columns.map((column) => (
        <td
          key={column.id}
          style={cellShiftStyle}
          className={cn(
            lineColumnClass(column),
            column.editable ? DOCUMENT_LINE_EDITABLE_CELL : DOCUMENT_LINE_BODY_CELL,
            !isDragging && DOCUMENT_LINE_ROW_CELL_HOVER,
            isDragging && "opacity-40"
          )}
        >
          {renderCell(column, line, lineIndex)}
        </td>
      ))}
      {showActionsColumn ? (
        <td
          style={cellShiftStyle}
          className={cn(
            "border border-border p-0 text-center align-top",
            !isDragging && DOCUMENT_LINE_ROW_CELL_HOVER,
            isDragging && "opacity-40"
          )}
        >
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
