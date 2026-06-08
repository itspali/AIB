"use client";

import { useCallback, useState, type MutableRefObject } from "react";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  getColumnResizeBounds,
  resolveColumnWidthSpec,
  resolveColumnWidthStyles,
  stretchListTableColumnWidth,
} from "@/lib/list-columns/sizing";
import type { ListColumnDef } from "@/lib/list-columns/types";

type Options<TId extends string> = {
  columns: readonly TId[];
  columnWidths?: Partial<Record<TId, number>>;
  deviceClass: DeviceClass;
  getColumnDef: (id: TId) => ListColumnDef<TId>;
  headerRefs: MutableRefObject<(HTMLTableCellElement | null)[]>;
  wrapModeForColumn?: (columnId: TId) => TextWrapMode;
  /** Content-based width for double-click auto-fit. */
  resolveAutoWidth?: (columnId: TId, index: number) => number;
};

export function useResizableListColumns<TId extends string>({
  columns,
  columnWidths,
  deviceClass,
  getColumnDef,
  headerRefs,
  wrapModeForColumn,
  resolveAutoWidth,
}: Options<TId>) {
  const [previewWidths, setPreviewWidths] = useState<Partial<Record<TId, number>>>({});

  const getUserWidthPx = useCallback(
    (columnId: TId) => previewWidths[columnId] ?? columnWidths?.[columnId],
    [columnWidths, previewWidths]
  );

  const resolveWidthStyles = useCallback(
    (columnId: TId, columnIndex?: number) => {
      const column = getColumnDef(columnId);
      const wrapMode = wrapModeForColumn?.(columnId) ?? column.defaultWrapMode ?? "truncate";
      const userWidth = getUserWidthPx(columnId);
      const style = resolveColumnWidthStyles(column, deviceClass, wrapMode, userWidth);
      return stretchListTableColumnWidth(style, {
        isLastColumn: columnIndex != null && columnIndex === columns.length - 1,
        hasUserWidth: userWidth != null,
      });
    },
    [columns.length, deviceClass, getColumnDef, getUserWidthPx, wrapModeForColumn]
  );

  const getHeaderWidthPx = useCallback(
    (columnId: TId, index: number) => {
      const userWidth = getUserWidthPx(columnId);
      if (userWidth != null) return userWidth;

      const measured = headerRefs.current[index]?.offsetWidth;
      if (measured && measured > 0) return measured;

      const column = getColumnDef(columnId);
      const wrapMode = wrapModeForColumn?.(columnId) ?? column.defaultWrapMode ?? "truncate";
      const spec = resolveColumnWidthSpec(column, deviceClass, wrapMode);
      const preferred = spec.preferred ?? spec.min ?? spec.max;
      return typeof preferred === "number" ? preferred : 120;
    },
    [deviceClass, getColumnDef, getUserWidthPx, headerRefs, wrapModeForColumn]
  );

  const setPreviewWidth = useCallback((columnId: TId, width: number) => {
    setPreviewWidths((current) => ({ ...current, [columnId]: width }));
  }, []);

  const clearPreviewWidth = useCallback((columnId: TId) => {
    setPreviewWidths((current) => {
      const next = { ...current };
      delete next[columnId];
      return next;
    });
  }, []);

  const autoFitColumn = useCallback(
    (columnId: TId, index: number, onCommit: (width: number | null) => void) => {
      clearPreviewWidth(columnId);
      if (resolveAutoWidth) {
        onCommit(resolveAutoWidth(columnId, index));
        return;
      }
      const column = getColumnDef(columnId);
      const bounds = getColumnResizeBounds(column, deviceClass);
      const headerWidth = headerRefs.current[index]?.offsetWidth ?? bounds.min;
      onCommit(Math.min(bounds.max, Math.max(bounds.min, headerWidth)));
    },
    [clearPreviewWidth, deviceClass, getColumnDef, headerRefs, resolveAutoWidth]
  );

  return {
    columns,
    getHeaderWidthPx,
    resolveWidthStyles,
    setPreviewWidth,
    clearPreviewWidth,
    autoFitColumn,
    getColumnDef,
    deviceClass,
  };
}
