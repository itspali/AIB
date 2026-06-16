"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import {
  resolveAddedLineScrollTargetKey,
  scrollElementWithinOverflowContainer,
} from "@/lib/documents/scroll-container-into-view";
import { DocumentLineEntryRow } from "@/components/documents/document-line-entry-row";
import {
  EMPTY_LINE_ROW_DRAG_STATE,
  measureLineRowHeights,
  resolveLineRowDropTargetFromLayout,
  type LineRowDragState,
  type LineRowDropPosition,
} from "@/lib/documents/line-row-drag";

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

/** Shared cell chrome: light vertical/top edges, stronger bottom row divider. */
export const DOCUMENT_LINE_CELL_BORDER =
  "border-x border-t border-border/45 border-b-2 border-b-border";

export const DOCUMENT_LINE_HEADER_CELL = cn(
  DOCUMENT_LINE_CELL_BORDER,
  "sticky top-0 z-[5] bg-muted/95 backdrop-blur-sm"
);

export const DOCUMENT_LINE_BODY_CELL = DOCUMENT_LINE_CELL_BORDER;

export const DOCUMENT_LINE_EDITABLE_CELL = cn(
  DOCUMENT_LINE_CELL_BORDER,
  "po-line-cell-surface"
);

export const DOCUMENT_LINE_ROW_BASE =
  "group transition-colors duration-100 ease-out";

/** Row hover/focus fill for line grid body cells (`group` on `<tr>`). */
export const DOCUMENT_LINE_ROW_CELL_HOVER =
  "transition-colors duration-100 ease-out group-hover:bg-[color-mix(in_srgb,hsl(var(--border))_5%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--background))_8%,hsl(var(--muted)))] group-focus-within:bg-[color-mix(in_srgb,hsl(var(--border))_5%,hsl(var(--background)))] dark:group-focus-within:bg-[color-mix(in_srgb,hsl(var(--background))_8%,hsl(var(--muted)))]";

type LineRow = { key: string };

type Props<T extends LineRow> = {
  lines: T[];
  columns: DocumentLineColumn[];
  minTableWidth?: string;
  fillHeight?: boolean;
  /** Scroll newly inserted rows into view inside the grid panel (spreadsheet entry). */
  autoScrollAddedLines?: "top" | "bottom";
  showLineNumbers?: boolean;
  showRemoveColumn?: boolean;
  disabled?: boolean;
  canRemoveLine?: (line: T, lineIndex: number, lines: T[]) => boolean;
  onRemoveLine?: (key: string) => void;
  canDuplicateLine?: (line: T, lineIndex: number, lines: T[]) => boolean;
  onDuplicateLine?: (key: string) => void;
  canReorderLine?: (line: T, lineIndex: number, lines: T[]) => boolean;
  onReorderLine?: (
    fromKey: string,
    toKey: string,
    position: LineRowDropPosition
  ) => void;
  renderCell: (column: DocumentLineColumn, line: T, lineIndex: number) => ReactNode;
};

