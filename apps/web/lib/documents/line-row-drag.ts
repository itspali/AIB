import type { CSSProperties } from "react";

export type LineRowDropPosition = "before" | "after";

export type LineRowDragState = {
  draggingKey: string | null;
  dropTargetKey: string | null;
  dropPosition: LineRowDropPosition | null;
  rowHeights: Record<string, number>;
};

export const EMPTY_LINE_ROW_DRAG_STATE: LineRowDragState = {
  draggingKey: null,
  dropTargetKey: null,
  dropPosition: null,
  rowHeights: {},
};

/** Insert index after removing the dragged row (matches movePoDraftLine). */
export function resolvePreviewInsertIndex(
  keys: readonly string[],
  fromKey: string,
  toKey: string,
  position: LineRowDropPosition
): number | null {
  const fromIndex = keys.indexOf(fromKey);
  const targetIndex = keys.indexOf(toKey);
  if (fromIndex < 0 || targetIndex < 0 || fromKey === toKey) return null;

  let insertIndex = targetIndex;
  if (position === "after") insertIndex += 1;
  if (fromIndex < insertIndex) insertIndex -= 1;
  return insertIndex;
}

/** Visual-only shift for rows that move aside during drag (pixels, no data reorder). */
export function computeLineRowVisualShiftPx(
  lineIndex: number,
  lineKey: string,
  keys: readonly string[],
  dragState: Pick<
    LineRowDragState,
    "draggingKey" | "dropTargetKey" | "dropPosition" | "rowHeights"
  >
): number {
  const { draggingKey, dropTargetKey, dropPosition, rowHeights } = dragState;
  if (!draggingKey || !dropTargetKey || !dropPosition || lineKey === draggingKey) {
    return 0;
  }

  const fromIndex = keys.indexOf(draggingKey);
  const insertIndex = resolvePreviewInsertIndex(
    keys,
    draggingKey,
    dropTargetKey,
    dropPosition
  );
  if (fromIndex < 0 || insertIndex == null || insertIndex === fromIndex) return 0;

  const shiftAmount = rowHeights[draggingKey] ?? 0;
  if (shiftAmount <= 0) return 0;

  if (fromIndex < insertIndex) {
    if (lineIndex > fromIndex && lineIndex <= insertIndex) return -shiftAmount;
  } else if (lineIndex >= insertIndex && lineIndex < fromIndex) {
    return shiftAmount;
  }

  return 0;
}

export function measureLineRowHeights(
  tbody: HTMLTableSectionElement | null
): Record<string, number> {
  const rowHeights: Record<string, number> = {};
  if (!tbody) return rowHeights;

  tbody.querySelectorAll("tr[data-line-key]").forEach((node) => {
    const key = node.getAttribute("data-line-key");
    if (!key) return;
    rowHeights[key] = node.getBoundingClientRect().height;
  });

  return rowHeights;
}

export type LineRowDropTarget = {
  targetKey: string;
  position: LineRowDropPosition;
};

/** Layout-based half-row test (ignores CSS transforms on rows). */
export function resolveLineRowDropPositionFromLayout(
  row: HTMLTableRowElement,
  clientY: number
): LineRowDropPosition {
  const tbody = row.closest("tbody");
  if (!tbody) return "after";

  const tbodyRect = tbody.getBoundingClientRect();
  const pointerY = clientY - tbodyRect.top + tbody.scrollTop;
  const midpoint = row.offsetTop + row.offsetHeight / 2;
  return pointerY < midpoint ? "before" : "after";
}

/** Resolve drop target from pointer using layout geometry (stable while rows are visually shifted). */
export function resolveLineRowDropTargetFromLayout(
  tbody: HTMLTableSectionElement | null,
  clientY: number,
  draggingKey: string
): LineRowDropTarget | null {
  if (!tbody) return null;

  const tbodyRect = tbody.getBoundingClientRect();
  const pointerY = clientY - tbodyRect.top + tbody.scrollTop;
  const rows = tbody.querySelectorAll("tr[data-line-key]");

  let lastEligible: LineRowDropTarget | null = null;

  for (const node of rows) {
    const row = node as HTMLTableRowElement;
    const key = row.getAttribute("data-line-key");
    if (!key || key === draggingKey) continue;

    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    lastEligible = {
      targetKey: key,
      position: "after",
    };

    if (pointerY < top) {
      return { targetKey: key, position: "before" };
    }

    if (pointerY >= top && pointerY < bottom) {
      return {
        targetKey: key,
        position: pointerY < top + row.offsetHeight / 2 ? "before" : "after",
      };
    }
  }

  return lastEligible;
}

export function resolveLineRowDropPosition(
  event: React.DragEvent<HTMLTableRowElement>
): LineRowDropPosition {
  return resolveLineRowDropPositionFromLayout(event.currentTarget, event.clientY);
}

export function lineRowCellShiftStyle(
  visualShiftPx: number,
  isReordering: boolean
): CSSProperties | undefined {
  if (!isReordering) return undefined;

  return {
    transform: `translate3d(0, ${visualShiftPx}px, 0)`,
    transition: "transform 120ms cubic-bezier(0.2, 0, 0, 1)",
    willChange: "transform",
  };
}

/** Clone a table row for the native drag ghost preview. */
export function setTableRowDragImage(
  event: Pick<React.DragEvent, "dataTransfer">,
  row: HTMLTableRowElement,
  offsetX = 24,
  offsetY = 16
): void {
  const clone = row.cloneNode(true) as HTMLTableRowElement;
  const table = document.createElement("table");
  table.className = row.closest("table")?.className ?? "";
  table.style.position = "fixed";
  table.style.top = "-10000px";
  table.style.left = "-10000px";
  table.style.width = `${row.offsetWidth}px`;
  table.style.pointerEvents = "none";
  table.style.opacity = "0.92";
  table.style.background = "hsl(var(--background))";
  table.style.boxShadow = "0 6px 18px hsl(var(--foreground) / 0.14)";
  table.style.borderRadius = "0.375rem";
  table.style.overflow = "hidden";

  const tbody = document.createElement("tbody");
  tbody.appendChild(clone);
  table.appendChild(tbody);
  document.body.appendChild(table);

  event.dataTransfer.setDragImage(table, offsetX, offsetY);
  window.setTimeout(() => {
    document.body.removeChild(table);
  }, 0);
}