function lineColumnClass(
  column: DocumentLineColumn,
  extra?: string
) {
  return cn(
    column.id === "line_image"
      ? "p-0 align-middle"
      : column.id === "item"
        ? "min-w-0 p-0 align-top whitespace-normal"
        : "p-0 align-top",
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
  autoScrollAddedLines,
  showLineNumbers = true,
  showRemoveColumn = true,
  disabled = false,
  canRemoveLine,
  onRemoveLine,
  canDuplicateLine,
  onDuplicateLine,
  canReorderLine,
  onReorderLine,
  renderCell,
}: Props<T>) {
  const showActionsColumn = showRemoveColumn || Boolean(onDuplicateLine);
  const actionsColWidth = onDuplicateLine && onRemoveLine ? "4.5rem" : "2.25rem";
  const lineNumberColWidth = onReorderLine ? "3rem" : "2.25rem";
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousLineKeysRef = useRef<string[]>([]);
  const [dragState, setDragState] = useState<LineRowDragState>(EMPTY_LINE_ROW_DRAG_STATE);
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;
  const measureRowHeights = useCallback(
    () => measureLineRowHeights(tbodyRef.current),
    []
  );
  const lineKeys = lines.map((line) => line.key);
  const reorderEnabled = Boolean(onReorderLine) && !disabled;
  const scrollAnchor = autoScrollAddedLines ?? (fillHeight ? "bottom" : undefined);

  useLayoutEffect(() => {
    if (!scrollAnchor) {
      previousLineKeysRef.current = lineKeys;
      return;
    }

    const previousKeys = previousLineKeysRef.current;
    previousLineKeysRef.current = lineKeys;

    const targetKey = resolveAddedLineScrollTargetKey(previousKeys, lineKeys, scrollAnchor);
    const scrollContainer = scrollRef.current;
    const tbody = tbodyRef.current;
    if (!targetKey || !scrollContainer || !tbody) return;

    const row = tbody.querySelector(`tr[data-line-key="${targetKey}"]`);
    if (!(row instanceof HTMLElement)) return;

    const scrollToRow = () => {
      scrollElementWithinOverflowContainer(scrollContainer, row, {
        edge: scrollAnchor === "top" ? "start" : "end",
      });
    };

    scrollToRow();
    requestAnimationFrame(scrollToRow);
  }, [lineKeys, scrollAnchor]);

  const handleTbodyDragOver = useCallback(
    (event: DragEvent<HTMLTableSectionElement>) => {
      const draggingKey = dragStateRef.current.draggingKey;
      if (!reorderEnabled || !draggingKey) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      const dropTarget = resolveLineRowDropTargetFromLayout(
        tbodyRef.current,
        event.clientY,
        draggingKey
      );
      if (!dropTarget) return;

      setDragState((previous) => {
        if (
          previous.dropTargetKey === dropTarget.targetKey &&
          previous.dropPosition === dropTarget.position
        ) {
          return previous;
        }
        return {
          ...previous,
          dropTargetKey: dropTarget.targetKey,
          dropPosition: dropTarget.position,
        };
      });
    },
    [reorderEnabled]
  );

  const handleTbodyDrop = useCallback(
    (event: DragEvent<HTMLTableSectionElement>) => {
      if (!reorderEnabled) return;

      event.preventDefault();
      const current = dragStateRef.current;
      const fromKey = event.dataTransfer.getData("text/plain") || current.draggingKey;
      const { dropTargetKey, dropPosition } = current;

      if (fromKey && dropTargetKey && dropPosition && fromKey !== dropTargetKey) {
        onReorderLine?.(fromKey, dropTargetKey, dropPosition);
      }

      setDragState(EMPTY_LINE_ROW_DRAG_STATE);
    },
    [onReorderLine, reorderEnabled]
  );

  const clearDragState = useCallback(() => {
    setDragState(EMPTY_LINE_ROW_DRAG_STATE);
  }, []);

  return (
    <div
      className={cn(
        "po-line-grid-canvas w-full min-w-0 max-w-full rounded-md border border-border",
        fillHeight && "flex min-h-0 min-w-0 flex-1 flex-col"
      )}
    >
      <div
        ref={scrollRef}
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
            {showLineNumbers ? <col style={{ width: lineNumberColWidth }} /> : null}
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
            {showActionsColumn ? <col style={{ width: actionsColWidth }} /> : null}
          </colgroup>
          <thead className="text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {showLineNumbers ? (
                <th
                  scope="col"
                  className={cn(
                    "px-0 py-1.5 text-center text-xs font-medium",
                    DOCUMENT_LINE_HEADER_CELL
                  )}
                  style={{ width: lineNumberColWidth }}
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
              {showActionsColumn ? (
                <th
                  className={cn("px-0 py-1.5", DOCUMENT_LINE_HEADER_CELL)}
                  style={{ width: actionsColWidth }}
                  scope="col"
                  aria-label="Line actions"
                />
              ) : null}
            </tr>
          </thead>
          <tbody
            ref={tbodyRef}
            onDragOver={reorderEnabled ? handleTbodyDragOver : undefined}
            onDrop={reorderEnabled ? handleTbodyDrop : undefined}
          >
            {lines.map((line, lineIndex) => {
              const canRemove = canRemoveLine
                ? canRemoveLine(line, lineIndex, lines)
                : lines.length > 1;
              const canDuplicate = canDuplicateLine
                ? canDuplicateLine(line, lineIndex, lines)
                : Boolean((line as { variant_id?: string }).variant_id);
              const canReorder = canReorderLine
                ? canReorderLine(line, lineIndex, lines)
                : false;

              return (
                <DocumentLineEntryRow
                  key={line.key}
                  line={line}
                  lineIndex={lineIndex}
                  lineKeys={lineKeys}
                  columns={columns}
                  disabled={disabled}
                  showLineNumbers={showLineNumbers}
                  showActionsColumn={showActionsColumn}
                  lineNumberColWidth={lineNumberColWidth}
                  canRemove={canRemove}
                  canDuplicate={canDuplicate}
                  canReorder={canReorder}
                  dragState={reorderEnabled ? dragState : EMPTY_LINE_ROW_DRAG_STATE}
                  onDragStateChange={reorderEnabled ? setDragState : () => {}}
                  onDragEnd={reorderEnabled ? clearDragState : undefined}
                  onMeasureRowHeights={measureRowHeights}
                  onRemoveLine={onRemoveLine}
                  onDuplicateLine={onDuplicateLine}
                  onReorderLine={onReorderLine}
                  lineColumnClass={lineColumnClass}
                  renderCell={renderCell}
                />
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
  headerAction?: ReactNode;
};

export function DocumentLineEntrySection({
  children,
  title = "Lines",
  fillHeight = false,
  showSectionTitle = true,
  headerAction,
}: SectionProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", fillHeight && "min-h-0 flex-1")}>
      {showSectionTitle || headerAction ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          {showSectionTitle ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
          ) : (
            <span className="sr-only">{title}</span>
          )}
          {headerAction ? <div className={cn(!showSectionTitle && "ml-auto")}>{headerAction}</div> : null}
        </div>
      ) : (
        <span className="sr-only">{title}</span>
      )}
      <div className={cn(fillHeight && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </div>
  );
}
